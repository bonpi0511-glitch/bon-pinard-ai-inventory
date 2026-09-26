import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminUser,
  AdminAuthError,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/*
 * 運営者が「インポート先会社」を選ぶためのcompanies一覧。
 * 一般顧客はこのAPIを一切呼び出せない（非Adminは403）。
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
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("companies")
      .select("id, name")
      .order("name", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      companies: (data || []).map((c: any) => ({
        id: c.id,
        name: c.name || c.id,
      })),
    });
  } catch (e: any) {
    console.error(
      "Admin companies fetch error:",
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to load companies.",
      },
      { status: 500 }
    );
  }
}
