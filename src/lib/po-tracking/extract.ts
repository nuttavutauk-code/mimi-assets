import Anthropic from "@anthropic-ai/sdk";
import { VENDOR_LIST } from "./constants";

export type ExtractedDocType = "cheil_po" | "samsung_po" | "quotation" | "unknown";

export interface ExtractedLineItem {
  description: string;
  qty: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface ExtractedDocument {
  pages: string; // e.g. "1" or "2-3"
  documentType: ExtractedDocType;
  documentTypeReason: string;
  documentNumber: string | null;
  documentDate: string | null; // ISO YYYY-MM-DD
  jobNo: string | null;
  subject: string | null;
  issuerCompany: string | null;
  vendorMatch: string | null;
  lineItems: ExtractedLineItem[];
  subtotal: number | null;
  notes: string[];
}

const MODEL = process.env.PO_TRACKING_MODEL || "claude-sonnet-5";

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ConfigError("ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ในไฟล์ .env");
  }
  if (!client) {
    // จำเป็นเฉพาะเมื่อ API key ไม่ได้ผูกกับ workspace
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    client = new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {});
  }
  return client;
}

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

const DOCUMENT_SCHEMA = {
  type: "object",
  properties: {
    pages: { type: "string" },
    documentType: { type: "string", enum: ["cheil_po", "samsung_po", "quotation", "unknown"] },
    documentTypeReason: { type: "string" },
    documentNumber: nullable({ type: "string" }),
    documentDate: nullable({ type: "string" }),
    jobNo: nullable({ type: "string" }),
    subject: nullable({ type: "string" }),
    issuerCompany: nullable({ type: "string" }),
    vendorMatch: nullable({ type: "string", enum: [...VENDOR_LIST] }),
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          qty: nullable({ type: "number" }),
          unitPrice: nullable({ type: "number" }),
          totalPrice: nullable({ type: "number" }),
        },
        required: ["description", "qty", "unitPrice", "totalPrice"],
        additionalProperties: false,
      },
    },
    subtotal: nullable({ type: "number" }),
    notes: { type: "array", items: { type: "string" } },
  },
  required: [
    "pages", "documentType", "documentTypeReason", "documentNumber", "documentDate", "jobNo", "subject",
    "issuerCompany", "vendorMatch", "lineItems", "subtotal", "notes",
  ],
  additionalProperties: false,
};

const OUTPUT_SCHEMA = {
  type: "object",
  properties: { documents: { type: "array", items: DOCUMENT_SCHEMA } },
  required: ["documents"],
  additionalProperties: false,
};

const INSTRUCTIONS = `You read one business PDF and return its data as JSON matching the schema. Read the page images, not just the text layer: some vendors' PDFs have a corrupted text layer, so trust what is visually printed.

## 0. Split the PDF into documents
One PDF may contain a single document spanning one or more pages, OR several different documents (e.g. page 1 a Cheil PO, page 2 a Samsung PO, page 3 a quotation). Return one entry in "documents" per distinct document, in page order, with "pages" set to its 1-based page range ("1", "2-3"). Continuation pages (page 2 of the same quotation, a terms-and-conditions page) belong to the document they continue, not a new entry. Every page must belong to exactly one entry; unrelated pages become "unknown" entries.

The rules below apply to each document entry.

## 1. Classify documentType
- "cheil_po": a Purchase Order issued BY Cheil (Thailand) Ltd. (Cheil logo, "Purchase Order") TO a production vendor. Has fields "P/O No.", "P/O Date", "Job", "Vendor", "Subject:".
- "samsung_po": a "BQMS Purchase Order" issued by Thai Samsung Electronics, where the Vendor is CHEIL (THAILAND) LTD.
- "quotation": the document contains the word "Quotation" or "ใบเสนอราคา" (a vendor's price quote, usually addressed to Cheil).
- "unknown": anything else (invoice, delivery note, unrelated document). For unknown, set every other field to null / empty.
Explain the decision briefly in documentTypeReason.

## 2. Fields
- documentNumber: cheil_po → P/O No. (e.g. THPI2602592). samsung_po → P/O No. (e.g. T26C5A0004079). quotation → quotation number.
- documentDate: the document's own date as ISO "YYYY-MM-DD". Date formats differ by document, resolve them carefully:
  - cheil_po "P/O Date" is DD-MM-YYYY (13-08-2026 → 2026-08-13).
  - samsung_po "P/O Date." is M/D/YYYY (8/11/2026 → 2026-08-11); a handwritten or printed "(DD/MM/YYYY)" next to it confirms the reading.
  - quotation date ("Estimate Date", "Date", "วันที่") is normally D/M/YYYY (4/8/2026 → 2026-08-04). Thai Buddhist-era years (e.g. 2569) must be converted by subtracting 543.
- jobNo: cheil_po → the "Job" field (e.g. THP26064167). samsung_po → the THP-number embedded in the description area (e.g. "PE THET2601358_THP26064167" → THP26064167). quotation → "Project Number" or any THP-number printed on the page. null if none.
- subject: cheil_po → the full text after "Subject:". quotation → project/job name. samsung_po → the Subject field.
- issuerCompany: the company that issued the document (for quotation: the vendor company in the letterhead; for cheil_po: the Vendor it is sent to).
- vendorMatch: ONLY for quotation — which name in the allowed list the issuing company corresponds to (e.g. "New Look Design Co., Ltd" / "บริษัท นิว ลุค ดีไซน์" → "New Look"; "RICCO 65" / "ริคโค่ 65" → "RICCO"). When both "NEWLOOK" and "New Look" fit, use "New Look". null if no confident match or not a quotation.
- subtotal: total amount BEFORE VAT (Sub Total / Total Cost / รวมเป็นเงิน / Total Amount on samsung_po). Plain number, no commas.

## 3. lineItems (most important for cheil_po)
- cheil_po: one item per individual asset/job. If a row's description lists several sub-items, e.g.
    REPAIR CLOSE SALES TABLE AND STOOL
    - REPAIR CLOSE SALES TABLE 6 UNITS (6 UNITS X 3,500.00 = 21,000.00)
    - REPAIR CLOSE SALES STOOL 12 UNITS (12 UNITS X 1,400.00 = 16,800.00)
  output each sub-item separately: description "REPAIR CLOSE SALES TABLE 6 UNITS", qty 6, unitPrice 3500, totalPrice 21000; then "REPAIR CLOSE SALES STOOL 12 UNITS", qty 12, unitPrice 1400, totalPrice 16800. Use the sub-item line text (without the calculation in parentheses) as description. Ignore the row-level "Qty 1.0" in that case. If a row has no sub-items, use the row's description, Qty, Unit Price, Amount.
- quotation: one item per priced line (skip section headers and zero/empty cost sections).
- samsung_po: its item line(s) as printed (qty/unitPrice may be null).
- Numbers are plain numbers without commas or currency. Do not invent values; use null when not printed.

## 4. notes
List anything a reviewer should double-check: unreadable values, sums that don't add up, multiple candidate values, handwritten corrections. Write notes in Thai. Empty array if nothing notable.`;

export class ExtractionError extends Error {}
class ConfigError extends Error {}

export async function extractDocuments(pdf: Buffer, filename: string): Promise<ExtractedDocument[]> {
  const isOpus5 = MODEL === "claude-opus-5";

  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    ...(isOpus5 ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
          },
          { type: "text", text: `${INSTRUCTIONS}\n\nFile name: ${filename}` },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new ExtractionError(`AI ปฏิเสธการอ่านไฟล์ ${filename}`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new ExtractionError(`ผลลัพธ์จาก AI ยาวเกินกำหนดสำหรับไฟล์ ${filename}`);
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new ExtractionError(`AI ไม่ได้ส่งผลลัพธ์กลับมาสำหรับไฟล์ ${filename}`);
  }

  try {
    return (JSON.parse(text.text) as { documents: ExtractedDocument[] }).documents;
  } catch {
    throw new ExtractionError(`อ่านผลลัพธ์จาก AI ไม่ได้สำหรับไฟล์ ${filename}`);
  }
}

export function describeAnthropicError(error: unknown): { message: string; status: number } {
  if (error instanceof ExtractionError) return { message: error.message, status: 422 };
  if (error instanceof ConfigError) return { message: error.message, status: 500 };
  if (error instanceof Anthropic.AuthenticationError) {
    return { message: "ANTHROPIC_API_KEY ไม่ถูกต้องหรือยังไม่ได้ตั้งค่า", status: 500 };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { message: "เรียกใช้ AI ถี่เกินไป กรุณาลองใหม่อีกครั้งในสักครู่", status: 429 };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { message: `AI ไม่รับไฟล์นี้: ${error.message}`, status: 400 };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { message: "เชื่อมต่อ AI ไม่ได้ กรุณาลองใหม่", status: 502 };
  }
  if (error instanceof Anthropic.APIError) {
    return { message: `AI ขัดข้อง (${error.status}) กรุณาลองใหม่`, status: 502 };
  }
  return { message: "เกิดข้อผิดพลาดระหว่างอ่านเอกสาร", status: 500 };
}
