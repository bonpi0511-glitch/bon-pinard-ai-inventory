/*
 * Section 10「初期在庫インポート」用の正規化ヘルパー。
 * 純粋関数のみ（DBアクセス・秘密情報なし）。
 * サーバー側のExcel解析（analyze route）から使う。
 *
 * ここでのcolor/vintageの正規化ルールは、既存の
 * app/api/analyze/route.ts のAI伝票抽出プロンプトが使っている
 * 値（"Red" | "White" | "Rose" | "Sparkling" | "unknown"）に合わせている。
 */

export function normalizeImportSearchText(
  value: unknown
): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const COLOR_KEYWORDS: Array<[string, string[]]> = [
  [
    "Sparkling",
    [
      "SPARKLING",
      "CHAMPAGNE",
      "MOUSSEUX",
      "PETILLANT",
      "CREMANT",
      "CRÉMANT",
      "SPUMANTE",
    ],
  ],
  [
    "White",
    ["WHITE", "BLANC", "BLC", "BIANCO", "WEISS"],
  ],
  [
    "Rose",
    ["ROSE", "ROSÉ", "ROSATO"],
  ],
  [
    "Red",
    ["RED", "ROUGE", "RGE", "ROSSO", "ROT"],
  ],
];

export function normalizeImportColor(
  raw: unknown
): string {
  const text = normalizeImportSearchText(raw);

  if (!text) return "unknown";

  for (const [label, keywords] of COLOR_KEYWORDS) {
    if (
      keywords.some((keyword) =>
        text.includes(keyword)
      )
    ) {
      return label;
    }
  }

  return "unknown";
}

const NV_KEYWORDS = [
  "NV",
  "N V",
  "NM",
  "NON MILLESIME",
  "SANS MILLESIME",
  "NON VINTAGE",
];

/*
 * Vintageは既存アプリの表記規則（4桁の年、または不明時は空欄）に合わせる。
 * "NV"のような略記が読み取れた場合はそのまま短い表記として残す
 * （既存のparseVintageYearは4桁以外をNV/不明として扱う）。
 */
export function normalizeImportVintage(
  raw: unknown
): string {
  const text = String(raw ?? "").trim();

  if (!text) return "";

  const yearMatch = text.match(/(19|20)\d{2}/);

  if (yearMatch) {
    const year = Number(yearMatch[0]);
    const currentYear = new Date().getFullYear();

    if (year >= 1900 && year <= currentYear + 1) {
      return String(year);
    }
  }

  const normalized = normalizeImportSearchText(text);

  if (
    NV_KEYWORDS.some((keyword) =>
      normalized.includes(keyword)
    )
  ) {
    return "NV";
  }

  return "";
}

/*
 * ボトルサイズをcl単位へ正規化する。
 * 750 ml / 0.75 L / 75cl / Magnum / 1.5L などに対応。
 * 読み取れない場合はnull（75を勝手に補完しない）。
 */
export function normalizeImportBottleSizeCl(
  raw: unknown
): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    // 明らかにclとして妥当な範囲ならそのまま使う。
    if (raw >= 10 && raw <= 3000) {
      return Math.round(raw);
    }
  }

  const text = String(raw).trim().toUpperCase();

  if (!text) return null;

  const namedSizes: Array<[RegExp, number]> = [
    [/DEMI|HALF/, 37.5],
    [/MAGNUM/, 150],
    [/JEROBOAM/, 300],
    [/REHOBOAM/, 450],
    [/IMPERIALE|IMPERIAL/, 600],
    [/METHUSALEM/, 600],
    [/SALMANAZAR/, 900],
    [/BALTHAZAR/, 1200],
    [/NABUCHODONOSOR|NEBUCHADNEZZAR/, 1500],
  ];

  for (const [pattern, cl] of namedSizes) {
    if (pattern.test(text)) return cl;
  }

  const mlMatch = text.match(
    /([0-9]+(?:[.,][0-9]+)?)\s*ML/
  );
  if (mlMatch) {
    const ml = Number(mlMatch[1].replace(",", "."));
    if (Number.isFinite(ml)) {
      return Math.round(ml / 10);
    }
  }

  const clMatch = text.match(
    /([0-9]+(?:[.,][0-9]+)?)\s*CL/
  );
  if (clMatch) {
    const cl = Number(clMatch[1].replace(",", "."));
    if (Number.isFinite(cl)) {
      return Math.round(cl);
    }
  }

  const lMatch = text.match(
    /([0-9]+(?:[.,][0-9]+)?)\s*L\b/
  );
  if (lMatch) {
    const liters = Number(
      lMatch[1].replace(",", ".")
    );
    if (Number.isFinite(liters)) {
      return Math.round(liters * 100);
    }
  }

  // 単位無しの裸の数字は、妥当な範囲のときだけclとして受け入れる。
  const bareNumber = Number(
    text.replace(",", ".")
  );

  if (
    Number.isFinite(bareNumber) &&
    bareNumber >= 10 &&
    bareNumber <= 3000
  ) {
    return Math.round(bareNumber);
  }

  return null;
}

/*
 * 数量をボトル本数（0以上の整数）として解析する。
 * 読み取れない/負数の場合はnull。
 */
export function normalizeImportQuantity(
  raw: unknown
): number | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  const text = String(raw)
    .replace(/[^0-9.,\-]/g, "")
    .trim();

  if (!text) return null;

  const value = Number(
    text.replace(",", ".")
  );

  if (!Number.isFinite(value)) return null;

  const rounded = Math.round(value);

  if (rounded < 0) return null;

  return rounded;
}

/*
 * 原価(HT想定)を数値として解析する。
 * 通貨記号・桁区切りを除去し、カンマ小数点にも対応する。
 * TTC/VAT等の換算は行わない（読み取れた値をそのまま使う）。
 */
export function normalizeImportUnitCost(
  raw: unknown
): number | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  let text = String(raw).trim();

  if (!text) return null;

  // 通貨記号・空白を除去。
  text = text.replace(/[€$£¥]/g, "").trim();

  // "1.234,56" のような桁区切り+カンマ小数の形式を判定する。
  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    // 最後に出てくる区切り記号を小数点とみなす。
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");

    if (lastComma > lastDot) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    text = text.replace(",", ".");
  }

  text = text.replace(/[^0-9.\-]/g, "");

  const value = Number(text);

  return Number.isFinite(value) ? value : null;
}

/*
 * 合計行・小計行・地域見出し等、ワイン明細ではない行を検出する簡易判定。
 * 完全ではないため、これに当てはまらない行も後段のstatus判定で
 * SKIP/INVALID/REVIEWへ振り分けられる。
 */
export function looksLikeNonWineRow(
  cellsText: string
): boolean {
  const normalized = normalizeImportSearchText(
    cellsText
  );

  if (!normalized) return true;

  const nonWinePatterns = [
    /^TOTAL/,
    /^SOUS TOTAL/,
    /^SUBTOTAL/,
    /^GRAND TOTAL/,
    /^TOTAUX/,
    /^\d+$/,
  ];

  return nonWinePatterns.some((pattern) =>
    pattern.test(normalized)
  );
}

/*
 * 会計・送料・値引き調整など、明らかにワイン明細ではない行を
 * SKIP扱いにするための追加判定。
 *
 * looksLikeNonWineRow()は行頭が"TOTAL"等で始まる場合だけを見る
 * 簡易判定だが、"AVOIR FINANCIER"（クレジットノート/値引き調整行）
 * のように、その語自体がwine_name欄にそのまま入ってしまうケースを
 * 拾うため、キーワード一致だけでなく
 *   - producerが空
 *   - quantityが読めない/0
 *   - vintageが空
 * という「ワインらしい情報が無い」ことを示す複数の状況証拠と
 * 組み合わせてから判定する。単語が偶然含まれるだけの実在ワイン名を
 * 誤ってSKIPにしないための安全策。
 */
const NON_WINE_FINANCIAL_KEYWORDS_LATIN = [
  "AVOIR FINANCIER",
  "AVOIR",
  "TOTAL GENERAL",
  "TOTAL HT",
  "TOTAL TTC",
  "TOTAL",
  "SOUS TOTAL",
  "SUBTOTAL",
  "REMISE",
  "DISCOUNT",
  "FRAIS DE PORT",
  "PORT",
  "LIVRAISON",
  "SHIPPING",
  "TRANSPORT",
];

const NON_WINE_FINANCIAL_KEYWORDS_JA = [
  "合計",
  "小計",
  "値引",
  "送料",
  "配送料",
];

function matchesNonWineFinancialKeyword(
  text: string
): boolean {
  const normalized = normalizeImportSearchText(text);

  if (
    normalized &&
    NON_WINE_FINANCIAL_KEYWORDS_LATIN.some(
      (keyword) =>
        normalized === keyword ||
        normalized.startsWith(keyword + " ")
    )
  ) {
    return true;
  }

  // normalizeImportSearchTextは英数字以外を除去するため、
  // 日本語キーワードは正規化前の生テキストに対して判定する。
  const raw = String(text ?? "");

  return NON_WINE_FINANCIAL_KEYWORDS_JA.some(
    (keyword) => raw.includes(keyword)
  );
}

export function isNonWineFinancialRow(fields: {
  wineName: string;
  cuvee: string;
  producer: string;
  vintage: string;
  quantity: number | null;
  rawText: string;
}): boolean {
  const nameText = `${fields.wineName} ${fields.cuvee}`.trim();

  const keywordMatch =
    matchesNonWineFinancialKeyword(nameText) ||
    matchesNonWineFinancialKeyword(fields.rawText);

  if (!keywordMatch) return false;

  const hasNoProducer = !fields.producer.trim();
  const hasNoQuantity =
    fields.quantity === null || fields.quantity === 0;
  const hasNoVintage = !fields.vintage.trim();

  const corroboratingSignalCount = [
    hasNoProducer,
    hasNoQuantity,
    hasNoVintage,
  ].filter(Boolean).length;

  // キーワード一致だけでSKIPにはしない。producer/quantity/vintageの
  // うち2つ以上が「ワインらしくない」ことを裏付けて初めてSKIPとする。
  return corroboratingSignalCount >= 2;
}
