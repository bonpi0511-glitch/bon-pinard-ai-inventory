import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminUser,
  AdminAuthError,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isValidCustomerRole } from "@/lib/admin-company-users";

export const runtime = "nodejs";

/*
 * Section 14: 既存顧客ユーザーのrole変更（運営者Admin専用）。
 *
 * company_idは絶対に変更しない（このエンドポイントはroleのみを
 * 更新する。別companyへの移動はここからは一切できない）。
 *
 * 最後のowner保護：対象ユーザーの現在のroleが'owner'で、
 * 変更後のroleが'owner'以外の場合、同じcompanyに他のownerが
 * いなければ拒否する（会社がowner不在になることを防ぐ）。
 * ただし「会社には必ずownerが存在する」というDB制約はまだ
 * 作らない（オンボーディング中の会社でowner未割当のケースが
 * 実際に存在するため）。
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
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

  const userId = String(params?.userId || "");

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required." },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();

    const companyId = String(
      body.companyId || body.company_id || ""
    ).trim();

    const role = String(body.role || "").trim();

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    if (!isValidCustomerRole(role)) {
      return NextResponse.json(
        {
          error:
            "role must be one of: owner, staff, viewer.",
        },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // companyIdが実在するcompanyかをここでも確認する。
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

    // profileが実在し、対象companyに所属しているかを再検証する
    // （client入力のcompanyIdを鵜呑みにしない）。
    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id, company_id, role")
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

    // 最後のowner保護：owner → owner以外への変更のときだけ判定する。
    if (
      profile.role === "owner" &&
      role !== "owner"
    ) {
      const {
        data: otherOwners,
        error: ownersError,
      } = await admin
        .from("profiles")
        .select("id")
        .eq("company_id", companyId)
        .eq("role", "owner")
        .neq("id", userId);

      if (ownersError) {
        throw ownersError;
      }

      if (!otherOwners || otherOwners.length === 0) {
        return NextResponse.json(
          {
            status: "last_owner",
            error:
              "Cannot change this user's role: they are the only owner of this company.",
          },
          { status: 409 }
        );
      }
    }

    // company_idには一切触れず、roleだけを更新する。
    const { error: updateError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      status: "updated",
      userId,
      role,
    });
  } catch (e: any) {
    console.error(
      "Admin company-users role update error:",
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to update the user's role.",
      },
      { status: 500 }
    );
  }
}
