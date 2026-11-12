import { NextRequest, NextResponse } from "next/server";
import { randomUUID, createHash } from "crypto";
import * as XLSX from "xlsx";
import OpenAI from "openai";
import { z } from "zod";
import {
  requireAdminUser,
  AdminAuthError,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type {
  InitialInventoryImportRow,
  InitialImportRowStatus,
  InitialImportSummary,
} from "@/lib/initial-import-types";
import {
  normalizeImportSearchText,
  normalizeImportColor,
  normalizeImportVintage,
  normalizeImportBottleSizeCl,
  normalizeImportQuantity,
  normalizeImportUnitCost,
  looksLikeNonWineRow,
  isNonWineFinancialRow,
} from "@/lib/initial-import-normalize";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_SHEETS = 20;

/*
 * "AVOIR FINANCIER"等、会計・送料・値引き調整行をSKIPと判定した際の
 * 補足メッセージ。既存の他の警告文と同様、これ自体はDBへ保存されず
 * プレビュー表示専用。クライアントのappLanguageをformDataで受け取り
 * 言語を選ぶ（未指定時はEN）。
 */
const NON_WINE_ROW_WARNING: Record<string, string> = {
  JA: "ワインではない会計行としてスキップ",
  FR: "Ligne comptable non liée à un vin — ignorée",
  EN: "Non-wine financial row skipped",
};
const MAX_ROWS_PER_SHEET = 5000;
const STRUCTURE_SAMPLE_ROWS = 20;
const FALLBACK_CHUNK_SIZE = 100;
const MAX_FALLBACK_ROWS = 1000;

type CellMatrix = (string | number | null)[][];

/*
 * 第1段階：シート構造・ヘッダー・列マッピングのAI判定。
 */
const ColumnMappingSchema = z.object({
  producer: z.number().int().nullable().default(null),
  wine_name: z.number().int().nullable().default(null),
  cuvee: z.number().int().nullable().default(null),
  vintage: z.number().int().nullable().default(null),
  color: z.number().int().nullable().default(null),
  bottle_size: z.number().int().nullable().default(null),
  alcohol: z.number().int().nullable().default(null),
  quantity: z.number().int().nullable().default(null),
  unit_cost_ht: z.number().int().nullable().default(null),
});

const SheetMappingSchema = z.object({
  sheet_name: z.string(),
  is_wine_sheet: z.boolean().default(false),
  header_row_index: z
    .number()
    .int()
    .nullable()
    .default(null),
  column_mapping: ColumnMappingSchema.default({
    producer: null,
    wine_name: null,
    cuvee: null,
    vintage: null,
    color: null,
    bottle_size: null,
    alcohol: null,
    quantity: null,
    unit_cost_ht: null,
  }),
  currency_hint: z.string().default("unknown"),
  notes: z.string().default(""),
});

const StructureResultSchema = z.object({
  sheets: z.array(SheetMappingSchema).default([]),
});

/*
 * 第2段階（フォールバック）：AIが列構造を判定できなかった行を
 * chunk単位でそのままAIへ渡し、直接ワイン明細として抽出する。
 */
const FallbackItemSchema = z.object({
  line_index: z.number().int(),
  is_wine_row: z.boolean().default(true),
  producer: z.string().default(""),
  wine_name: z.string().default(""),
  cuvee: z.string().default(""),
  vintage: z.string().default(""),
  color: z.string().default("unknown"),
  bottle_size_cl: z.number().nullable().default(null),
  alcohol_percent: z.string().default(""),
  quantity: z.number().nullable().default(null),
  unit_cost_ht: z.number().nullable().default(null),
  warnings: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0),
});

const FallbackResultSchema = z.object({
  items: z.array(FallbackItemSchema).default([]),
});

function getTextFromResponse(response: any): string {
  if (response.output_text) {
    return response.output_text;
  }

  return (response.output || [])
    .flatMap((o: any) => o.content || [])
    .filter((c: any) => c.type === "output_text")
    .map((c: any) => c.text)
    .join("");
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, 60);
}

/*
 * merged cellの値を範囲内の全セルへ補完する。
 * sheet_to_json({header:1}) は結合セルの左上以外をnullにするため、
 * 列マッピングがずれないよう、可能な範囲で値を埋めておく。
 */
function fillMergedCells(
  matrix: CellMatrix,
  sheet: XLSX.WorkSheet
) {
  const merges = (sheet["!merges"] || []) as Array<{
    s: { r: number; c: number };
    e: { r: number; c: number };
  }>;

  for (const merge of merges) {
    const topValue =
      matrix[merge.s.r]?.[merge.s.c] ?? null;

    for (let r = merge.s.r; r <= merge.e.r; r++) {
      if (!matrix[r]) matrix[r] = [];

      for (let c = merge.s.c; c <= merge.e.c; c++) {
        const current = matrix[r][c];

        if (
          current === null ||
          current === undefined ||
          current === ""
        ) {
          matrix[r][c] = topValue;
        }
      }
    }
  }
}

function readWorkbook(
  buffer: Buffer,
  filename: string
): XLSX.WorkBook {
  const isCsv = /\.csv$/i.test(filename);

  if (isCsv) {
    const text = buffer.toString("utf-8");
    return XLSX.read(text, { type: "string" });
  }

  return XLSX.read(buffer, { type: "buffer" });
}

function buildStructureSample(
  matrix: CellMatrix,
  sheetName: string
) {
  const sampleRows = matrix
    .slice(0, STRUCTURE_SAMPLE_ROWS)
    .map((row, idx) => {
      const cells = (row || [])
        .map((cell, colIdx) =>
          `${colIdx}:${cellToText(cell)}`
        )
        .join(" | ");
      return `row ${idx}: ${cells}`;
    })
    .join("\n");

  return `Sheet "${sheetName}" (${matrix.length} rows total):\n${sampleRows}`;
}

async function detectStructure(
  client: OpenAI,
  sheets: Array<{ name: string; matrix: CellMatrix }>
) {
  const samples = sheets
    .map((s) => buildStructureSample(s.matrix, s.name))
    .join("\n\n---\n\n");

  const prompt = `
You are analyzing a wine inventory spreadsheet uploaded by a new
restaurant/wine-bar customer. Every customer uses a different layout:
different languages (English, French, Japanese...), different column
order, extra title rows, subtotal rows, region/color section headers,
blank rows, etc.

For EACH sheet below, decide:

1. "is_wine_sheet": does this sheet contain a wine inventory list at all?
   (false for cover pages, instructions, unrelated data, etc.)

2. "header_row_index": the 0-based row index (from the sample) that
   contains the column headers. null if there is no clear header row
   (data may still start immediately without headers).

3. "column_mapping": for each field below, the 0-based COLUMN index
   in that sheet that holds it, or null if that field is not present
   as its own column. A single column may only be used for one field.

   - producer: producer / winery / domaine / maison / 生産者
   - wine_name: main wine name / cuvée / appellation as printed /
     ワイン名 / Appellation / Domaine (when it doubles as the wine name)
   - cuvee: a SEPARATE cuvée/lieu-dit column, if one exists in
     addition to wine_name (else null)
   - vintage: vintage / millésime / année / 年 / vintage year
   - color: wine color (red/white/rosé/sparkling) if it has its own
     column
   - bottle_size: bottle size / format / contenance / 容量
   - alcohol: alcohol % / degré / 度数
   - quantity: bottle count / stock / qty / 本数 / quantité
   - unit_cost_ht: unit cost excl. tax / prix d'achat HT / PA HT / 仕入値

4. "currency_hint": "EUR" if you can tell the prices are in Euros,
   otherwise your best guess (e.g. "USD", "JPY"), or "unknown".

5. "notes": one short sentence about anything unusual (merged
   headers, multiple sub-tables, etc.).

Do not invent columns that are not really there. If a field has no
dedicated column, set it to null - do not guess a column just to fill
every field.

SHEETS:

${samples}

Return JSON only, matching exactly this shape:
{"sheets":[{"sheet_name":"","is_wine_sheet":true,"header_row_index":0,"column_mapping":{"producer":null,"wine_name":null,"cuvee":null,"vintage":null,"color":null,"bottle_size":null,"alcohol":null,"quantity":null,"unit_cost_ht":null},"currency_hint":"EUR","notes":""}]}
  `.trim();

  const response = await client.responses.create({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4.1",
    input: [{ role: "user", content: prompt }],
    text: { format: { type: "json_object" } },
  });

  const text = getTextFromResponse(response);
  return StructureResultSchema.parse(JSON.parse(text));
}

async function normalizeFallbackChunk(
  client: OpenAI,
  lines: Array<{ lineIndex: number; text: string }>
) {
  const body = lines
    .map((l) => `[${l.lineIndex}] ${l.text}`)
    .join("\n");

  const prompt = `
These are raw rows extracted from a customer's wine inventory
spreadsheet. The spreadsheet layout could not be automatically
mapped to columns, so you are given each row as raw text instead.

For EACH numbered row below, decide if it describes a real wine
bottle entry ("is_wine_row": true) or if it is something else
(title, subtotal/total row, section/region heading, blank/garbage
row, column header repeated mid-sheet) - in that case set
"is_wine_row": false and leave the other fields empty/null.

For real wine rows, extract:
- producer, wine_name, cuvee, vintage, color (Red/White/Rose/
  Sparkling/unknown), bottle_size_cl (in cl, e.g. 75 for a standard
  bottle; null if you cannot tell), alcohol_percent, quantity
  (integer bottle count), unit_cost_ht (excl. tax, in the currency
  as written - do not convert TTC to HT yourself unless the VAT
  rate is explicitly given in the text).

RULES
- Do not invent information that is not in the text.
- If vintage is unclear, use "".
- If quantity is unclear, use null (never guess a number).
- If unit_cost_ht is unclear, use null.
- Quantity is always a non-negative integer bottle count.
- Put anything you are unsure about into "warnings" as a short note.
- "confidence" reflects how confident you are in the full row
  (producer + wine name + vintage + quantity together).

ROWS:

${body}

Return JSON only, matching exactly this shape:
{"items":[{"line_index":0,"is_wine_row":true,"producer":"","wine_name":"","cuvee":"","vintage":"","color":"unknown","bottle_size_cl":null,"alcohol_percent":"","quantity":null,"unit_cost_ht":null,"warnings":[],"confidence":0}]}
  `.trim();

  const response = await client.responses.create({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4.1",
    input: [{ role: "user", content: prompt }],
    text: { format: { type: "json_object" } },
  });

  const text = getTextFromResponse(response);
  return FallbackResultSchema.parse(JSON.parse(text));
}

function buildRowFromMapping(
  cells: (string | number | null)[],
  mapping: z.infer<typeof ColumnMappingSchema>,
  sheetName: string,
  excelRowNumber: number,
  currencyHint: string,
  lang: string
): InitialInventoryImportRow {
  const get = (colIndex: number | null) =>
    colIndex === null || colIndex === undefined
      ? null
      : cells[colIndex] ?? null;

  const producer = String(
    get(mapping.producer) ?? ""
  ).trim();

  const wineNameRaw = String(
    get(mapping.wine_name) ?? ""
  ).trim();

  const cuvee = String(
    get(mapping.cuvee) ?? ""
  ).trim();

  const vintage = normalizeImportVintage(
    get(mapping.vintage)
  );

  const color = normalizeImportColor(
    get(mapping.color)
  );

  const bottleSize = normalizeImportBottleSizeCl(
    get(mapping.bottle_size)
  );

  const alcohol = String(
    get(mapping.alcohol) ?? ""
  ).trim();

  const quantity = normalizeImportQuantity(
    get(mapping.quantity)
  );

  const unitCost = normalizeImportUnitCost(
    get(mapping.unit_cost_ht)
  );

  const rawText = cells
    .filter(
      (c) =>
        c !== null &&
        c !== undefined &&
        String(c).trim() !== ""
    )
    .map((c) => String(c).trim())
    .join(" | ");

  const warnings: string[] = [];

  const upperCurrency = (
    currencyHint || "unknown"
  ).toUpperCase();

  if (
    upperCurrency !== "EUR" &&
    upperCurrency !== "UNKNOWN"
  ) {
    warnings.push(
      `Currency looks like ${currencyHint}, not EUR.`
    );
  }

  const hasWineName = Boolean(
    wineNameRaw || cuvee
  );
  const hasProducer = Boolean(producer);

  /*
   * "AVOIR FINANCIER"のような会計・送料・値引き調整行は、
   * ワイン情報が壊れているINVALIDではなく、対象外のSKUPとして扱う。
   * producer/quantity/vintageが揃っていない、という複数の状況証拠と
   * キーワード一致を組み合わせてから判定するため、単語が偶然含まれる
   * だけの実在ワイン名を誤ってSKIPにすることはない
   * （isNonWineFinancialRow内部で判定）。
   */
  const isFinancialRow = isNonWineFinancialRow({
    wineName: wineNameRaw,
    cuvee,
    producer,
    vintage,
    quantity,
    rawText,
  });

  let status: InitialImportRowStatus;

  if (
    looksLikeNonWineRow(rawText) ||
    isFinancialRow ||
    (!hasWineName && !hasProducer)
  ) {
    status = "SKIP";

    if (isFinancialRow) {
      warnings.push(
        NON_WINE_ROW_WARNING[lang] ||
          NON_WINE_ROW_WARNING.EN
      );
    }
  } else if (quantity === null) {
    status = "INVALID";
    warnings.push(
      "Quantity could not be read from this row."
    );
  } else if (quantity === 0) {
    status = "SKIP";
  } else if (!hasWineName) {
    status = "REVIEW";
    warnings.push("Wine name is missing.");
  } else {
    status = "READY";
  }

  let confidence = 0.9;
  if (!hasProducer) confidence -= 0.2;
  if (!vintage) confidence -= 0.05;
  if (bottleSize === null) confidence -= 0.05;
  if (unitCost === null) confidence -= 0.05;
  confidence = Math.max(0, Math.min(0.99, confidence));

  if (status === "READY" && confidence < 0.6) {
    status = "REVIEW";
    warnings.push("Low confidence; please double-check.");
  }

  return {
    row_id: randomUUID(),
    source_sheet: sheetName,
    source_rows: [excelRowNumber],
    producer,
    wine_name: wineNameRaw || cuvee,
    cuvee,
    vintage,
    color,
    bottle_size_cl: bottleSize,
    alcohol_percent: alcohol,
    quantity,
    unit_cost_ht: unitCost,
    raw_text: rawText,
    confidence,
    warnings,
    status,
    matched_wine_id: null,
    matched_wine_label: null,
    duplicate_of_row_id: null,
  };
}

function buildRowFromFallbackItem(
  item: z.infer<typeof FallbackItemSchema>,
  sheetName: string,
  excelRowNumber: number,
  rawText: string,
  lang: string
): InitialInventoryImportRow {
  const producer = item.producer.trim();
  const wineName = item.wine_name.trim();
  const cuvee = item.cuvee.trim();
  const vintage = normalizeImportVintage(
    item.vintage
  );
  const color = normalizeImportColor(item.color);
  const quantity =
    item.quantity !== null
      ? normalizeImportQuantity(item.quantity)
      : null;

  const warnings = [...item.warnings];

  const hasWineName = Boolean(
    wineName || cuvee
  );
  const hasProducer = Boolean(producer);

  const isFinancialRow = isNonWineFinancialRow({
    wineName,
    cuvee,
    producer,
    vintage,
    quantity,
    rawText,
  });

  let status: InitialImportRowStatus;

  if (!item.is_wine_row || isFinancialRow) {
    status = "SKIP";

    if (isFinancialRow) {
      warnings.push(
        NON_WINE_ROW_WARNING[lang] ||
          NON_WINE_ROW_WARNING.EN
      );
    }
  } else if (quantity === null) {
    status = "INVALID";
    warnings.push(
      "Quantity could not be read from this row."
    );
  } else if (quantity === 0) {
    status = "SKIP";
  } else if (!hasWineName && !hasProducer) {
    status = "SKIP";
  } else if (!hasWineName) {
    status = "REVIEW";
    warnings.push("Wine name is missing.");
  } else {
    status =
      item.confidence >= 0.6 ? "READY" : "REVIEW";
  }

  return {
    row_id: randomUUID(),
    source_sheet: sheetName,
    source_rows: [excelRowNumber],
    producer,
    wine_name: wineName || cuvee,
    cuvee,
    vintage,
    color,
    bottle_size_cl: item.bottle_size_cl,
    alcohol_percent: item.alcohol_percent.trim(),
    quantity,
    unit_cost_ht: item.unit_cost_ht,
    raw_text: rawText,
    confidence: item.confidence,
    warnings,
    status,
    matched_wine_id: null,
    matched_wine_label: null,
    duplicate_of_row_id: null,
  };
}

function duplicateKey(
  row: InitialInventoryImportRow
): string {
  return [
    normalizeImportSearchText(row.producer),
    normalizeImportSearchText(row.wine_name),
    normalizeImportSearchText(row.cuvee),
    row.vintage,
    String(row.bottle_size_cl ?? ""),
  ].join("|");
}

/*
 * ファイル内の表記揺れ（同じワインが複数行に分かれている等）を検出する。
 *
 * producer/wine_name/cuvee/vintage/bottle_size_cl が完全一致するグループのみ対象
 * （既存のワイン統合機能のような曖昧類似度スコアリングはここでは行わない）。
 * 全行が十分な自信を持つ場合だけ自動統合（数量合算＋数量加重平均原価）し、
 * それ以外はDUPLICATEとして運営者の確認に委ねる。
 */
function dedupeWithinFile(
  rows: InitialInventoryImportRow[]
): InitialInventoryImportRow[] {
  const groups = new Map<
    string,
    InitialInventoryImportRow[]
  >();

  for (const row of rows) {
    if (
      row.status === "SKIP" ||
      row.status === "INVALID"
    ) {
      continue;
    }

    const key = duplicateKey(row);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const handled = new Set<string>();
  const result: InitialInventoryImportRow[] = [];

  for (const row of rows) {
    if (handled.has(row.row_id)) continue;

    if (
      row.status === "SKIP" ||
      row.status === "INVALID"
    ) {
      result.push(row);
      continue;
    }

    const key = duplicateKey(row);
    const group = groups.get(key) || [row];

    if (group.length < 2) {
      handled.add(row.row_id);
      result.push(row);
      continue;
    }

    const allConfident = group.every(
      (r) =>
        r.confidence >= 0.6 && r.quantity !== null
    );

    if (allConfident) {
      const totalQty = group.reduce(
        (sum, r) => sum + (r.quantity || 0),
        0
      );

      const weightedCostSum = group.reduce(
        (sum, r) =>
          sum +
          (r.unit_cost_ht || 0) * (r.quantity || 0),
        0
      );

      const avgCost =
        totalQty > 0
          ? Math.round(
              (weightedCostSum / totalQty) * 100
            ) / 100
          : group[0].unit_cost_ht;

      const merged: InitialInventoryImportRow = {
        ...group[0],
        quantity: totalQty,
        unit_cost_ht: avgCost,
        source_rows: group.flatMap(
          (r) => r.source_rows
        ),
        warnings: Array.from(
          new Set(
            group.flatMap((r) => r.warnings)
          )
        ).concat([
          `Merged ${group.length} matching rows found within this file.`,
        ]),
      };

      group.forEach((r) => handled.add(r.row_id));
      result.push(merged);
    } else {
      group.forEach((r) => {
        handled.add(r.row_id);
        result.push({
          ...r,
          status: "DUPLICATE",
          warnings: [
            ...r.warnings,
            `Possible duplicate of ${group.length - 1} other row(s) in this file - please review.`,
          ],
        });
      });
    }
  }

  return result;
}

function computeSummary(
  rows: InitialInventoryImportRow[],
  sourceRowCount: number
): InitialImportSummary {
  const recognized = rows.length;
  const unique = rows.filter(
    (r) =>
      r.status !== "SKIP" && r.status !== "INVALID"
  ).length;

  const totalBottles = rows.reduce(
    (sum, r) =>
      r.status === "READY" || r.status === "REVIEW"
        ? sum + (r.quantity || 0)
        : sum,
    0
  );

  const count = (status: InitialImportRowStatus) =>
    rows.filter((r) => r.status === status).length;

  return {
    sourceRowCount,
    recognizedWineCount: recognized,
    uniqueWineCount: unique,
    totalBottles,
    readyCount: count("READY"),
    reviewCount: count("REVIEW"),
    duplicateCount: count("DUPLICATE"),
    invalidCount: count("INVALID"),
    skipCount: count("SKIP"),
  };
}

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
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is missing. Please set it in .env.local.",
        },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const companyId = String(
      form.get("companyId") || ""
    );

    /*
     * プレビュー警告文の言語（例："AVOIR FINANCIER"のような
     * 非ワイン会計行をSKIPにした際の補足メッセージ）。
     * クライアントのappLanguageをそのまま渡してもらう想定で、
     * 未指定/未対応言語ならENにフォールバックする。
     */
    const lang = String(
      form.get("lang") || "EN"
    ).toUpperCase();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded." },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `File is too large (max ${Math.round(
            MAX_FILE_BYTES / (1024 * 1024)
          )}MB).`,
        },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: company, error: companyError } =
      await admin
        .from("companies")
        .select("id, name")
        .eq("id", companyId)
        .maybeSingle();

    if (companyError || !company) {
      return NextResponse.json(
        { error: "Target company not found." },
        { status: 404 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = createHash("sha256")
      .update(buffer)
      .digest("hex");

    let workbook: XLSX.WorkBook;

    try {
      workbook = readWorkbook(buffer, file.name);
    } catch (parseError: any) {
      return NextResponse.json(
        {
          error: `Could not read this file as Excel/CSV: ${
            parseError?.message || "unknown error"
          }`,
        },
        { status: 400 }
      );
    }

    const sheetNames = workbook.SheetNames.slice(
      0,
      MAX_SHEETS
    );

    const sheets = sheetNames.map((name) => {
      const sheet = workbook.Sheets[name];

      const matrix = XLSX.utils.sheet_to_json(
        sheet,
        { header: 1, defval: null }
      ) as CellMatrix;

      fillMergedCells(matrix, sheet);

      return {
        name,
        matrix: matrix.slice(
          0,
          MAX_ROWS_PER_SHEET
        ),
      };
    });

    let sourceRowCount = 0;
    for (const s of sheets) {
      sourceRowCount += s.matrix.length;
    }

    const client = new OpenAI({ apiKey });

    const structure = await detectStructure(
      client,
      sheets
    );

    const structureBySheet = new Map(
      structure.sheets.map((s) => [
        s.sheet_name,
        s,
      ])
    );

    let allRows: InitialInventoryImportRow[] = [];
    const fallbackTargets: Array<{
      sheetName: string;
      lineIndex: number;
      excelRowNumber: number;
      rawText: string;
    }> = [];

    for (const sheet of sheets) {
      const mappingInfo = structureBySheet.get(
        sheet.name
      );

      const mapping = mappingInfo?.column_mapping;

      const mappingIsUsable = Boolean(
        mappingInfo?.is_wine_sheet &&
          mapping &&
          (mapping.producer !== null ||
            mapping.wine_name !== null) &&
          typeof mappingInfo?.header_row_index ===
            "number"
      );

      if (mappingIsUsable && mapping) {
        const headerRowIndex =
          mappingInfo!.header_row_index as number;

        for (
          let r = headerRowIndex + 1;
          r < sheet.matrix.length;
          r++
        ) {
          const cells = sheet.matrix[r] || [];

          const hasAnyValue = cells.some(
            (c) =>
              c !== null &&
              c !== undefined &&
              String(c).trim() !== ""
          );

          if (!hasAnyValue) continue;

          const row = buildRowFromMapping(
            cells,
            mapping,
            sheet.name,
            r + 1,
            mappingInfo?.currency_hint || "unknown",
            lang
          );

          allRows.push(row);
        }
      } else if (
        mappingInfo?.is_wine_sheet !== false
      ) {
        // マッピングが取れなかったシートは、行ごとそのまま
        // フォールバックAI正規化の対象として集める。
        for (
          let r = 0;
          r < sheet.matrix.length;
          r++
        ) {
          const cells = sheet.matrix[r] || [];

          const rawText = cells
            .filter(
              (c) =>
                c !== null &&
                c !== undefined &&
                String(c).trim() !== ""
            )
            .map((c) => String(c).trim())
            .join(" | ");

          if (!rawText) continue;

          if (
            fallbackTargets.length >=
            MAX_FALLBACK_ROWS
          ) {
            continue;
          }

          fallbackTargets.push({
            sheetName: sheet.name,
            lineIndex: fallbackTargets.length,
            excelRowNumber: r + 1,
            rawText,
          });
        }
      }
    }

    for (
      let i = 0;
      i < fallbackTargets.length;
      i += FALLBACK_CHUNK_SIZE
    ) {
      const chunk = fallbackTargets.slice(
        i,
        i + FALLBACK_CHUNK_SIZE
      );

      const result = await normalizeFallbackChunk(
        client,
        chunk.map((c) => ({
          lineIndex: c.lineIndex,
          text: c.rawText,
        }))
      );

      for (const item of result.items) {
        const target = chunk.find(
          (c) => c.lineIndex === item.line_index
        );

        if (!target) continue;

        if (!item.is_wine_row) continue;

        allRows.push(
          buildRowFromFallbackItem(
            item,
            target.sheetName,
            target.excelRowNumber,
            target.rawText,
            lang
          )
        );
      }
    }

    allRows = dedupeWithinFile(allRows);

    /*
     * 統合済み(is_active=false)・統合先(merged_into_wine_id有り)の
     * ワインは既存候補として提示しない。matched_wine_idとして
     * 選ばれてしまうと、admin_commit_initial_inventory()側の
     * DB検証で拒否されるだけでなく、そもそも運営者に無効なワインを
     * 選ばせないようにするための予防策。
     */
    const { data: existingWines } = await admin
      .from("wines")
      .select(
        "id, producer, wine_name, cuvee, vintage, bottle_size_cl"
      )
      .eq("company_id", companyId)
      .eq("is_active", true)
      .is("merged_into_wine_id", null);

    const existingIndex = new Map<
      string,
      { id: string; label: string }
    >();

    for (const w of existingWines || []) {
      const key = [
        normalizeImportSearchText(w.producer),
        normalizeImportSearchText(w.wine_name),
        normalizeImportSearchText(w.cuvee),
        w.vintage || "",
        String(w.bottle_size_cl ?? ""),
      ].join("|");

      existingIndex.set(key, {
        id: w.id,
        label: `${w.producer || ""} ${
          w.wine_name || ""
        } ${w.vintage || ""}`.trim(),
      });
    }

    allRows = allRows.map((row) => {
      if (
        row.status === "SKIP" ||
        row.status === "INVALID"
      ) {
        return row;
      }

      const match = existingIndex.get(
        duplicateKey(row)
      );

      if (match) {
        return {
          ...row,
          matched_wine_id: match.id,
          matched_wine_label: match.label,
        };
      }

      return row;
    });

    const { data: existingInventoryRows } =
      await admin
        .from("inventory_view")
        .select("current_quantity")
        .eq("company_id", companyId);

    const existingBottleCount = (
      existingInventoryRows || []
    ).reduce(
      (sum: number, r: any) =>
        sum + Number(r.current_quantity || 0),
      0
    );

    const summary = computeSummary(
      allRows,
      sourceRowCount
    );

    return NextResponse.json({
      rows: allRows,
      summary,
      fileHash,
      sheets: sheets.map((s) => ({
        name: s.name,
        rowCount: s.matrix.length,
      })),
      existingInventory: {
        companyName: company.name || company.id,
        existingBottleCount,
      },
    });
  } catch (e: any) {
    console.error(
      "Initial inventory import analyze error:",
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Failed to analyze the uploaded file.",
      },
      { status: 500 }
    );
  }
}
