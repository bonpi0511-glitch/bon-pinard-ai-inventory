import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminUser,
  AdminAuthError,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  listAllAuthUsers,
  insertProfileForCompany,
  getInviteRedirectTo,
  isValidCustomerRole,
} from "@/lib/admin-company-users";

export const runtime = "nodejs";

const EMAIL_FORMAT_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
 * Section 12: 顧客ユーザーの招待。
 *
 * public.profiles.company_id を会社所属の唯一の正データとして扱う
 * （新しいmembershipテーブルは作らない）。
 *
 * 実DB確認結果（2026-09）：
 *   profiles.id / company_id は NOT NULL（company_id=NULLの
 *   正常な行は存在しない）。roleはDEFAULT 'staff'（あくまでDB側の
 *   fallbackであり、下記の通りアプリは常にroleを明示してINSERTする）。
 *   full_nameはNULL可。auth.users → profilesの自動作成trigger無し。
 *   profilesのRLSはSELECT policyのみ（authenticatedからの
 *   UPDATE/INSERTはRLSで拒否される設計）。
 * これを前提に、Adminのservice role経由でのみ
 * {id, company_id, role}でprofilesへINSERTする
 * （insertProfileForCompany()、lib/admin-company-users.ts）。
 *
 * role未指定時の扱い（Section 14）：
 * server側で"staff"へ正規化した上でisValidCustomerRole()による
 * validationを必ず通し、新規profile INSERT時にroleを常に明示する。
 * DB側のDEFAULT 'staff'は不整合時のfallbackとして残すのみで、
 * 通常経路では使われない。
 *
 * 重要な安全設計：
 * Supabase Authへのinviteとprofiles INSERTは1つのPostgres
 * トランザクションにできない。inviteUserByEmail成功後にprofiles
 * INSERTが失敗しても、Auth userはDELETEしない（今回未実装）。
 * その場合はstatus="invited_but_not_linked"を返し、
 * company_id未所属のため既存RLS設計により他社データへは
 * アクセスできない状態のまま運営者へ手動確認を促す。
 *
 * 既存Authユーザーの取り扱い（4ケース）：
 * A) 同emailが既にこの会社に所属 → 何もせず "already_member"
 * B) 同emailが別の会社に所属     → 409で拒否 "other_company"
 *    （profiles.company_idを別会社へUPDATEする経路は存在しない）
 * C) 同emailのprofile行が無い → {id, company_id, role}でINSERT
 * D) 同emailのAuthユーザーが存在しない → inviteUserByEmailで新規招待
 *    → 成功後に{id, company_id, role}でprofiles INSERT
 * いずれの場合も、既存profile行が既にある場合(A/B)はroleを
 * 一切上書きしない。role変更は別途 PATCH
 * /api/admin/company-users/[userId]/role のみが行う。
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

    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    // role省略時はserver側で"staff"へ正規化する
    // （DB DEFAULT 'staff'はfallbackとして残すが、
    // 実際のINSERTでは常にroleを明示する）。
    const roleInput =
      typeof body.role === "string" &&
      body.role.trim()
        ? body.role.trim()
        : "staff";

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "email is required." },
        { status: 400 }
      );
    }

    // 未指定時に正規化された"staff"も含めて、常にvalidationを通す。
    if (!isValidCustomerRole(roleInput)) {
      return NextResponse.json(
        {
          error:
            "role must be one of: owner, staff, viewer.",
        },
        { status: 400 }
      );
    }

    if (!EMAIL_FORMAT_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format." },
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
      .select("id, name")
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

    const allAuthUsers = await listAllAuthUsers();

    const existingAuthUser = allAuthUsers.find(
      (u) => (u.email || "").toLowerCase() === email
    );

    if (existingAuthUser) {
      const {
        data: profile,
        error: profileError,
      } = await admin
        .from("profiles")
        .select("id, company_id")
        .eq("id", existingAuthUser.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (profile) {
        // company_idはNOT NULLのため、既存行はcompanyId一致か
        // 不一致かのどちらかしかない。別会社への自動移籍は行わない。
        if (profile.company_id === companyId) {
          return NextResponse.json({
            status: "already_member",
          });
        }

        return NextResponse.json(
          {
            status: "other_company",
            error:
              "This email address belongs to a different company.",
          },
          { status: 409 }
        );
      }

      // profile行が無い場合、実DBで確認済みのschema
      // ({id, company_id, role}が最小限)に基づき安全にINSERTする。
      // roleInputはこの時点でisValidCustomerRole()検証済みのため、
      // 必ずそのまま渡す（undefinedへ変換しない）。
      const insertResult =
        await insertProfileForCompany(
          admin,
          existingAuthUser.id,
          companyId,
          roleInput
        );

      if (
        insertResult.outcome === "inserted" ||
        insertResult.outcome === "already_correct"
      ) {
        return NextResponse.json({
          status: "linked_existing_profile",
          userId: existingAuthUser.id,
        });
      }

      if (insertResult.outcome === "other_company") {
        return NextResponse.json(
          {
            status: "other_company",
            error:
              "This email address belongs to a different company.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: `Failed to create the profile row: ${insertResult.error}`,
        },
        { status: 500 }
      );
    }

    // ケースD: Authユーザーが存在しない → 新規招待。
    // 仮パスワードは作らず、Supabaseのメール招待方式のみを使う。
    // Section 13の招待受諾・初回パスワード設定画面
    // (app/auth/setup-password/page.tsx) へ着地させる。
    const redirectTo = getInviteRedirectTo();

    const {
      data: inviteData,
      error: inviteError,
    } = await admin.auth.admin.inviteUserByEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    );

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 500 }
      );
    }

    const newUserId = inviteData?.user?.id;

    if (!newUserId) {
      return NextResponse.json(
        {
          error:
            "Invite succeeded but no user id was returned.",
        },
        { status: 500 }
      );
    }

    // inviteUserByEmail自体は既に実行済み（取り消せない副作用）。
    // auth.users → profiles自動作成triggerは無いことを実DBで
    // 確認済みのため、ここで明示的にprofilesへINSERTする。
    // ここから先が失敗しても、招待メール送信をロールバックすることは
    // しない（Auth user削除は今回実装しない）。
    // roleInputはこの時点でisValidCustomerRole()検証済みのため、
    // 必ずそのまま渡す（undefinedへ変換しない）。
    const insertResult = await insertProfileForCompany(
      admin,
      newUserId,
      companyId,
      roleInput
    );

    if (
      insertResult.outcome === "inserted" ||
      insertResult.outcome === "already_correct"
    ) {
      return NextResponse.json({
        status: "invited_and_linked",
        userId: newUserId,
      });
    }

    if (insertResult.outcome === "other_company") {
      // 新規招待したuserIdが既に別companyに紐づいているのは
      // 通常あり得ないが、念のため安全側に倒す。
      return NextResponse.json(
        {
          status: "invited_but_not_linked",
          userId: newUserId,
          warning:
            "The invite email was sent, but this user id is already linked to a different company. Please check manually.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        status: "invited_but_not_linked",
        userId: newUserId,
        warning: `The invite email was sent, but creating the profile row failed: ${insertResult.error}. Please check manually.`,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error(
      "Admin company-users invite error:",
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to invite the user.",
      },
      { status: 500 }
    );
  }
}
