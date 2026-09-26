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
 * Section 12: 招待メールの再送。
 *
 * 対象は「既にこの会社のprofileを持つが、まだメール未確認の
 * Authユーザー」だけに限定する。
 *
 * - profiles / company_id は一切変更しない
 * - 新しいprofile行は作らない
 * - Auth userのDELETE/再作成は行わない
 * - 既に確認済み(email_confirmed_at設定済み)のユーザーへは送らない
 * - 別会社に所属するユーザーへは送らない（client入力のcompanyIdを
 *   鵜呑みにせず、server側でprofile.company_idと突き合わせて検証する）
 *
 * 実際に送信するのは、既存のinviteUserByEmail()の再呼び出しのみ
 * （supabase-js公式Admin API。node_modules/@supabase/auth-js/dist/main/
 * GoTrueAdminApi.js のドキュメントコメントで、この方式はPKCEを
 * 使わない実装（invite受諾ブラウザが送信元と異なり得るため）である
 * ことを確認済み。app/auth/setup-password側の実装とも整合する）。
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

    // 対象ユーザーのAuth情報（email / email_confirmed_at）を確認する。
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

    if (authUser.emailConfirmedAt) {
      return NextResponse.json(
        {
          status: "already_confirmed",
          error:
            "This user has already confirmed their email; the invite cannot be resent.",
        },
        { status: 409 }
      );
    }

    const redirectTo = getInviteRedirectTo();

    const { error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(
        authUser.email,
        redirectTo ? { redirectTo } : undefined
      );

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "resent",
      userId,
    });
  } catch (e: any) {
    console.error(
      "Admin company-users resend-invite error:",
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to resend the invite.",
      },
      { status: 500 }
    );
  }
}
