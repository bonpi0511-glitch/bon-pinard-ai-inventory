import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./supabase-admin";

/*
 * 運営者（Admin）専用API用の認証エラー。
 * statusをそのままHTTPレスポンスへ使う。
 */
export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/*
 * ADMIN_EMAILSはNEXT_PUBLIC_を付けず、サーバー側だけで読む。
 * カンマ区切り（例: "a@example.com,b@example.com"）。
 */
function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/*
 * リクエストの Authorization: Bearer <access_token> を検証し、
 * そのSupabaseユーザーのemailがADMIN_EMAILSに含まれているかを確認する。
 *
 * - tokenが無い/無効 → 401
 * - tokenは有効だがAdminでない → 403
 * - ADMIN_EMAILS未設定 → 403（安全側に倒す。誰もAdminにしない）
 *
 * クライアント（inventory-app.tsx）側の表示制御だけに頼らず、
 * すべてのAdmin APIはこの関数を必ず呼び出すこと。
 */
export async function requireAdminUser(
  req: NextRequest
) {
  const authHeader =
    req.headers.get("authorization") || "";

  const token = authHeader
    .toLowerCase()
    .startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    throw new AdminAuthError(
      "Missing Authorization header.",
      401
    );
  }

  const adminEmails = getAdminEmails();

  if (adminEmails.length === 0) {
    throw new AdminAuthError(
      "ADMIN_EMAILS is not configured on the server.",
      403
    );
  }

  const admin = getSupabaseAdmin();

  const { data, error } =
    await admin.auth.getUser(token);

  if (error || !data?.user) {
    throw new AdminAuthError(
      "Invalid or expired session.",
      401
    );
  }

  const email = (
    data.user.email || ""
  ).toLowerCase();

  if (!email || !adminEmails.includes(email)) {
    throw new AdminAuthError(
      "This account is not an administrator.",
      403
    );
  }

  return data.user;
}
