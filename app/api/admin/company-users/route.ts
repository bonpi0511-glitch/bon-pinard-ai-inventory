import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminUser,
  AdminAuthError,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  listAllAuthUsers,
  classifyAuthUserStatus,
} from "@/lib/admin-company-users";

export const runtime = "nodejs";

/*
 * Section 12: 指定companyIdに所属するユーザー一覧。
 *
 * public.profiles.company_id を会社所属の正データとして使い
 * （新しいmembershipテーブルは作らない）、Supabase Auth Admin API
 * (service_role専用) から取得したユーザー情報とメモリ上でmergeする。
 *
 * N+1を避けるため、ユーザーごとにauth.admin.getUserById()を
 * 呼び出すのではなく、listAllAuthUsers()で全ユーザーを1度だけ
 * ページングして取得し、company所属のprofile idと突き合わせる。
 */
export async function GET(req: NextRequest) {
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
    const companyId = (
      req.nextUrl.searchParams.get("companyId") ||
      ""
    ).trim();

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

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
        { error: "Company not found." },
        { status: 404 }
      );
    }

    const {
      data: profileRows,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id, company_id, role")
      .eq("company_id", companyId);

    if (profileError) {
      throw profileError;
    }

    if (!profileRows || profileRows.length === 0) {
      return NextResponse.json({
        companyId: company.id,
        companyName: company.name,
        users: [],
      });
    }

    const allAuthUsers = await listAllAuthUsers();

    const authUsersById = new Map(
      allAuthUsers.map((u) => [u.id, u])
    );

    const users = profileRows.map((p: any) => {
      const authUser = authUsersById.get(p.id);

      const status = authUser
        ? classifyAuthUserStatus(authUser)
        : "UNKNOWN";

      return {
        userId: p.id,
        role: p.role,
        email: authUser?.email || null,
        createdAt: authUser?.createdAt || null,
        emailConfirmedAt:
          authUser?.emailConfirmedAt || null,
        lastSignInAt:
          authUser?.lastSignInAt || null,
        status,
      };
    });

    return NextResponse.json({
      companyId: company.id,
      companyName: company.name,
      users,
    });
  } catch (e: any) {
    console.error(
      "Admin company-users list error:",
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to load company users.",
      },
      { status: 500 }
    );
  }
}
