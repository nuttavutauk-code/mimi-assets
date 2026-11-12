// สรุปสต็อก Asset — ฟังก์ชัน pivot (ไม่มี DB ใช้ได้ทั้ง client และ server)

export const SUMMARY_STATUSES = ["NEW", "REFURBISHED", "USED"] as const;
export type SummaryStatus = (typeof SUMMARY_STATUSES)[number] | "ไม่ระบุ";
export const NO_WAREHOUSE = "(ไม่ระบุโกดัง)";

export interface SummaryRow {
  assetName: string;
  warehouse: string;
  status: SummaryStatus;
  count: number;
}

export type StatusCounts = Record<SummaryStatus, number>;

export interface GroupDetail {
  key: string; // ชื่อโกดัง (ในกลุ่ม Asset) หรือชื่อ Asset (ในกลุ่มโกดัง)
  total: number;
  byStatus: StatusCounts;
}

export interface Group {
  key: string;
  total: number;
  byStatus: StatusCounts;
  details: GroupDetail[]; // เรียงจากมากไปน้อย
}

const emptyCounts = (): StatusCounts => ({ NEW: 0, REFURBISHED: 0, USED: 0, "ไม่ระบุ": 0 });

/** กรองตาม Status และคำค้น (ค้นทั้ง Asset Name และชื่อโกดัง) */
export function filterSummaryRows(rows: SummaryRow[], status: string, search: string): SummaryRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!status || status === "ALL" || r.status === status) &&
      (!q || r.assetName.toLowerCase().includes(q) || r.warehouse.toLowerCase().includes(q))
  );
}

/** รวมกลุ่มตาม Asset Name (details = โกดัง) หรือตามโกดัง (details = Asset Name) */
export function groupSummary(rows: SummaryRow[], by: "asset" | "warehouse"): Group[] {
  const groups = new Map<string, { total: number; byStatus: StatusCounts; details: Map<string, GroupDetail> }>();
  for (const r of rows) {
    const key = by === "asset" ? r.assetName : r.warehouse;
    const sub = by === "asset" ? r.warehouse : r.assetName;
    let g = groups.get(key);
    if (!g) {
      g = { total: 0, byStatus: emptyCounts(), details: new Map() };
      groups.set(key, g);
    }
    g.total += r.count;
    g.byStatus[r.status] += r.count;
    let d = g.details.get(sub);
    if (!d) {
      d = { key: sub, total: 0, byStatus: emptyCounts() };
      g.details.set(sub, d);
    }
    d.total += r.count;
    d.byStatus[r.status] += r.count;
  }
  const byTotal = <T extends { total: number; key: string }>(a: T, b: T) => b.total - a.total || a.key.localeCompare(b.key);
  return Array.from(groups.entries())
    .map(([key, g]) => ({ key, total: g.total, byStatus: g.byStatus, details: Array.from(g.details.values()).sort(byTotal) }))
    .sort(byTotal);
}

export interface Pivot {
  assets: string[]; // แถว (เรียงตามยอดรวม)
  warehouses: string[]; // คอลัมน์ (เรียงตามยอดรวม, "ไม่ระบุโกดัง" อยู่ท้าย)
  cells: Record<string, Record<string, number>>; // cells[asset][warehouse]
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
}

/** ตารางไขว้ Asset Name × โกดัง */
export function buildPivot(rows: SummaryRow[]): Pivot {
  const cells: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const r of rows) {
    (cells[r.assetName] ??= {})[r.warehouse] = (cells[r.assetName][r.warehouse] || 0) + r.count;
    rowTotals[r.assetName] = (rowTotals[r.assetName] || 0) + r.count;
    colTotals[r.warehouse] = (colTotals[r.warehouse] || 0) + r.count;
    grandTotal += r.count;
  }
  const assets = Object.keys(rowTotals).sort((a, b) => rowTotals[b] - rowTotals[a] || a.localeCompare(b));
  const warehouses = Object.keys(colTotals).sort((a, b) => {
    if (a === NO_WAREHOUSE) return 1;
    if (b === NO_WAREHOUSE) return -1;
    return colTotals[b] - colTotals[a] || a.localeCompare(b);
  });
  return { assets, warehouses, cells, rowTotals, colTotals, grandTotal };
}
