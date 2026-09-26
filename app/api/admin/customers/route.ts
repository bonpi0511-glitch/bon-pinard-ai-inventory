import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminUser,
  AdminAuthError,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const MAX_COMPANY_NAME_LENGTH = 200;

/*
 * Section 11「顧客会社管理（運営者専用）」一覧・作成API。
 *
 * 一覧は admin_customer_summary_view（migration側でservice_role専用に
 * REVOKE/GRANT済み）を1回のSELECTで取得することでN+1を避ける。
 *
 * このviewは wines.is_active / inventory_import_batches に依存するため、
 * 20260906_repair_wine_merge_schema.sql と
 * 20260906_initial_inventory_import.sql が未適用の環境では
 * このAPIは失敗する（意図的な設計 - 詳細はmigrationのコメント参照）。
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
      .from("admin_customer_summary_view")
      .select("*")
      .order("company_name", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      customers: data || [],
    });
  } catch (e: any) {
    console.error(
      "Admin customers list error:",
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to load customer companies.",
      },
      { status: 500 }
    );
  }
}

/*
 * 新規顧客会社作成。
 *
 * 同名会社が既にある場合は、confirmDuplicate:trueが
 * bodyに含まれない限り409で警告を返す
 * （ハードなDB制約ではなく、Admin API側の確認フロー）。
 *
 * 実際の作成は admin_create_customer_company() RPC
 * (service_role専用, security definer) へ委任し、
 * companies作成 + company_admin_metadata作成を
 * 1トランザクションで行う。
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

    const companyName = String(
      body.companyName || ""
    ).trim();

    const planName: string | null =
      typeof body.planName === "string" &&
      body.planName.trim()
        ? body.planName.trim()
        : null;

    const initialFeeEur: number | null =
      body.initialFeeEur === null ||
      body.initialFeeEur === undefined ||
      body.initialFeeEur === ""
        ? null
        : Number(body.initialFeeEur);

    const monthlyFeeEur: number | null =
      body.monthlyFeeEur === null ||
      body.monthlyFeeEur === undefined ||
      body.monthlyFeeEur === ""
        ? null
        : Number(body.monthlyFeeEur);

    const internalNotes: string | null =
      typeof body.internalNotes === "string" &&
      body.internalNotes.trim()
        ? body.internalNotes.trim()
        : null;

    const confirmDuplicate = Boolean(
      body.confirmDuplicate
    );

    if (!companyName) {
      return NextResponse.json(
        { error: "companyName is required." },
        { status: 400 }
      );
    }

    if (
      companyName.length > MAX_COMPANY_NAME_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `companyName is too long (max ${MAX_COMPANY_NAME_LENGTH} characters).`,
        },
        { status: 400 }
      );
    }

    if (
      initialFeeEur !== null &&
      !Number.isFinite(initialFeeEur)
    ) {
      return NextResponse.json(
        { error: "initialFeeEur must be a number." },
        { status: 400 }
      );
    }

    if (
      monthlyFeeEur !== null &&
      !Number.isFinite(monthlyFeeEur)
    ) {
      return NextResponse.json(
        { error: "monthlyFeeEur must be a number." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    if (!confirmDuplicate) {
      const { data: existing, error: existingError } =
        await admin
          .from("companies")
          .select("id, name")
          .ilike("name", companyName);

      if (existingError) {
        throw existingError;
      }

      if (existing && existing.length > 0) {
        return NextResponse.json(
          {
            error: "duplicate_name",
            existing,
          },
          { status: 409 }
        );
      }
    }

    const { data, error } = await admin.rpc(
      "admin_create_customer_company",
      {
        p_company_name: companyName,
        p_plan_name: planName,
        p_initial_fee_eur: initialFeeEur,
        p_monthly_fee_eur: monthlyFeeEur,
        p_internal_notes: internalNotes,
      }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const result = Array.isArray(data)
      ? data[0]
      : data;

    return NextResponse.json({
      companyId: result?.company_id,
      companyName: result?.company_name,
      createdAt: result?.created_at,
    });
  } catch (e: any) {
    console.error(
      "Admin customer create error:",
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to create the customer company.",
      },
      { status: 500 }
    );
  }
}
