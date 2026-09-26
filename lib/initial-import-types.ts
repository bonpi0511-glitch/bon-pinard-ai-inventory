/*
 * Section 10「初期在庫インポート（運営者専用）」共通型。
 *
 * サーバー（app/api/admin/inventory-import/**）とクライアント
 * （app/inventory-app.tsx）の両方からimportされる、純粋な型定義のみの
 * モジュール。Service Role Keyや秘密情報はここに置かない。
 */

export type InitialImportRowStatus =
  | "READY"
  | "REVIEW"
  | "DUPLICATE"
  | "INVALID"
  | "SKIP";

export type InitialInventoryImportRow = {
  row_id: string;

  source_sheet: string;
  source_rows: number[];

  producer: string;
  wine_name: string;
  cuvee: string;
  vintage: string;
  color: string;

  bottle_size_cl: number | null;
  alcohol_percent: string;

  quantity: number | null;
  unit_cost_ht: number | null;

  raw_text: string;

  confidence: number;
  warnings: string[];

  status: InitialImportRowStatus;

  matched_wine_id: string | null;
  matched_wine_label: string | null;

  duplicate_of_row_id: string | null;
};

export type InitialImportSummary = {
  sourceRowCount: number;
  recognizedWineCount: number;
  uniqueWineCount: number;
  totalBottles: number;
  readyCount: number;
  reviewCount: number;
  duplicateCount: number;
  invalidCount: number;
  skipCount: number;
};

export type InitialImportExistingInventoryInfo = {
  companyName: string;
  existingBottleCount: number;
};
