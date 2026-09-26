import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminUser,
  AdminAuthError,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const MAX_COMPANY_NAME_LENGTH = 200;

const ALLOWED_ONBOARDING_STATUSES = [
  "NEW",
  "WAITING_EXCEL",
  "EXCEL_RECEIVED",
  "ANALYZING",
  "READY_TO_IMPORT",
  "IMPORTED",
  "ACTIVE",
];

const ALLOWED_CONTRACT_STATUSES = [
  "PROSPECT",
  "TRIAL",
  "ACTIVE",
  "PAUSED",
  "CANCELLED",
];

/*
 * Section 11の顧客詳細編集API。
 *
 * company_idはURLパラメータでのみ決まり、bodyの値は一切信用しない
 * （company_idの変更手段は存在しない）。
 *
 * companies.name の変更と company_admin_metadata の
 * upsert（company_admin_metadataは既存companyでもまだ行が
 * 無いことがあるため、insertではなくupsertにする）を行う。
 * どちらも単純な単一行更新であり、Section 10の会社作成のような
 * 「複数テーブルへの新規作成」ではないため、専用RPCは用意していない
 * （失敗しても中途半端な新規行が残るリスクが無いため）。
 *
 * DELETEエンドポイントは意図的に実装しない
 * （companiesは多くのFKの親であり、契約終了はcontract_status=
 * CANCELLEDで管理する）。
 */
export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: { companyId: string } }
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

  const companyId = String(
    params?.companyId || ""
  );

  if (!companyId) {
    return NextResponse.json(
      { error: "companyId is required." },
      { status: 400 }
    );
  }

  try {
    const admin = getSupabaseAdmin();

    // companyIdが実在するcompanyかをここでも確認する
    // （URLパラメータを鵜呑みにしない）。
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
        { error: "Company not found." },
        { status: 404 }
      );
    }

    const body = await req.json();

    if (typeof body.companyName === "string") {
      const trimmedName = body.companyName.trim();

      if (!trimmedName) {
        return NextResponse.json(
          {
            error:
              "companyName cannot be empty.",
          },
          { status: 400 }
        );
      }

      if (
        trimmedName.length >
        MAX_COMPANY_NAME_LENGTH
      ) {
        return NextResponse.json(
          {
            error: `companyName is too long (max ${MAX_COMPANY_NAME_LENGTH} characters).`,
          },
          { status: 400 }
        );
      }

      const { error: nameUpdateError } =
        await admin
          .from("companies")
          .update({ name: trimmedName })
          .eq("id", companyId);

      if (nameUpdateError) {
        throw nameUpdateError;
      }
    }

    const metadataPatch: Record<string, any> = {};

    if (body.onboardingStatus !== undefined) {
      if (
        !ALLOWED_ONBOARDING_STATUSES.includes(
          body.onboardingStatus
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid onboardingStatus value.",
          },
          { status: 400 }
        );
      }

      metadataPatch.onboarding_status =
        body.onboardingStatus;
    }

    if (body.contractStatus !== undefined) {
      if (
        !ALLOWED_CONTRACT_STATUSES.includes(
          body.contractStatus
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid contractStatus value.",
          },
          { status: 400 }
        );
      }

      metadataPatch.contract_status =
        body.contractStatus;
    }

    if (body.planName !== undefined) {
      metadataPatch.plan_name =
        typeof body.planName === "string" &&
        body.planName.trim()
          ? body.planName.trim()
          : null;
    }

    if (body.initialFeeEur !== undefined) {
      const parsed =
        body.initialFeeEur === null ||
        body.initialFeeEur === ""
          ? null
          : Number(body.initialFeeEur);

      if (
        parsed !== null &&
        !Number.isFinite(parsed)
      ) {
        return NextResponse.json(
          {
            error:
              "initialFeeEur must be a number.",
          },
          { status: 400 }
        );
      }

      metadataPatch.initial_fee_eur = parsed;
    }

    if (body.monthlyFeeEur !== undefined) {
      const parsed =
        body.monthlyFeeEur === null ||
        body.monthlyFeeEur === ""
          ? null
          : Number(body.monthlyFeeEur);

      if (
        parsed !== null &&
        !Number.isFinite(parsed)
      ) {
        return NextResponse.json(
          {
            error:
              "monthlyFeeEur must be a number.",
          },
          { status: 400 }
        );
      }

      metadataPatch.monthly_fee_eur = parsed;
    }

    if (body.internalNotes !== undefined) {
      metadataPatch.internal_notes =
        typeof body.internalNotes === "string" &&
        body.internalNotes.trim()
          ? body.internalNotes.trim()
          : null;
    }

    if (Object.keys(metadataPatch).length > 0) {
      metadataPatch.company_id = companyId;

      const { error: upsertError } = await admin
        .from("company_admin_metadata")
        .upsert(metadataPatch, {
          onConflict: "company_id",
        });

      if (upsertError) {
        throw upsertError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error(
      "Admin customer update error:",
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to update the customer company.",
      },
      { status: 500 }
    );
  }
}
