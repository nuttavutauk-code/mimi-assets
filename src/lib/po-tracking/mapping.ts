import { JOB_TYPE_KEYWORDS, VENDOR_LIST, emptyRow, type PoRowData } from "./constants";
import type { ExtractedDocument, ExtractedLineItem } from "./extract";

export interface BuildResult {
  rows: PoRowData[];
  warnings: string[];
}

const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9ก-๙]/g, "");

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005);

const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function isoToDMY(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  let year = Number(m[1]);
  if (year > 2400) year -= 543;
  return `${Number(m[3])}/${Number(m[2])}/${year}`;
}

export function matchVendor(vendorMatch: string | null, issuer: string | null): string | null {
  if (vendorMatch && (VENDOR_LIST as readonly string[]).includes(vendorMatch)) return vendorMatch;
  if (!issuer) return null;
  const target = normalize(issuer);
  // ชื่อยาวก่อน เพื่อให้ "WORKO PLUS" ชนะ "WORKO", "New Look" ชนะ "NEWLOOK" (อยู่ท้ายลิสต์)
  const candidates = [...VENDOR_LIST].reverse().sort((a, b) => normalize(b).length - normalize(a).length);
  return candidates.find((v) => target.includes(normalize(v))) ?? null;
}

export function matchJobType(subject: string | null): string | null {
  if (!subject) return null;
  const colon = subject.indexOf(":");
  const tail = colon >= 0 ? subject.slice(colon + 1) : subject;
  const find = (text: string) => {
    const upper = text.toUpperCase().replace(/\s+/g, " ");
    let best: { kw: string; pos: number } | null = null;
    for (const kw of JOB_TYPE_KEYWORDS) {
      const variants = [kw.toUpperCase(), kw.toUpperCase().replace(/\s/g, "")];
      for (const v of variants) {
        const pos = upper.indexOf(v);
        if (pos >= 0 && (!best || pos < best.pos)) best = { kw, pos };
      }
    }
    return best?.kw ?? null;
  };
  return find(tail) ?? find(subject);
}

function pickQuotationItem(
  cheilItem: ExtractedLineItem,
  index: number,
  cheilCount: number,
  quoteItems: ExtractedLineItem[],
  used: Set<number>,
): ExtractedLineItem | null {
  if (quoteItems.length === cheilCount && !used.has(index)) {
    used.add(index);
    return quoteItems[index];
  }
  const idx = quoteItems.findIndex(
    (q, i) =>
      !used.has(i) &&
      ((q.totalPrice != null && cheilItem.totalPrice != null && nearlyEqual(q.totalPrice, cheilItem.totalPrice)) ||
        (q.qty != null && cheilItem.qty != null && q.qty === cheilItem.qty &&
          q.unitPrice != null && cheilItem.unitPrice != null && nearlyEqual(q.unitPrice, cheilItem.unitPrice))),
  );
  if (idx < 0) return null;
  used.add(idx);
  return quoteItems[idx];
}

export function buildRows(
  cheil: ExtractedDocument,
  samsung: ExtractedDocument,
  quotation: ExtractedDocument,
): BuildResult {
  const warnings: string[] = [];

  const vendor = matchVendor(quotation.vendorMatch, quotation.issuerCompany);
  if (!vendor) {
    warnings.push(`หา VENDOR ในรายชื่อไม่เจอ (ใบเสนอราคาออกโดย: ${quotation.issuerCompany ?? "ไม่ทราบ"}) — กรุณาเลือกเอง`);
  }

  const jobType = matchJobType(cheil.subject);
  if (!jobType) warnings.push(`หา Job Type ไม่เจอใน Subject ของ Cheil PO: "${cheil.subject ?? "-"}"`);

  const jobNo = cheil.jobNo;
  if (!jobNo) warnings.push("ไม่พบ Job ใน Cheil PO");
  for (const [label, doc] of [["Samsung PO", samsung], ["ใบเสนอราคา", quotation]] as const) {
    if (jobNo && doc.jobNo && normalize(doc.jobNo) !== normalize(jobNo)) {
      warnings.push(`JOB NO. ไม่ตรงกัน: Cheil PO = ${jobNo}, ${label} = ${doc.jobNo}`);
    }
  }
  if (jobNo && !samsung.jobNo) warnings.push("ไม่พบเลข Job อ้างอิงใน Samsung PO — ตรวจสอบว่าเป็นชุดเดียวกัน");

  const shared: Partial<PoRowData> = {
    vendor,
    jobType,
    estimate: isoToDMY(quotation.documentDate),
    ssPo: samsung.documentNumber,
    ssPoDate: isoToDMY(samsung.documentDate),
    chPo: cheil.documentNumber,
    chPoDate: isoToDMY(cheil.documentDate),
    jobNo,
  };
  if (!shared.estimate) warnings.push("ไม่พบวันที่ของใบเสนอราคา (ESTIMATE)");
  if (!shared.ssPo) warnings.push("ไม่พบเลข Samsung PO");
  if (!shared.chPo) warnings.push("ไม่พบเลข Cheil PO");

  const cheilItems = cheil.lineItems;
  const quoteItems = quotation.lineItems;
  if (cheilItems.length === 0) warnings.push("ไม่พบรายการ asset ใน Cheil PO — สร้างแถวว่างให้กรอกเอง");
  if (cheilItems.length > 0 && quoteItems.length > 0 && cheilItems.length !== quoteItems.length) {
    warnings.push(`จำนวนรายการไม่เท่ากัน: Cheil PO ${cheilItems.length} รายการ, ใบเสนอราคา ${quoteItems.length} รายการ`);
  }

  const used = new Set<number>();
  const rows: PoRowData[] = (cheilItems.length ? cheilItems : [null]).map((item, i) => {
    const row: PoRowData = { ...emptyRow(), ...shared };
    if (!item) return row;

    const quote = pickQuotationItem(item, i, cheilItems.length, quoteItems, used);
    const qty = item.qty ?? quote?.qty ?? null;
    const unit = item.unitPrice ?? quote?.unitPrice ?? null;
    let total = item.totalPrice ?? quote?.totalPrice ?? null;
    if (total == null && qty != null && unit != null) total = qty * unit;

    row.assetType = item.description;
    row.orderQty = qty;
    row.costPerUnit = unit;
    row.totalCost = total;

    const name = `"${item.description}"`;
    if (qty != null && unit != null && total != null && !nearlyEqual(qty * unit, total)) {
      warnings.push(`${name}: ${fmtNum(qty)} × ${fmtNum(unit)} ≠ ${fmtNum(total)}`);
    }
    if (quoteItems.length && !quote) {
      warnings.push(`${name}: จับคู่กับรายการในใบเสนอราคาไม่ได้ — ใช้ราคาจาก Cheil PO`);
    }
    if (quote?.unitPrice != null && item.unitPrice != null && !nearlyEqual(quote.unitPrice, item.unitPrice)) {
      warnings.push(`${name}: ราคาต่อหน่วยไม่ตรงกัน Cheil PO ${fmtNum(item.unitPrice)} / ใบเสนอราคา ${fmtNum(quote.unitPrice)}`);
    }
    if (quote?.qty != null && item.qty != null && quote.qty !== item.qty) {
      warnings.push(`${name}: จำนวนไม่ตรงกัน Cheil PO ${fmtNum(item.qty)} / ใบเสนอราคา ${fmtNum(quote.qty)}`);
    }
    return row;
  });

  const totals = [
    ["Cheil PO", cheil.subtotal],
    ["Samsung PO", samsung.subtotal],
    ["ใบเสนอราคา", quotation.subtotal],
  ].filter((t): t is [string, number] => t[1] != null);
  if (totals.length > 1 && totals.some(([, v]) => !nearlyEqual(v, totals[0][1]))) {
    warnings.push(`ยอดรวม (ก่อน VAT) ไม่ตรงกัน: ${totals.map(([l, v]) => `${l} ${fmtNum(v)}`).join(", ")}`);
  }
  const rowSum = rows.reduce((s, r) => s + (r.totalCost ?? 0), 0);
  if (cheil.subtotal != null && rows.every((r) => r.totalCost != null) && !nearlyEqual(rowSum, cheil.subtotal)) {
    warnings.push(`ผลรวม Total Cost ทุกแถว (${fmtNum(rowSum)}) ≠ Sub Total ของ Cheil PO (${fmtNum(cheil.subtotal)})`);
  }

  for (const [label, doc] of [["Cheil PO", cheil], ["Samsung PO", samsung], ["ใบเสนอราคา", quotation]] as const) {
    for (const note of doc.notes) warnings.push(`[AI · ${label}] ${note}`);
  }

  return { rows, warnings };
}
