export const VENDOR_LIST = [
  "THAIARUS",
  "RICCO",
  "NEWLOOK",
  "LEGEND",
  "TDT",
  "NATTHAKIT",
  "9RAEK",
  "Cheil PH",
  "WORKO PLUS",
  "DOUBLE P",
  "TNB",
  "New Look",
  "ONERX",
  "Future",
  "Neri",
  "Imaginative",
  "AdRun",
  "Double B",
] as const;

export const JOB_TYPE_KEYWORDS = [
  "Repair",
  "Transportation",
  "Production",
  "Checking",
  "Modify",
  "Spare part",
] as const;

export const DOC_TYPES = ["cheil_po", "samsung_po", "quotation"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABEL: Record<DocType | "unknown", string> = {
  cheil_po: "Cheil PO",
  samsung_po: "Samsung PO",
  quotation: "ใบเสนอราคา",
  unknown: "ไม่รู้จัก (ข้าม)",
};

export const MAX_FILES_PER_JOB = 5;
// Next.js buffers bodies through middleware up to 10MB (experimental.middlewareClientMaxBodySize)
export const MAX_TOTAL_UPLOAD_BYTES = 9 * 1024 * 1024;

export type FieldKind = "auto" | "manual";
export type FieldType = "text" | "number";

// ลำดับตรงกับ template Excel 28 คอลัมน์
export const PO_COLUMNS = [
  { header: "No.", field: "no", kind: "manual", type: "text" },
  { header: "VENDOR", field: "vendor", kind: "auto", type: "text" },
  { header: "Job Type", field: "jobType", kind: "auto", type: "text" },
  { header: "ASSET TYPE", field: "assetType", kind: "auto", type: "text" },
  { header: "Asset Type2", field: "assetType2", kind: "manual", type: "text" },
  { header: "ORDER QTY", field: "orderQty", kind: "auto", type: "number" },
  { header: "ESTIMATE", field: "estimate", kind: "auto", type: "text" },
  { header: "Total Cost", field: "totalCost", kind: "auto", type: "number" },
  { header: "Cost per unit", field: "costPerUnit", kind: "auto", type: "number" },
  { header: "New Production Unit Price", field: "newProductionUnitPrice", kind: "manual", type: "text" },
  { header: "Saving cost per unit", field: "savingCostPerUnit", kind: "manual", type: "text" },
  { header: "Saving cost per unit (%)", field: "savingCostPerUnitPct", kind: "manual", type: "text" },
  { header: "Total New Production", field: "totalNewProduction", kind: "manual", type: "text" },
  { header: "Total Saving cost", field: "totalSavingCost", kind: "manual", type: "text" },
  { header: "SS PO", field: "ssPo", kind: "auto", type: "text" },
  { header: "DATE", field: "ssPoDate", kind: "auto", type: "text" },
  { header: "Quarter", field: "quarter", kind: "manual", type: "text" },
  { header: "Month", field: "month", kind: "manual", type: "text" },
  { header: "CH PO", field: "chPo", kind: "auto", type: "text" },
  { header: "DATE3", field: "chPoDate", kind: "auto", type: "text" },
  { header: "JOB NO.", field: "jobNo", kind: "auto", type: "text" },
  { header: "Done BY", field: "doneBy", kind: "manual", type: "text" },
  { header: "ACTUAL LEADTIME", field: "actualLeadtime", kind: "manual", type: "text" },
  { header: "Targeting Leadtime", field: "targetingLeadtime", kind: "manual", type: "text" },
  { header: "STATUS", field: "status", kind: "manual", type: "text" },
  { header: "PM", field: "pm", kind: "manual", type: "text" },
  { header: "Sent Report to TSE", field: "sentReportToTse", kind: "manual", type: "text" },
  { header: "Remark 1", field: "remark1", kind: "manual", type: "text" },
] as const satisfies readonly { header: string; field: string; kind: FieldKind; type: FieldType }[];

export type PoRowField =
  | "no" | "vendor" | "jobType" | "assetType" | "assetType2" | "orderQty" | "estimate"
  | "totalCost" | "costPerUnit" | "newProductionUnitPrice" | "savingCostPerUnit"
  | "savingCostPerUnitPct" | "totalNewProduction" | "totalSavingCost" | "ssPo" | "ssPoDate"
  | "quarter" | "month" | "chPo" | "chPoDate" | "jobNo" | "doneBy" | "actualLeadtime"
  | "targetingLeadtime" | "status" | "pm" | "sentReportToTse" | "remark1";

export type PoRowData = { [K in PoRowField]: K extends "orderQty" | "totalCost" | "costPerUnit" ? number | null : string | null };

export const PO_FIELDS: PoRowField[] = PO_COLUMNS.map((c) => c.field);
export const NUMBER_FIELDS = new Set<PoRowField>(PO_COLUMNS.filter((c) => c.type === "number").map((c) => c.field));

export function emptyRow(): PoRowData {
  return Object.fromEntries(PO_FIELDS.map((f) => [f, null])) as PoRowData;
}

// ทำความสะอาดข้อมูลที่มาจาก client: รับเฉพาะ field ที่รู้จัก, แปลงชนิดให้ถูก
export function sanitizeRowInput(input: Record<string, unknown>): Partial<PoRowData> {
  const out: Record<string, string | number | null> = {};
  for (const field of PO_FIELDS) {
    if (!(field in input)) continue;
    const raw = input[field];
    if (NUMBER_FIELDS.has(field)) {
      if (raw === null || raw === undefined || raw === "") out[field] = null;
      else {
        const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").trim());
        out[field] = Number.isFinite(n) ? n : null;
      }
    } else {
      const s = raw === null || raw === undefined ? "" : String(raw).trim();
      out[field] = s === "" ? null : s;
    }
  }
  return out as Partial<PoRowData>;
}
