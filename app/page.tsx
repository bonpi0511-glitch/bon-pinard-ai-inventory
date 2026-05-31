"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

type StatusCode = "CONFIRMED" | "NEEDS_CHECK" | "MANUAL";

type Item = {
  status: StatusCode;
  date: string;
  invoiceNo: string;
  supplier: string;
  customer: string;
  producer: string;
  cuvee: string;
  raw: string;
  color: string;
  vintage: string;
  size: number;
  alcohol: string;
  qty: number;
  unit: number;
  amount: number;
  confidence: number;
  memo: string;
};

type AIResult = {
  supplier: string;
  customer: string;
  invoice_no: string;
  invoice_date: string;
  currency: string;
  items: any[];
  shipping_ht: number;
  total_ht: number;
  tva: number;
  total_ttc: number;
  warnings: string[];
};

type PreviewFile = { name: string; type: string; url: string };

function today() { return new Date().toISOString().slice(0, 10); }

function statusLabel(status: StatusCode) {
  if (status === "CONFIRMED") return "確認済";
  if (status === "NEEDS_CHECK") return "要確認";
  return "手入力";
}

function normalizeDate(s: string) {
  if (!s) return "";
  const m = String(s).match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  const m2 = String(s).match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m2) return `${m2[3]}-${String(m2[2]).padStart(2, "0")}-${String(m2[1]).padStart(2, "0")}`;
  return "";
}

function wineKey(r: Item) {
  return [(r.producer || "").trim().toUpperCase(), (r.raw || r.cuvee || "").trim().toUpperCase(), (r.vintage || "").trim(), String(r.size || 75)].join(" | ");
}

function supplierKey(name: string) { return (name || "UNKNOWN SUPPLIER").trim().toUpperCase(); }

function getStoredJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}

function saveMastersFromInventory(rows: Item[]) {
  const suppliers = getStoredJson<Record<string, any>>("bon_pinard_supplier_master", {});
  const wines = getStoredJson<Record<string, any>>("bon_pinard_wine_master", {});
  const priceHistory = getStoredJson<any[]>("bon_pinard_price_history", []);

  rows.forEach((r) => {
    suppliers[supplierKey(r.supplier)] = { name: r.supplier || "UNKNOWN SUPPLIER", lastUsedAt: new Date().toISOString() };
    wines[wineKey(r)] = {
      producer: r.producer, wineName: r.raw, cuvee: r.cuvee, color: r.color,
      vintage: r.vintage, bottleSizeCl: r.size, alcohol: r.alcohol, lastUpdatedAt: new Date().toISOString()
    };
    if (r.unit || r.amount) {
      priceHistory.push({
        date: r.date, invoiceNo: r.invoiceNo, supplier: r.supplier, producer: r.producer,
        wineName: r.raw, cuvee: r.cuvee, vintage: r.vintage, bottleSizeCl: r.size,
        quantity: r.qty, unitPriceHT: r.unit, amountHT: r.amount, recordedAt: new Date().toISOString()
      });
    }
  });

  localStorage.setItem("bon_pinard_supplier_master", JSON.stringify(suppliers));
  localStorage.setItem("bon_pinard_wine_master", JSON.stringify(wines));
  localStorage.setItem("bon_pinard_price_history", JSON.stringify(priceHistory.slice(-2000)));
}

function findDuplicateWarnings(existing: Item[], incoming: Item[]) {
  const existingSet = new Set(existing.map((r) => `${r.invoiceNo} | ${wineKey(r)}`));
  const warnings: string[] = [];
  incoming.forEach((r) => {
    const key = `${r.invoiceNo} | ${wineKey(r)}`;
    if (existingSet.has(key)) warnings.push(`重複の可能性: 伝票 ${r.invoiceNo} / ${r.producer} / ${r.raw || r.cuvee} / ${r.vintage}`);
  });
  return warnings;
}

export default function Page() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PreviewFile[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<PreviewFile | null>(null);
  const [supplier, setSupplier] = useState("UNKNOWN SUPPLIER");
  const [customer, setCustomer] = useState("BON PINARD SAS");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [inventory, setInventory] = useState<Item[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("bon_pinard_ai_inventory_server");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setInventory(data.inventory || []);
        if (data.header) {
          setSupplier(data.header.supplier || "UNKNOWN SUPPLIER");
          setCustomer(data.header.customer || "BON PINARD SAS");
          setInvoiceNo(data.header.invoiceNo || "");
          setInvoiceDate(data.header.invoiceDate || today());
        }
      } catch {}
    }
  }, []);

  function handleFiles(selectedFiles: File[]) {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    const nextPreviews = selectedFiles.map((file) => ({
      name: file.name,
      type: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/*"),
      url: URL.createObjectURL(file),
    }));
    setFiles(selectedFiles);
    setPreviews(nextPreviews);
    setSelectedPreview(nextPreviews[0] || null);
  }

  function saveLocal(show = true) {
    localStorage.setItem("bon_pinard_ai_inventory_server", JSON.stringify({ header: { supplier, customer, invoiceNo, invoiceDate }, inventory }));
    saveMastersFromInventory(inventory);
    if (show) alert("保存しました。マスター履歴も更新しました。");
  }

  async function analyze() {
    if (!files.length) { alert("PDFまたは写真を選択してください"); return; }
    setLoading(true);
    setStatus("AI判定中です...");
    setWarnings([]);

    const fd = new FormData();
    files.forEach((file) => fd.append("files", file));

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI判定に失敗しました");

      const parsed = data as AIResult;
      const nextSupplier = parsed.supplier || "UNKNOWN SUPPLIER";
      const nextCustomer = parsed.customer || "BON PINARD SAS";
      const nextInvoiceNo = parsed.invoice_no || "";
      const nextInvoiceDate = normalizeDate(parsed.invoice_date) || today();

      setSupplier(nextSupplier);
      setCustomer(nextCustomer);
      setInvoiceNo(nextInvoiceNo);
      setInvoiceDate(nextInvoiceDate);
      setWarnings(parsed.warnings || []);

      const newItems: Item[] = (parsed.items || []).map((x) => {
        const qty = Number(x.quantity_bottles || 0);
        const unit = Number(x.unit_price_ht || 0);
        const amount = Number(x.amount_ht || qty * unit || 0);
        const conf = Number(x.confidence || 0);
        return {
          status: conf < 0.85 ? "NEEDS_CHECK" : "CONFIRMED",
          date: nextInvoiceDate, invoiceNo: nextInvoiceNo, supplier: nextSupplier, customer: nextCustomer,
          producer: x.producer || "", cuvee: x.cuvee_or_appellation || "", raw: x.wine_name_raw || "",
          color: x.color || "", vintage: x.vintage || "", size: Number(x.bottle_size_cl || 75),
          alcohol: x.alcohol_percent || "", qty, unit, amount, confidence: conf, memo: x.notes || ""
        };
      });

      setInventory((prev) => {
        const duplicateWarnings = findDuplicateWarnings(prev, newItems);
        const merged = [...prev, ...newItems];
        setTimeout(() => {
          localStorage.setItem("bon_pinard_ai_inventory_server", JSON.stringify({
            header: { supplier: nextSupplier, customer: nextCustomer, invoiceNo: nextInvoiceNo, invoiceDate: nextInvoiceDate },
            inventory: merged
          }));
          saveMastersFromInventory(newItems);
          if (duplicateWarnings.length) setWarnings([...(parsed.warnings || []), ...duplicateWarnings]);
        }, 0);
        return merged;
      });
      setStatus(`${newItems.length}件の商品を在庫へ自動登録しました。内容を確認してください。`);
    } catch (e: any) {
      setStatus(`エラー: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function addRow() {
    setInventory([...inventory, {
      status: "MANUAL", date: invoiceDate, invoiceNo, supplier, customer,
      producer: "", cuvee: "", raw: "", color: "", vintage: "", size: 75, alcohol: "",
      qty: 1, unit: 0, amount: 0, confidence: 1, memo: ""
    }]);
  }

  function update(i: number, key: keyof Item, value: any) {
    const next = [...inventory];
    const numeric = ["size", "qty", "unit", "amount", "confidence"];
    const v = numeric.includes(key as string) ? Number(value || 0) : value;
    next[i] = { ...next[i], [key]: v };
    if (key === "qty" || key === "unit") next[i].amount = Math.round(Number(next[i].qty || 0) * Number(next[i].unit || 0) * 100) / 100;
    if (key === "confidence") next[i].status = Number(v) < 0.85 ? "NEEDS_CHECK" : "CONFIRMED";
    setInventory(next);
  }

  function removeRow(i: number) { setInventory(inventory.filter((_, idx) => idx !== i)); }

  function stockRows() {
    return inventory.map((r) => ({
      status: statusLabel(r.status), date: r.date, invoiceNo: r.invoiceNo, supplier: r.supplier,
      customer: r.customer, producer: r.producer, cuvee: r.cuvee, wineNameRaw: r.raw,
      color: r.color, vintage: r.vintage, bottleSizeCl: r.size, alcohol: r.alcohol,
      quantity: r.qty, unitPriceHT: r.unit, amountHT: r.amount, currency: "EUR",
      confidence: r.confidence, memo: r.memo
    }));
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows()), "在庫表");
    XLSX.writeFile(wb, "BON_PINARD_AI在庫表.xlsx");
  }

  function exportCSV() {
    const ws = XLSX.utils.json_to_sheet(stockRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "BON_PINARD_AI在庫表.csv";
    a.click();
  }

  function exportMasters() {
    const suppliers = Object.values(getStoredJson<Record<string, any>>("bon_pinard_supplier_master", {}));
    const wines = Object.values(getStoredJson<Record<string, any>>("bon_pinard_wine_master", {}));
    const priceHistory = getStoredJson<any[]>("bon_pinard_price_history", []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppliers), "仕入先マスター");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wines), "ワインマスター");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(priceHistory), "仕入価格履歴");
    XLSX.writeFile(wb, "BON_PINARD_マスター履歴.xlsx");
  }

  const totalQty = inventory.reduce((s, r) => s + Number(r.qty || 0), 0);
  const totalHT = inventory.reduce((s, r) => s + Number(r.amount || 0), 0);
  const needsCheck = inventory.filter((r) => r.status === "NEEDS_CHECK").length;

  return (
    <main className="mx-auto max-w-[1800px] p-4">
      <section className="card p-6">
        <p className="text-sm font-bold text-stone-500">BON PINARD SAS</p>
        <h1 className="mt-2 text-3xl font-bold">AI在庫自動登録アプリ</h1>
        <p className="mt-2 text-stone-600">PDF・写真をアップロードすると、AI判定して商品在庫へ自動登録します。BON PINARDは自社、仕入先は伝票ごとに判定します。</p>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-xl font-bold">iPhone / iPadで使う方法</h2>
        <p className="mt-2 text-sm text-stone-600">
          公開URLをSafariで開き、共有ボタンから「ホーム画面に追加」を選ぶと、アプリのように起動できます。
        </p>
        <ol className="mt-3 list-decimal pl-5 text-sm text-stone-700">
          <li>SafariでこのアプリのURLを開く</li>
          <li>共有ボタンを押す</li>
          <li>「ホーム画面に追加」を選択</li>
          <li>BON PINARDアイコンから起動</li>
        </ol>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-xl font-bold">1. PDF・写真を選択</h2>
        <input className="input mt-3 w-full" type="file" multiple accept="image/*,.pdf,application/pdf" onChange={(e) => handleFiles(Array.from(e.target.files || []))} />
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={loading} onClick={analyze}>{loading ? "AI判定中..." : "AI判定して在庫へ自動登録"}</button>
          <button className="btn btn-secondary" onClick={addRow}>手入力で行追加</button>
        </div>
        {status && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{status}</div>}
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-xl font-bold">2. 伝票情報</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div><label>仕入先</label><input className="input w-full" value={supplier} onChange={(e) => setSupplier(e.target.value)} /></div>
          <div><label>自社</label><input className="input w-full" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
          <div><label>伝票番号</label><input className="input w-full" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></div>
          <div><label>伝票日付</label><input className="input w-full" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
        </div>
        {warnings.length > 0 && (
          <ul className="mt-3 list-disc rounded-xl border border-amber-200 bg-amber-50 p-4 pl-8 text-sm text-amber-800">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-xl font-bold">3. 原本PDF/写真とAI抽出結果</h2>
        <p className="mt-1 text-sm text-stone-600">左で原本を見ながら、右でヴィンテージ・数量・単価を確認できます。</p>
        <div className="mt-4 grid gap-4 xl:grid-cols-[42%_58%]">
          <div className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold">原本PDF / 写真</h3>
              {selectedPreview && <a className="text-sm underline" href={selectedPreview.url} target="_blank" rel="noreferrer">別タブで開く</a>}
            </div>

            {previews.length > 0 ? (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
                {previews.map((p, idx) => (
                  <button key={`${p.name}-${idx}`} type="button" className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${selectedPreview?.url === p.url ? "border-stone-900 bg-white font-bold" : "border-stone-200 bg-white"}`} onClick={() => setSelectedPreview(p)}>
                    <div className="max-w-[180px] truncate">{p.name}</div>
                    <div className="text-[11px] text-stone-500">{p.type.includes("pdf") ? "PDF" : "写真/画像"}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">PDFまたは写真を選択すると、ここに原本が表示されます。</p>
            )}

            {selectedPreview?.type.includes("pdf") ? (
              <iframe src={selectedPreview.url} className="h-[760px] w-full rounded-xl border border-stone-200 bg-white" title={selectedPreview.name} />
            ) : selectedPreview ? (
              <div className="flex h-[760px] justify-center overflow-auto rounded-xl border border-stone-200 bg-white p-3">
                <img src={selectedPreview.url} alt={selectedPreview.name} className="max-h-full max-w-full object-contain" />
              </div>
            ) : null}
          </div>

          <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3">
            <h3 className="mb-3 font-bold">AI抽出結果・在庫明細</h3>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-stone-50 p-4">在庫本数<br /><b className="text-2xl">{totalQty}</b></div>
              <div className="rounded-xl bg-stone-50 p-4">金額HT<br /><b className="text-2xl">{totalHT.toFixed(2)} €</b></div>
              <div className="rounded-xl bg-stone-50 p-4">商品数<br /><b className="text-2xl">{inventory.length}</b></div>
              <div className="rounded-xl bg-stone-50 p-4">要確認<br /><b className="text-2xl">{needsCheck}</b></div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button className="btn btn-primary" onClick={exportExcel}>Excel出力</button>
              <button className="btn btn-secondary" onClick={exportCSV}>CSV出力</button>
              <button className="btn btn-secondary" onClick={exportMasters}>マスター出力</button>
              <button className="btn btn-secondary" onClick={() => saveLocal(true)}>端末保存</button>
              <button className="btn btn-danger" onClick={() => { if (confirm("在庫を全消去しますか？")) setInventory([]); }}>在庫全消去</button>
            </div>

            <div className="mt-4 max-h-[720px] overflow-auto rounded-xl border border-stone-200">
              <table className="min-w-[1900px] w-full">
                <thead><tr>{["状態","操作","入庫日","伝票番号","仕入先","生産者","キュヴェ","商品名原文","色","年","容量","度数","本数","単価HT","金額HT","信頼度","メモ"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {inventory.map((r, i) => (
                    <tr key={i} className={r.status === "NEEDS_CHECK" ? "bg-amber-50" : ""}>
                      <td><select className="input w-[110px]" value={r.status} onChange={(e) => update(i, "status", e.target.value as StatusCode)}><option value="CONFIRMED">確認済</option><option value="NEEDS_CHECK">要確認</option><option value="MANUAL">手入力</option></select></td>
                      <td><button className="btn btn-danger" onClick={() => removeRow(i)}>削除</button></td>
                      <td><input className="input w-[130px]" type="date" value={r.date} onChange={(e) => update(i, "date", e.target.value)} /></td>
                      <td><input className="input w-[140px]" value={r.invoiceNo} onChange={(e) => update(i, "invoiceNo", e.target.value)} /></td>
                      <td><input className="input w-[220px]" value={r.supplier} onChange={(e) => update(i, "supplier", e.target.value)} /></td>
                      <td><input className="input w-[220px]" value={r.producer} onChange={(e) => update(i, "producer", e.target.value)} /></td>
                      <td><input className="input w-[320px]" value={r.cuvee} onChange={(e) => update(i, "cuvee", e.target.value)} /></td>
                      <td><input className="input w-[520px]" value={r.raw} onChange={(e) => update(i, "raw", e.target.value)} /></td>
                      <td><input className="input w-[110px]" value={r.color} onChange={(e) => update(i, "color", e.target.value)} /></td>
                      <td><input className="input w-[90px]" value={r.vintage} onChange={(e) => update(i, "vintage", e.target.value)} /></td>
                      <td><input className="input w-[80px]" type="number" value={r.size} onChange={(e) => update(i, "size", e.target.value)} /></td>
                      <td><input className="input w-[90px]" value={r.alcohol} onChange={(e) => update(i, "alcohol", e.target.value)} /></td>
                      <td><input className="input w-[80px]" type="number" value={r.qty} onChange={(e) => update(i, "qty", e.target.value)} /></td>
                      <td><input className="input w-[100px]" type="number" value={r.unit} onChange={(e) => update(i, "unit", e.target.value)} /></td>
                      <td><input className="input w-[100px]" type="number" value={r.amount} onChange={(e) => update(i, "amount", e.target.value)} /></td>
                      <td><input className="input w-[80px]" type="number" min="0" max="1" step="0.01" value={r.confidence} onChange={(e) => update(i, "confidence", e.target.value)} /></td>
                      <td><input className="input w-[300px]" value={r.memo} onChange={(e) => update(i, "memo", e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
