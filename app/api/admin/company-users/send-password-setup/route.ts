import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminUser,
  AdminAuthError,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  listAllAuthUsers,
  getInviteRedirectTo,
} from "@/lib/admin-company-users";

export const runtime = "nodejs";

/*
 * Section 12: メール確認済みユーザーへの「パスワード設定リンク」送信。
 *
 * 「メール確認済み」と「password設定完了」は同一視できない
 * （招待は受諾済み＝メール確認済みだが、setup-password画面で
 * updateUser({password})まで完了していないユーザーがあり得る）。
 * そのため、招待の再送（/invite、type=invite）とは別に、
 * Supabase公式のパスワードリカバリーメール
 * （resetPasswordForEmail、type=recovery）を使う。
 *
 * Admin側でpasswordを指定・生成することは一切しない
 * （resetPasswordForEmailはメールリンクを送るだけで、
 * パスワード自体はユーザー本人がsetup-password画面で
 * updateUser({password})を呼んで初めて設定される）。
 *
 * clientから渡されたuserId/companyIdは信用せず、
 * - company実在確認
 * - profile実在確認
 * - profile.company_id === companyId の一致確認（別会社なら409）
 * - Auth user実在確認・emailはserver側で取得（clientのemailは使わない）
 * をすべてserver側で行う。
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdminUser(req);
  } catch (e: any) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json(
        { error: e.message },
        { status: e.status }
      );
    }

    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    const companyId = String(
      body.companyId || body.company_id || ""
    ).trim();

    const userId = String(
      body.userId || body.user_id || ""
    ).trim();

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // companyIdが実在するcompanyかをここでも確認する
    // （クライアントの入力を鵜呑みにしない）。
    const {
      data: company,
      error: companyError,
    } = await admin
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      throw companyError;
    }

    if (!company) {
      return NextResponse.json(
        { error: "Target company not found." },
        { status: 404 }
      );
    }

    // profile.company_idが本当にこのcompanyかをserver側で再検証する。
    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id, company_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return NextResponse.json(
        {
          error:
            "No profile row was found for this user.",
        },
        { status: 404 }
      );
    }

    if (profile.company_id !== companyId) {
      return NextResponse.json(
        {
          status: "other_company",
          error:
            "This user belongs to a different company.",
        },
        { status: 409 }
      );
    }

    // Auth userの実メールアドレスをserver側で取得する
    // （clientから渡されたemail値は一切使わない）。
    const allAuthUsers = await listAllAuthUsers();

    const authUser = allAuthUsers.find(
      (u) => u.id === userId
    );

    if (!authUser || !authUser.email) {
      return NextResponse.json(
        {
          error:
            "No matching Auth user was found for this profile.",
        },
        { status: 404 }
      );
    }

    const redirectTo = getInviteRedirectTo();

    // パスワードはここでは一切指定・生成しない。
    // ユーザー本人がメールのリンクから
    // /auth/setup-password（type=recovery）を経由して
    // updateUser({password})を呼ぶまで、パスワードは変更されない。
    const { error: resetError } =
      await admin.auth.resetPasswordForEmail(
        authUser.email,
        redirectTo ? { redirectTo } : undefined
      );

    if (resetError) {
      return NextResponse.json(
        { error: resetError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "sent",
      userId,
    });
  } catch (e: any) {
    console.error(
      "Admin company-users send-password-setup error:",
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to send the password setup email.",
      },
      { status: 500 }
    );
  }
}
