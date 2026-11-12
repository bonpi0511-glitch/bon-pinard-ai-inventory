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
  color: z.string().default("unknown"),
  vintage: z.string().default(""),
});

const RequestSchema = z.object({
  wines: z.array(WineInput).min(1).max(20),
});

const ClassifiedWine = z.object({
  wine_id: z.string(),

  country: z.string().default("Unknown"),

  region: z.string().default("Unknown"),

  subregion: z.string().default(""),

  appellation: z.string().default(""),

  climat: z.string().default(""),

  cru_level: z
    .enum([
      "GRAND_CRU",
      "PREMIER_CRU",
      "VILLAGE",
      "REGIONAL",
      "NONE",
      "UNKNOWN",
    ])
    .default("UNKNOWN"),

  category: z
    .enum([
      "SPARKLING",
      "WHITE",
      "ROSE",
      "RED",
      "SPIRIT",
      "UNKNOWN",
    ])
    .default("UNKNOWN"),

  confidence: z.number().min(0).max(1).default(0),

  notes: z.string().default(""),
});

const ClassificationResult = z.object({
  wines: z.array(ClassifiedWine),
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
You are a professional wine-list classification assistant
for a restaurant in France.

Classify every supplied wine carefully.

The classification will later be used to build a professional
restaurant wine list, so geographic and appellation accuracy
is very important.

IMPORTANT GENERAL RULES

1. Preserve wine_id EXACTLY.

2. Return exactly one classification result for every input wine.

3. Identify:

   - country
   - region
   - subregion
   - appellation
   - climat
   - cru_level
   - category

4. Do not rely only on the existing color field.

The database may contain incomplete or incorrect values.

Use:

- producer
- wine_name
- cuvee
- color
- vintage
- professional wine knowledge

together.

5. Do not guess aggressively.

If the exact classification is uncertain:

- use the most conservative valid classification
- lower confidence
- explain the uncertainty briefly in notes


CATEGORY RULES

Use exactly one of:

SPARKLING
WHITE
ROSE
RED
SPIRIT
UNKNOWN

Champagne and Cremant must always be:

SPARKLING

even when the source color says White or Rose.

Cognac and Armagnac must always be:

SPIRIT

For normal still wines:

Red -> RED
White -> WHITE
Rose -> ROSE


VINTAGE RULE

"NV" means Non Vintage.

NV is a valid value.

Do NOT treat NV as missing information.

An empty vintage and NV are different.

Only explicit "NV", "Non Vintage", or "Non-Vintage"
should be interpreted as non-vintage.

Do NOT interpret "NM", "N.M.", or similar text as NV.

In Champagne, "NM" commonly means "Negociant-Manipulant".
It is a producer-status abbreviation, not a vintage indication.

Therefore:

CHAMPAGNE NM
-> do NOT interpret NM as Non Vintage
-> do NOT describe the wine as non-vintage merely because NM appears
-> if vintage is empty, leave the vintage interpretation unknown
-> notes must not say "non-vintage" unless NV, Non Vintage,
   or Non-Vintage is explicitly present in the supplied data

COGNAC NM
-> do NOT interpret NM as Non Vintage
-> do not invent a vintage meaning for NM

An empty vintage does NOT automatically mean Non Vintage.

If the source says NM and the vintage field is empty,
preserve that uncertainty and do not invent a vintage.
CRU LEVEL RULES

Use exactly one of:

GRAND_CRU
PREMIER_CRU
VILLAGE
REGIONAL
NONE
UNKNOWN


For Bourgogne:

GRAND_CRU:
Use when the wine is clearly a Burgundy Grand Cru appellation.

Examples:

Bonnes-Mares
Musigny
Chambertin
Chambertin-Clos de Beze
Mazis-Chambertin
Mazoyeres-Chambertin
Charmes-Chambertin
Ruchottes-Chambertin
Clos de la Roche
Clos Saint-Denis
Clos des Lambrays
Clos de Tart
Clos de Vougeot
Echezeaux
Grands-Echezeaux
Romanee-Conti
La Tache
Richebourg
Romanee-Saint-Vivant
La Romanee
Corton
Corton-Charlemagne
Montrachet
Batard-Montrachet
Bienvenues-Batard-Montrachet
Chevalier-Montrachet
Criots-Batard-Montrachet


PREMIER_CRU:
Use when the wine is clearly from a Burgundy Premier Cru vineyard
or Premier Cru appellation.

For display, always write "1er Cru", never "Premier Cru".

Examples:

Gevrey-Chambertin Clos Saint-Jacques
-> appellation = Gevrey-Chambertin 1er Cru
-> climat = Clos Saint-Jacques
-> cru_level = PREMIER_CRU

Nuits-Saint-Georges Les Cailles
-> appellation = Nuits-Saint-Georges 1er Cru
-> climat = Les Cailles
-> cru_level = PREMIER_CRU

Volnay Santenots
-> appellation = Volnay 1er Cru
-> climat = Santenots
-> cru_level = PREMIER_CRU



VILLAGE:
Use for Burgundy village-level appellations.

This includes village appellations in:
- Cote de Nuits
- Cote de Beaune
- Cote Chalonnaise

Examples:

Gevrey-Chambertin
Chambolle-Musigny
Morey-Saint-Denis
Vosne-Romanee
Nuits-Saint-Georges
Aloxe-Corton
Pernand-Vergelesses
Savigny-les-Beaune
Beaune
Pommard
Volnay
Meursault
Puligny-Montrachet
Chassagne-Montrachet
Saint-Aubin
Cote de Nuits-Villages
Givry
Mercurey
Rully
Montagny

Givry
-> appellation = Givry
-> cru_level = VILLAGE

Mercurey
-> appellation = Mercurey
-> cru_level = VILLAGE

Rully
-> appellation = Rully
-> cru_level = VILLAGE

Montagny
-> appellation = Montagny
-> cru_level = VILLAGE
REGIONAL:
Use for Burgundy regional appellations.

Examples:

Bourgogne
Bourgogne Rouge
Bourgogne Blanc
Bourgogne Aligote
Bourgogne Passe-Tout-Grains


NONE:
Use when the Burgundy cru hierarchy is not applicable.

Examples:

Champagne
Bordeaux
Loire
Rhone
Cognac
Armagnac


UNKNOWN:
Use only when there is not enough information to determine
the appropriate cru level.


APPELLATION AND CLIMAT RULES

The appellation field must contain the canonical legal appellation.

For Burgundy Premier Cru wines, always use "1er Cru"
instead of "Premier Cru".

The climat field contains the vineyard, climat or named lieu-dit
when it is useful and clearly identifiable.

Do not unnecessarily repeat the appellation in climat.

Examples:

Gevrey-Chambertin Clos Saint-Jacques
-> France / Bourgogne / Cote de Nuits
-> appellation = Gevrey-Chambertin 1er Cru
-> climat = Clos Saint-Jacques
-> PREMIER_CRU

Nuits-Saint-Georges Les Cailles
-> France / Bourgogne / Cote de Nuits
-> appellation = Nuits-Saint-Georges 1er Cru
-> climat = Les Cailles
-> PREMIER_CRU

Volnay Santenots
-> France / Bourgogne / Cote de Beaune
-> appellation = Volnay 1er Cru
-> climat = Santenots
-> PREMIER_CRU

Corton Perrieres
-> France / Bourgogne / Cote de Beaune
-> appellation = Corton
-> climat = Perrieres
-> GRAND_CRU
Bourgogne Rouge
-> appellation = Bourgogne
-> climat = ""

Cote de Nuits-Villages
-> appellation = Cote de Nuits-Villages
-> climat = ""


GEOGRAPHIC RULES

country and region are different fields.

country must contain the country, for example:

France
Italy
Spain
Germany
Japan

region must contain the actual wine-producing region.

Examples of French regions:

Bourgogne
Champagne
Bordeaux
Rhone
Loire
Alsace
Jura
Beaujolais
Provence
Languedoc-Roussillon
Sud-Ouest
Cognac
Armagnac

Examples outside France:

Italy
-> country = Italy
-> region should be the actual wine region when identifiable,
   for example Piemonte, Toscana, Veneto or Sicilia.

Spain
-> country = Spain
-> region should be the actual wine region when identifiable,
   for example Rioja, Ribera del Duero, Priorat or Jerez.

Germany
-> country = Germany
-> region should be the actual wine region when identifiable,
   for example Mosel, Rheingau, Pfalz or Baden.

Japan
-> country = Japan
-> region should be the actual wine region when identifiable,
   for example Yamanashi or Hokkaido.

Do NOT put a country name into region merely because the wine
comes from that country.

If the country is known but the exact region is not safely identifiable,
use region = "Unknown" rather than inventing a region.

For wines outside Bourgogne, cru_level should normally be NONE
unless the classification system represented by GRAND_CRU,
PREMIER_CRU, VILLAGE or REGIONAL clearly applies under these rules.

Do not use UNKNOWN merely because the wine is outside Bourgogne.
Use UNKNOWN only when there is genuinely insufficient information
to determine the appropriate cru_level.


BORDEAUX HISTORICAL APPELLATION RULE

Respect the historical appellation that was legally available
for the wine's vintage.

Do NOT retroactively apply a later appellation name to an older vintage.

Saint-Emilion was recognized as an appellation in 1936.

Saint-Emilion Grand Cru was initially recognized in 1954.

Therefore:

For Saint-Emilion wines from vintages before 1954:
-> do NOT classify them as Saint-Emilion Grand Cru
-> use appellation = Saint-Emilion when appropriate
-> cru_level = NONE

For wines from 1954 onward:
-> use Saint-Emilion Grand Cru only when the wine itself
   and reliable historical context support that appellation
-> do not infer Saint-Emilion Grand Cru merely from the reputation
   of the producer
-> if uncertain, use the most conservative historically valid
   appellation and lower confidence

The words "Grand Cru", "Grand Cru Classe",
and "Premier Grand Cru Classe" in Saint-Emilion
must NOT be mapped to the Burgundy cru_level values.

For Saint-Emilion and Saint-Emilion Grand Cru wines:
-> cru_level = NONE

Example:

Chateau Cheval Blanc 1951
-> country = France
-> region = Bordeaux
-> subregion = Saint-Emilion
-> appellation = Saint-Emilion
-> climat = ""
-> cru_level = NONE


Examples:
Bonnes-Mares
-> country = France
-> region = Bourgogne
-> subregion = Cote de Nuits
-> appellation = Bonnes-Mares
-> climat = ""
-> cru_level = GRAND_CRU

Echezeaux
-> country = France
-> region = Bourgogne
-> subregion = Cote de Nuits
-> appellation = Echezeaux
-> climat = ""
-> cru_level = GRAND_CRU

Clos de Vougeot
-> country = France
-> region = Bourgogne
-> subregion = Cote de Nuits
-> appellation = Clos de Vougeot
-> climat = ""
-> cru_level = GRAND_CRU

Ruchottes-Chambertin
-> country = France
-> region = Bourgogne
-> subregion = Cote de Nuits
-> appellation = Ruchottes-Chambertin
-> climat = ""
-> cru_level = GRAND_CRU

Gevrey-Chambertin
-> country = France
-> region = Bourgogne
-> subregion = Cote de Nuits
-> appellation = Gevrey-Chambertin
-> climat = ""
-> cru_level = VILLAGE

Gevrey-Chambertin Clos Saint-Jacques
-> country = France
-> region = Bourgogne
-> subregion = Cote de Nuits
-> appellation = Gevrey-Chambertin 1er Cru
-> climat = Clos Saint-Jacques
-> cru_level = PREMIER_CRU

Nuits-Saint-Georges Les Cailles
-> country = France
-> region = Bourgogne
-> subregion = Cote de Nuits
-> appellation = Nuits-Saint-Georges 1er Cru
-> climat = Les Cailles
-> cru_level = PREMIER_CRU

Volnay Santenots
-> country = France
-> region = Bourgogne
-> subregion = Cote de Beaune
-> appellation = Volnay 1er Cru
-> climat = Santenots
-> cru_level = PREMIER_CRU

Corton Perrieres
-> country = France
-> region = Bourgogne
-> subregion = Cote de Beaune
-> appellation = Corton
-> climat = Perrieres
-> cru_level = GRAND_CRU

Bourgogne Rouge
-> country = France
-> region = Bourgogne
-> subregion = ""
-> appellation = Bourgogne
-> climat = ""
-> cru_level = REGIONAL

Touraine Sauvignon
-> country = France
-> region = Loire
-> subregion = Touraine
-> appellation = Touraine
-> climat = ""
-> cru_level = NONE

VDP de Vaucluse by Domaine des Tours
-> country = France
-> region = Rhone
-> subregion = Southern Rhone
-> appellation = Vaucluse
-> climat = ""
-> cru_level = NONE

Chateau Lynch-Bages
-> country = France
-> region = Bordeaux
-> subregion = Medoc
-> appellation = Pauillac
-> climat = ""
-> cru_level = NONE

Champagne Dom Perignon
-> country = France
-> region = Champagne
-> subregion = Champagne
-> appellation = Champagne
-> climat = ""
-> cru_level = NONE
-> category = SPARKLING

Cognac Hennessy
-> country = France
-> region = Cognac
-> subregion = Cognac
-> appellation = Cognac
-> climat = ""
-> cru_level = NONE
-> category = SPIRIT


CONFIDENCE RULE

confidence must be between 0 and 1.

confidence must represent confidence in the COMPLETE classification:

- country
- region
- subregion
- appellation
- climat
- cru_level
- category

This confidence score is for an AI-generated classification
before human confirmation.

Never return confidence = 1.0 for an AI-generated classification.

Use the following calibration:

0.97 to 0.99
-> The classification is extremely clear from the supplied wine data.
-> Country, region, appellation, cru level and category are all
   strongly supported.
-> There is essentially no meaningful ambiguity.

0.90 to 0.96
-> The classification is strongly supported,
   but one part requires professional wine knowledge or inference.
-> Examples include historical appellation interpretation,
   inferred subregion, or a climat/classification that is not
   written completely in the source data.

0.75 to 0.89
-> The main region or appellation is likely correct,
   but there is meaningful uncertainty in at least one field.

0.50 to 0.74
-> Several fields require inference or the source data is incomplete.

Below 0.50
-> The classification is substantially uncertain.

Do NOT return a high confidence merely because the producer,
country or region is obvious.

The confidence score must reflect the weakest important part
of the COMPLETE classification.

If country and region are certain but the exact appellation,
climat, cru_level or category is uncertain,
the confidence must be reduced accordingly.

If historical appellation rules are required to interpret
an old vintage and the historical classification is not explicit
in the source wine name, normally do not exceed 0.95.

If a climat or lieu-dit is inferred rather than explicitly present
in the supplied wine data, normally do not exceed 0.95.

Use 0.99 only for exceptionally clear cases.
Do not routinely use 0.99 for every obvious wine.


OUTPUT RULES

Return JSON only.

Do not add Markdown.

Do not add explanations outside the JSON.


Required JSON shape:

{
  "wines": [
    {
      "wine_id": "",
      "country": "",
      "region": "",
      "subregion": "",
      "appellation": "",
      "climat": "",
      "cru_level": "GRAND_CRU | PREMIER_CRU | VILLAGE | REGIONAL | NONE | UNKNOWN",
      "category": "SPARKLING | WHITE | ROSE | RED | SPIRIT | UNKNOWN",
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

    const parsed = ClassificationResult.parse(
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
            "AI classification returned inconsistent wine IDs.",

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
          "Wine classification error",
      },
      {
        status: 500,
      }
    );
  }
}