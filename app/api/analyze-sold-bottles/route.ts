import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_FILES = 12;

const SoldBottleItem = z.object({
  producer: z.string().default(""),
  wine_name: z.string().default(""),
  cuvee: z.string().default(""),
  vintage: z.string().default(""),
  bottle_size_cl: z.number().nullable().default(null),
  quantity: z.number().default(1),
  confidence: z.number().min(0).max(1).default(0),
  notes: z.string().default(""),
});

const SoldBottleExtraction = z.object({
  items: z.array(SoldBottleItem).default([]),
});

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

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

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is missing. Please set it in .env.local.",
        },
        {
          status: 500,
        }
      );
    }

    const form = await req.formData();

    const files = form
      .getAll("files")
      .filter((f): f is File => f instanceof File)
      .slice(0, MAX_FILES);

    if (!files.length) {
      return NextResponse.json(
        {
          error: "No files uploaded.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * マルチテナント対応：この文言はbottle識別タスクの説明文で
     * あり業務ルールには影響しないが、他社ログイン時に
     * "(BON PINARD SAS)"と表示され続けるのを避けるため、
     * clientから渡されたcompany名で差し替える。未指定・空文字の
     * 場合のみ既存の"BON PINARD SAS"へfallbackする。
     */
    const rawCompanyName = form.get("companyName");
    const companyName =
      (typeof rawCompanyName === "string"
        ? rawCompanyName.trim().replace(/"/g, "")
        : "") || "BON PINARD SAS";

    const client = new OpenAI({
      apiKey,
    });

    const content: any[] = [
      {
        type: "input_text",
        text: `
These are photos of wine bottles sold at a restaurant (${companyName}).

Your task is to identify every DISTINCT wine visible across all the
supplied photos, and count how many bottles of each distinct wine
are visible.

RULES

1. Group by distinct wine. If the same wine (same producer, same
   cuvee/appellation, same vintage, same bottle size) appears more
   than once - either multiple bottles in one photo, or the same
   bottle photographed from different angles across several photos -
   return it as ONE item with "quantity" set to the number of
   distinct bottles you can count.

2. Only report information you can reasonably read from the label,
   capsule, or bottle shape/color. Do not invent or guess a vintage
   or cuvee name that is not legible. If the vintage is not legible,
   leave "vintage" as an empty string. If there is no distinguishing
   cuvee name on the label, leave "cuvee" as an empty string.

3. "wine_name" should be the main name printed on the label as you
   read it (this may duplicate the appellation or producer name -
   that is fine, do not try to deduplicate it yourself).

4. "bottle_size_cl" should only be set when you can visually judge
   the bottle format with reasonable confidence (75 for a standard
   bottle, 150 for a magnum, 37.5 for a half bottle, etc.). If you
   cannot judge it, return null - do not default to 75.

5. "confidence" reflects how confident you are in the COMPLETE
   identification of that wine (producer + wine name + vintage
   together). A wine you can read clearly and completely should be
   0.8-0.99. A wine where you can only make out the producer or
   general type should be well below 0.5.

6. "notes" is a short free-text note about anything relevant a human
   reviewer should know (for example: "label partially obscured",
   "vintage illegible", "capsule suggests magnum but not certain").

7. If a photo does not show a wine bottle clearly enough to identify
   anything at all, simply do not include it as an item - do not
   fabricate a placeholder entry.

Do not invent data. It is much better to leave a field empty or
omit an uncertain bottle entirely than to guess.

OUTPUT

Return JSON only, no markdown, matching exactly this shape:

{
  "items": [
    {
      "producer": "",
      "wine_name": "",
      "cuvee": "",
      "vintage": "",
      "bottle_size_cl": 75,
      "quantity": 1,
      "confidence": 0,
      "notes": ""
    }
  ]
}
        `.trim(),
      },
    ];

    for (const file of files) {
      const dataUrl = await fileToDataUrl(file);

      content.push({
        type: "input_image",
        image_url: dataUrl,
      });
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1",

      input: [
        {
          role: "user",
          content,
        },
      ],

      text: {
        format: {
          type: "json_object",
        },
      },
    });

    const text = getTextFromResponse(response);

    const parsed = SoldBottleExtraction.parse(
      JSON.parse(text)
    );

    /*
     * quantityは必ず1以上の整数にする。
     * confidenceは念のため0〜1へclampする。
     */
    const items = parsed.items.map((item) => ({
      ...item,
      quantity: Math.max(
        1,
        Math.round(Number(item.quantity) || 1)
      ),
      confidence: Math.min(
        0.99,
        Math.max(0, Number(item.confidence) || 0)
      ),
    }));

    return NextResponse.json({
      items,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          e?.message ||
          "Sold bottle analysis error",
      },
      {
        status: 500,
      }
    );
  }
}
