import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 90;

const WineInput = z.object({
  wine_id: z.string(),
  producer: z.string().default(""),
  wine_name: z.string().default(""),
  cuvee: z.string().default(""),
  vintage: z.string().default(""),
});

const RequestSchema = z.object({
  wines: z.array(WineInput).min(1).max(20),
});

const ExtractedCuvee = z.object({
  wine_id: z.string(),

  cuvee: z.string().default(""),

  confidence: z.number().min(0).max(1).default(0),

  notes: z.string().default(""),
});

const ExtractionResult = z.object({
  wines: z.array(ExtractedCuvee),
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

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY is missing.",
        },
        {
          status: 500,
        }
      );
    }

    const body = RequestSchema.parse(await req.json());

    const client = new OpenAI({
      apiKey,
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1",

      input: [
        {
          role: "user",

          content: [
            {
              type: "input_text",

              text: `
You are a professional wine-list editor for a restaurant in France.

Your only task is to extract the genuine commercial cuvee
(product line) name for each wine, so it can be shown to
customers on a printed wine list underneath its appellation.

IMPORTANT GENERAL RULES

1. Preserve wine_id EXACTLY.

2. Return exactly one result for every input wine.

3. The "wine_name" field is the raw text taken directly from a
supplier invoice (often OCR-extracted). It usually contains,
mixed together and in no fixed order:

- the word "Champagne" or another appellation/region word
- the producer name
- a vintage year, or "NM" / "nm" (Negociant-Manipulant, a
  producer-status code, NOT a vintage or cuvee name)
- a color word (Blanc, Rouge, Rose)
- a bottle size (75 cl, 150 cl, ...)
- sometimes an alcohol percentage
- sometimes packaging/condition codes such as CRD, SD, TB
- occasionally a genuine cuvee / product-line name

4. The existing "cuvee" field was extracted mechanically by a
previous OCR/parsing step and is frequently just noise copied
from the raw text (for example "CHAMPAGNE NM", "CHAMPAGNE ROSE",
or simply "CHAMPAGNE"). Do not trust it blindly - use it only as
a hint, and re-derive the real cuvee yourself from wine_name,
producer and professional wine knowledge.


WHAT COUNTS AS A REAL CUVEE

A real cuvee is a specific named product line that a customer
would recognize on a wine list, for example:

Cristal
Comte de Champagne
Cordon Rouge
Rene Lalou
Florens Louis
Dom Ruinart Blanc de Blancs
Grande Cuvee
Cuvee Sir Winston Churchill
Tete de Cuvee Tradition
Monopole
Blanc de Blancs
Blanc de Noirs

A style designation such as "Blanc de Blancs" or "Blanc de Noirs"
DOES count as a real cuvee when it is the specific style name of
that bottling, because it is meaningful to a customer.


WHAT IS NOT A REAL CUVEE - RETURN "" INSTEAD

Do NOT return any of the following as a cuvee, even if they
appear in wine_name or the existing cuvee field:

- "NM", "nm", "RM", "MA", "CM", "SR", "ND", "CRD", "SD" and other
  producer-status or packaging/condition codes
- a plain color word alone: "Blanc", "Rouge", "Rose" / "Rosé"
- a plain style word alone with no other qualifier: "Brut",
  "Extra Brut", "Sec", "Demi-Sec" (these describe every basic
  bottling of a producer, they are not a distinguishing cuvee
  name on their own)
- the appellation or region name itself: "Champagne", "Bourgogne",
  "Vin de France", etc.
- the vintage year, bottle size, or alcohol percentage
- the producer name repeated with nothing else added
- a Burgundy/Bordeaux climat, lieu-dit or vineyard name (that is
  handled separately as "climat" elsewhere - do not duplicate it
  here unless it is truly a marketed cuvee name distinct from the
  vineyard)

If, after removing all of the above noise, nothing genuinely
identifying is left, return cuvee = "" (empty string). An empty
cuvee is the correct, honest answer for a huge number of basic
NM/vintage-only bottlings - do NOT invent a plausible-sounding
name to fill the field.


EXAMPLES

producer: DOM PERIGNON, wine_name: "CHAMPAGNE 1969 DOM PERIGNON Blanc 75 cl"
-> cuvee = ""
(Dom Perignon is itself the producer/cuvee; the source data adds
no further distinguishing name such as "P2" or "Oenotheque", so
there is nothing extra to extract.)

producer: ALAIN BAILLY, wine_name: "CHAMPAGNE NM ALAIN BAILLY Blanc 75 cl"
-> cuvee = ""
(NM is a producer-status code, not a cuvee.)

producer: MOUSSY MARY, wine_name: "CHAMPAGNE ROSE NM MOUSSY MARY Rose 75 cl"
-> cuvee = ""
(Rose is only the color, not a distinguishing cuvee name.)

producer: ROEDERER, wine_name: "CRISTAL 1985 ROEDERER Blanc 75 cl"
-> cuvee = "Cristal"

producer: TAITTINGER, wine_name: "CHAMPAGNE COMTE DE CHAMPAGNE 1981 TAITTINGER Blanc 75 cl"
-> cuvee = "Comte de Champagne"

producer: MUMM, wine_name: "CHAMPAGNE CORDON ROUGE 1988 MUMM Blanc 75 cl"
-> cuvee = "Cordon Rouge"

producer: MUMM, wine_name: "CHAMPAGNE RENE LALOU 1985 MUMM Blanc 150 cl"
-> cuvee = "Rene Lalou"

producer: PIPER HEIDSIECK, wine_name: "CHAMPAGNE FLORENS LOUIS 1971 PIPER HEIDSIECK Blanc 75 cl"
-> cuvee = "Florens Louis"

producer: RUINART, wine_name: "CHAMPAGNE DOM RUINART BLANC DE BLANCS 1988 RUINART Blanc 75 cl"
-> cuvee = "Dom Ruinart Blanc de Blancs"

producer: HEIDSIECK CHARLES, wine_name: "CHAMPAGNE MONOPOLE annees 2000 HEIDSIECK CHARLES"
-> cuvee = "Monopole"

producer: LA CASENOVE, wine_name: "CHAMPAGNE TETE DE CUVEE TRADITION nm LA CASENOVE"
-> cuvee = "Tete de Cuvee Tradition"


FORMATTING RULES

Use proper title case and correct French accents, for example
"Rene Lalou" should be written "René Lalou", "Comte de Champagne"
stays as written. Do not use ALL CAPS in the output even if the
source text was in all caps.

Do not repeat the appellation or the producer name inside cuvee
unless it is genuinely part of the marketed cuvee name (for
example "Dom Ruinart Blanc de Blancs" legitimately repeats the
producer name because that is the real name of the cuvee).


CONFIDENCE RULE

confidence must be between 0 and 1.

Use 0.9-0.99 when the cuvee name is explicit and unambiguous in
the source data.

Use 0.6-0.89 when the cuvee is inferred from professional wine
knowledge (for example recognizing "Cristal" as Roederer's
prestige cuvee) rather than being verbatim in the source text.

Use a low confidence (below 0.5) when returning cuvee = "" only
because the source text is ambiguous, not simply because there is
obviously nothing there - for a clearly noise-only source
(NM, color word, appellation only), returning cuvee = "" with a
high confidence (0.9+) is correct and expected.

Never return confidence = 1.0.


OUTPUT RULES

Return JSON only.

Do not add Markdown.

Do not add explanations outside the JSON.


Required JSON shape:

{
  "wines": [
    {
      "wine_id": "",
      "cuvee": "",
      "confidence": 0,
      "notes": ""
    }
  ]
}

INPUT WINES:

${JSON.stringify(body.wines, null, 2)}
              `.trim(),
            },
          ],
        },
      ],

      text: {
        format: {
          type: "json_object",
        },
      },
    });

    const text = getTextFromResponse(response);

    const parsed = ExtractionResult.parse(
      JSON.parse(text)
    );

    /*
     * AI自身が返すconfidenceは自己評価なので、
     * 1.0（100%）は確定値として扱わない。
     *
     * 人間による確認前のAI判定は最大0.99とする。
     */
    const calibrated = {
      ...parsed,
      wines: parsed.wines.map((wine) => ({
        ...wine,
        confidence: Math.min(
          Number(wine.confidence || 0),
          0.99
        ),
      })),
    };

    const inputIds = new Set(
      body.wines.map((w) => w.wine_id)
    );

    const outputIds = calibrated.wines.map(
      (w) => w.wine_id
    );

    const hasInvalidId = outputIds.some(
      (id) => !inputIds.has(id)
    );

    const hasDuplicateId =
      new Set(outputIds).size !== outputIds.length;

    const hasMissingWine =
      outputIds.length !== body.wines.length;

    if (
      hasInvalidId ||
      hasDuplicateId ||
      hasMissingWine
    ) {
      return NextResponse.json(
        {
          error:
            "AI cuvee extraction returned inconsistent wine IDs.",

          details: {
            input_count: body.wines.length,
            output_count: outputIds.length,
          },
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(calibrated);
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          e?.message ||
          "Cuvee extraction error",
      },
      {
        status: 500,
      }
    );
  }
}
