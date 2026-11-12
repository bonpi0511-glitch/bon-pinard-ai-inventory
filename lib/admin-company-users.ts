import { getSupabaseAdmin } from "./supabase-admin";

/*
 * Section 14「顧客ユーザー権限管理」用の正式role一覧。
 * profiles.roleのCHECK制約 role in ('owner','staff','viewer') と
 * 一致させる（managerはまだ導入しない）。
 */
export const CUSTOMER_ROLES = [
  "owner",
  "staff",
  "viewer",
] as const;

export type CustomerRole = (typeof CUSTOMER_ROLES)[number];

export function isValidCustomerRole(
  value: unknown
): value is CustomerRole {
  return CUSTOMER_ROLES.includes(
    value as CustomerRole
  );
}

/*
 * Section 12「顧客ユーザー管理・招待」用のサーバー専用ヘルパー。
 * Supabase Auth Admin API（service_role専用）のユーザー一覧を
 * ページングしながら全件取得する。
 *
 * supabase-jsのauth.admin.listUsers()は1回のリクエストでは
 * 一部しか返さないため、「最初の1件目のページだけ取得して終わり」
 * にならないよう、空ページが返るまでループする。
 * 万一の無限ループを避けるためMAX_PAGESで上限を設ける
 * （PER_PAGE=1000 × MAX_PAGES=50 = 最大50,000ユーザーまで対応）。
 */

export type AdminAuthUserSummary = {
  id: string;
  email: string | null;
  createdAt: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  invitedAt: string | null;
};

const PER_PAGE = 1000;
const MAX_PAGES = 50;

export async function listAllAuthUsers(): Promise<
  AdminAuthUserSummary[]
> {
  const admin = getSupabaseAdmin();
  const results: AdminAuthUserSummary[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } =
      await admin.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      });

    if (error) {
      throw error;
    }

    const users = data?.users || [];

    for (const u of users) {
      results.push({
        id: u.id,
        email: u.email || null,
        createdAt: u.created_at || null,
        emailConfirmedAt:
          (u as any).email_confirmed_at || null,
        lastSignInAt: u.last_sign_in_at || null,
        invitedAt: (u as any).invited_at || null,
      });
    }

    // 返ってきた件数がPER_PAGE未満なら、それが最後のページ。
    if (users.length < PER_PAGE) {
      break;
    }
  }

  return results;
}

/*
 * Supabase Authユーザーの状態を、標準的なGoTrueユーザー項目
 * （email_confirmed_at / last_sign_in_at / invited_at）から
 * 3状態に分類する。
 *
 * - ACTIVE      : 一度でもログイン実績がある（last_sign_in_atあり）
 * - INVITED     : 招待/メール確認は済んでいるが、まだ未ログイン
 * - UNCONFIRMED : 招待・メール確認のいずれも確認できない
 *
 * 実際のSupabase環境でのフィールドの挙動はテスト招待で
 * 最終確認すること。
 */
export function classifyAuthUserStatus(user: {
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  invitedAt: string | null;
}): "ACTIVE" | "INVITED" | "UNCONFIRMED" {
  if (user.lastSignInAt) return "ACTIVE";
  if (user.emailConfirmedAt || user.invitedAt) {
    return "INVITED";
  }
  return "UNCONFIRMED";
}

export type ProfileInsertOutcome =
  | { outcome: "inserted" }
  | { outcome: "already_correct" }
  | { outcome: "other_company" }
  | { outcome: "failed"; error: string };

/*
 * public.profiles(id, company_id, role, ...)へ、実DBで確認済みの
 * 最小限の値だけで安全にINSERTする。
 *
 * 実DB確認結果（2026-09時点）：
 *   id uuid NOT NULL
 *   company_id uuid NOT NULL
 *   full_name text NULL
 *   role text NOT NULL DEFAULT 'staff'
 *     （Section 14でCHECK制約 role in ('owner','staff','viewer') を追加済み）
 *   created_at timestamptz NOT NULL DEFAULT now()
 *
 * roleはCustomerRole型（'owner'|'staff'|'viewer'）で必須とし、
 * 呼び出し元（招待APIのserver側で"staff"正規化＋
 * isValidCustomerRole()検証済みの値）を常に明示的にINSERTする。
 * DBのDEFAULT 'staff'は、このrole列自体が万一将来省略された場合
 * だけに効くfallbackであり、通常経路では使われない。
 *
 * このINSERTは常に新規行の作成にのみ使う。既存行のroleを
 * 上書きする経路ではない（既存memberのrole変更は専用の
 * role更新APIだけが行う）。
 *
 * ON CONFLICT DO UPDATEは使わない
 * （company_idを無条件に上書きする経路を作らないため）。
 * 通常のINSERTが失敗した場合（重複key・race等）は、
 * 既存行を再SELECTして実際の所属先を確認するだけにとどめる。
 */
export async function insertProfileForCompany(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  companyId: string,
  role: CustomerRole
): Promise<ProfileInsertOutcome> {
  const insertPayload: Record<string, string> = {
    id: userId,
    company_id: companyId,
    role,
  };

  const { error: insertError } = await admin
    .from("profiles")
    .insert(insertPayload);

  if (!insertError) {
    return { outcome: "inserted" };
  }

  // insert失敗時は「危険」と決めつけず、実際の状態を再確認する。
  const {
    data: profile,
    error: selectError,
  } = await admin
    .from("profiles")
    .select("id, company_id")
    .eq("id", userId)
    .maybeSingle();

  if (selectError || !profile) {
    return {
      outcome: "failed",
      error: insertError.message,
    };
  }

  if (profile.company_id === companyId) {
    // 既に(別経路や並行リクエストで)正しいcompany_idで
    // 作成済みだった場合は成功として扱う。
    return { outcome: "already_correct" };
  }

  return { outcome: "other_company" };
}

/*
 * Section 12/13共通：招待メール(新規・再送とも)のredirectTo。
 * NEXT_PUBLIC_APP_URLが未設定ならundefined（Supabase Dashboard側の
 * 既定Site URLへフォールバック）。localhost等はコードへhard-codeしない。
 */
export function getInviteRedirectTo():
  | string
  | undefined {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return appUrl
    ? `${appUrl.replace(/\/$/, "")}/auth/setup-password`
    : undefined;
}
