import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 90;

const Item = z.object({
  producer: z.string().default(""),
  cuvee_or_appellation: z.string().default(""),
  wine_name_raw: z.string().default(""),
  color: z.string().default("unknown"),
  vintage: z.string().default(""),
  bottle_size_cl: z.number().default(75),
  alcohol_percent: z.string().default(""),
  quantity_bottles: z.number().default(0),
  unit_price_ht: z.number().default(0),
  amount_ht: z.number().default(0),
  confidence: z.number().default(0),
  notes: z.string().default("")
});

const Extraction = z.object({
  supplier: z.string().default("UNKNOWN SUPPLIER"),
  customer: z.string().default("BON PINARD SAS"),
  invoice_no: z.string().default(""),
  invoice_date: z.string().default(""),
  currency: z.string().default("EUR"),
  items: z.array(Item).default([]),
  shipping_ht: z.number().default(0),
  total_ht: z.number().default(0),
  tva: z.number().default(0),
  total_ttc: z.number().default(0),
  warnings: z.array(z.string()).default([])
});

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function getTextFromResponse(response: any): string {
  if (response.output_text) return response.output_text;
  return (response.output || []).flatMap((o: any) => o.content || []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("");
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is missing. Please set it in .env.local." }, { status: 500 });
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: "No files uploaded." }, { status: 400 });

    const client = new OpenAI({ apiKey });
    const content: any[] = [{
      type: "input_text",
      text: `You are a wine inventory extraction assistant for BON PINARD SAS.
Return JSON only.
Business rules:
- BON PINARD / BON PINARD SAS is always the customer / our company. Never set it as supplier.
- Do not hard-code supplier. MAGNUM is only one possible supplier.
- Detect supplier from invoice issuer, seller, vendor, domain, negociant, company header, VAT, address, RCS or SIRET.
- If customer is BON PINARD SAS, supplier must not be the same company.
- If supplier is uncertain, set supplier to "UNKNOWN SUPPLIER" and add a warning.
- Do not add shipping/Port/delivery fees as inventory items. Put them in shipping_ht.
- Keep producer and supplier separate.
- Read vintage, unit price HT, quantity, bottle size, alcohol percentage very carefully.
- If uncertain, reduce confidence and explain in notes/warnings.
- If only bottle photo is provided, quantity is normally 1 bottle, unless uncertain.
- If credit note/avoir/return, quantity should be negative.
- Do not merge repeated rows. Return each line item separately.
JSON shape:
{"supplier":"","customer":"BON PINARD SAS","invoice_no":"","invoice_date":"","currency":"EUR","items":[{"producer":"","cuvee_or_appellation":"","wine_name_raw":"","color":"Red | White | Rose | Sparkling | unknown","vintage":"","bottle_size_cl":75,"alcohol_percent":"","quantity_bottles":0,"unit_price_ht":0,"amount_ht":0,"confidence":0,"notes":""}],"shipping_ht":0,"total_ht":0,"tva":0,"total_ttc":0,"warnings":[]}`
    }];

    for (const file of files) {
      const dataUrl = await fileToDataUrl(file);
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        content.push({ type: "input_file", filename: file.name, file_data: dataUrl });
      } else {
        content.push({ type: "input_image", image_url: dataUrl });
      }
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1",
      input: [{ role: "user", content }],
      text: { format: { type: "json_object" } }
    });

    const text = getTextFromResponse(response);
    const parsed = Extraction.parse(JSON.parse(text));
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Analyze error" }, { status: 500 });
  }
}
