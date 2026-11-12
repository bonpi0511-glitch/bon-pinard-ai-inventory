import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminUser,
  AdminAuthError,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { InitialInventoryImportRow } from "@/lib/initial-import-types";

export const runtime = "nodejs";
export const maxDuration = 120;

/*
 * 初期在庫インポートの最終commit。
 *
 * ここではまだSupabaseへ書き込まず、
 * すべてのバリデーションを終えたら1回のRPC呼び出し
 * (admin_commit_initial_inventory, service_role専用, security definer)
 * へ委ねる。RPC側が1トランザクションとして
 * wines作成 + stock_movements(INITIAL_IMPORT)作成 + batch確定を行い、
 * 途中で1件でも失敗すれば全体がロールバックされる。
 *
 * SALE / ADJUSTMENT / REVERSAL の既存ロジックには一切触れない。
 */
export async function POST(req: NextRequest) {
  let adminUserId: string;

  try {
    const user = await requireAdminUser(req);
    adminUserId = user.id;
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
      body.companyId || ""
    );
    const sourceFilename: string | null =
      body.sourceFilename || null;
    const sourceFileHash: string | null =
      body.sourceFileHash || null;
    const sourceRowCount = Number(
      body.sourceRowCount || 0
    );
    const recognizedWineCount = Number(
      body.recognizedWineCount || 0
    );

    const rows: InitialInventoryImportRow[] =
      Array.isArray(body.rows) ? body.rows : [];

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    /*
     * source_file_hashはDB側(admin_commit_initial_inventory)でも
     * NOT NULL + 64桁hex形式で検証されるが、ここでも早期に
     * 分かりやすいエラーとして弾く（クライアント側のhash生成漏れ・
     * 改変を信用しない）。
     */
    if (
      !sourceFileHash ||
      !/^[0-9a-fA-F]{64}$/.test(sourceFileHash)
    ) {
      return NextResponse.json(
        {
          error:
            "sourceFileHash is required and must be a 64-character hex SHA-256 digest.",
        },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No READY rows were provided to import.",
        },
        { status: 400 }
      );
    }

    // READY以外の行が紛れ込んでいても、ここでもう一度フィルタする
    // （クライアントの状態管理ミスをそのまま信用しない）。
    const readyRows = rows.filter(
      (r) => r.status === "READY"
    );

    if (readyRows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No READY rows were provided to import.",
        },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // companyIdが実在するcompanyかをここでも確認する
    // （bodyのcompanyIdを鵜呑みにしない）。
    const { data: company, error: companyError } =
      await admin
        .from("companies")
        .select("id")
        .eq("id", companyId)
        .maybeSingle();

    if (companyError || !company) {
      return NextResponse.json(
        { error: "Target company not found." },
        { status: 404 }
      );
    }

    const rpcRows = readyRows.map((r) => ({
      producer: r.producer,
      wine_name: r.wine_name,
      cuvee: r.cuvee,
      vintage: r.vintage,
      color: r.color,
      bottle_size_cl: r.bottle_size_cl,
      alcohol_percent: r.alcohol_percent,
      quantity: r.quantity,
      unit_cost_ht: r.unit_cost_ht,
      matched_wine_id: r.matched_wine_id,
      source_sheet: r.source_sheet,
      source_rows: r.source_rows,
    }));

    const { data, error } = await admin.rpc(
      "admin_commit_initial_inventory",
      {
        p_company_id: companyId,
        p_source_filename: sourceFilename,
        p_source_file_hash: sourceFileHash,
        p_source_row_count: sourceRowCount,
        p_recognized_wine_count:
          recognizedWineCount,
        p_imported_by: adminUserId,
        p_rows: rpcRows,
      }
    );

    if (error) {
      // 二重import防止(unique制約 / RPC内チェック)もここに含まれる。
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    const result = Array.isArray(data)
      ? data[0]
      : data;

    return NextResponse.json({
      batchId: result?.batch_id,
      wineCount: result?.wine_count,
      totalBottles: result?.total_bottles,
    });
  } catch (e: any) {
    console.error(
      "Initial inventory import commit error:",
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to commit the initial inventory import.",
      },
      { status: 500 }
    );
  }
}
