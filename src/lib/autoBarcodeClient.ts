// เรียก API เลือก Barcode อัตโนมัติ (ฝั่ง client) + แจ้งเตือนผลลัพธ์
import { toast } from "sonner";

export interface AutoBarcodeAllocation {
  warehouse: string;
  barcodes: string[];
}

export interface AutoBarcodeResult {
  allocations: AutoBarcodeAllocation[];
  shortfall: number;
}

/** CONTROLBOX → ดึงจาก SecuritySetTransaction */
export const isControlboxName = (name: string) => name.toUpperCase().includes("CONTROLBOX");

/**
 * คืน null ถ้าไม่มีการตั้งค่า / error / ไม่พบ Barcode เลย (แสดง toast ให้แล้ว)
 */
export async function requestAutoBarcodes(params: {
  assetName: string;
  size?: string | null;
  qty: number;
  isSecuritySet?: boolean;
  exclude?: string[];
  allowSplit?: boolean;
}): Promise<AutoBarcodeResult | null> {
  const assetName = params.assetName.trim();
  if (!assetName) {
    toast.error("กรุณาเลือก Asset Name ก่อน");
    return null;
  }
  try {
    const res = await fetch("/api/auto-barcode/pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, assetName }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.message || "เลือก Barcode อัตโนมัติไม่สำเร็จ");
      return null;
    }
    if (!json.ruleFound) {
      toast.warning(`ยังไม่ได้ตั้งค่า Auto Barcode สำหรับ "${assetName}"`);
      return null;
    }
    const allocations: AutoBarcodeAllocation[] = json.allocations || [];
    if (allocations.length === 0) {
      toast.warning(`ไม่พบ Barcode ที่ตรงเงื่อนไขสำหรับ "${assetName}"`);
      return null;
    }
    return { allocations, shortfall: json.shortfall || 0 };
  } catch (err) {
    console.error(err);
    toast.error("เลือก Barcode อัตโนมัติไม่สำเร็จ");
    return null;
  }
}

/** แจ้งผลหลังใส่ Barcode แล้ว */
export function notifyAutoResult(assetName: string, filled: number, missing: number) {
  if (missing > 0) {
    toast.warning(`"${assetName}" เลือกได้ ${filled} รายการ ขาดอีก ${missing} รายการ`);
  } else {
    toast.success(`เลือก Barcode อัตโนมัติ "${assetName}" ${filled} รายการ`);
  }
}

// ======================================================================
// Helpers สำหรับฟอร์ม (แถว Asset / แถว CONTROLBOX)
// ======================================================================

type SetState<T> = (updater: (prev: T) => T) => void;
type BarcodeRecord = Record<number, string[]>;

interface AutoRowLike {
  id: number;
  name: string;
  size?: string;
  qty: number;
  withdrawFor: string;
  useCustomSize?: boolean;
}

export interface AutoRowPlan {
  warehouse: string;
  qty: number;
  barcodes: string[];
  split?: { warehouse: string; qty: number; barcodes: string[] };
}

const pad = (barcodes: string[], length: number) =>
  Array.from({ length }, (_, i) => barcodes[i] || "");

/**
 * ขอผลจาก server แล้วแปลงเป็นแผนสำหรับแถว Asset
 * canSplit = false (แถวเต็ม) → ใช้โกดังเดียว
 */
export async function planAutoForAssetRow(row: AutoRowLike, exclude: string[], canSplit: boolean): Promise<AutoRowPlan | null> {
  const qty = Math.max(1, row.qty || 1);
  const result = await requestAutoBarcodes({
    assetName: row.name,
    size: row.useCustomSize ? "" : row.size || "",
    qty,
    isSecuritySet: isControlboxName(row.name),
    exclude,
    allowSplit: canSplit,
  });
  if (!result) return null;

  const [first, second] = result.allocations;
  const filled = result.allocations.reduce((n, a) => n + a.barcodes.length, 0);

  if (second) {
    const primaryQty = first.barcodes.length;
    const splitQty = qty - primaryQty;
    notifyAutoResult(row.name, filled, result.shortfall);
    toast.info(`แบ่งแถว: ${first.warehouse} ${primaryQty} รายการ / ${second.warehouse} ${splitQty} รายการ`);
    return {
      warehouse: first.warehouse,
      qty: primaryQty,
      barcodes: first.barcodes,
      split: { warehouse: second.warehouse, qty: splitQty, barcodes: pad(second.barcodes, splitQty) },
    };
  }

  if (!canSplit && result.shortfall > 0) {
    toast.warning("แถวเต็มแล้ว ไม่สามารถแบ่งแถวไปโกดังที่ 2 ได้");
  }
  notifyAutoResult(row.name, filled, result.shortfall);
  return { warehouse: first.warehouse, qty, barcodes: pad(first.barcodes, qty) };
}

/** ใส่แผนลงใน rows (แถวที่แบ่งจะถูกแทรกต่อจากแถวเดิม) */
export function applyAutoPlanToRows<T extends AutoRowLike>(rows: T[], rowId: number, plan: AutoRowPlan, newRowId?: number): T[] {
  const next: T[] = [];
  for (const r of rows) {
    if (r.id !== rowId) {
      next.push(r);
      continue;
    }
    next.push({ ...r, qty: plan.qty, withdrawFor: plan.warehouse });
    if (plan.split && newRowId !== undefined) {
      next.push({ ...r, id: newRowId, qty: plan.split.qty, withdrawFor: plan.split.warehouse });
    }
  }
  return next;
}

/** id ใหม่ที่ไม่ชนกับแถวที่มีอยู่ (บางฟอร์มไม่ได้ sync counter หลังโหลดเอกสาร) */
export function nextSafeId(counter: { current: number }, rows: { id: number }[]): number {
  const id = Math.max(counter.current, ...rows.map((r) => r.id + 1));
  counter.current = id + 1;
  return id;
}

/** barcode record ที่ต้อง merge เข้า state */
export function autoPlanBarcodes(rowId: number, plan: AutoRowPlan, newRowId?: number): BarcodeRecord {
  const rec: BarcodeRecord = { [rowId]: plan.barcodes };
  if (plan.split && newRowId !== undefined) rec[newRowId] = plan.split.barcodes;
  return rec;
}

/**
 * ใช้กับฟอร์มที่เก็บ rows / barcodes / sizeOptions เป็น state แยกกัน
 */
export async function runAutoForAssetRow<T extends AutoRowLike>(args: {
  row: T;
  rows: T[];
  maxRows: number;
  exclude: string[];
  idCounter: { current: number };
  setRows: SetState<T[]>;
  setBarcodes: SetState<BarcodeRecord>;
  setSizeOptions?: SetState<Record<number, string[]>>;
}) {
  const { row } = args;
  const plan = await planAutoForAssetRow(row, args.exclude, args.rows.length < args.maxRows);
  if (!plan) return;

  const newRowId = plan.split ? nextSafeId(args.idCounter, args.rows) : undefined;
  args.setRows((prev) => applyAutoPlanToRows(prev, row.id, plan, newRowId));
  args.setBarcodes((prev) => ({ ...prev, ...autoPlanBarcodes(row.id, plan, newRowId) }));
  if (newRowId !== undefined && args.setSizeOptions) {
    args.setSizeOptions((prev) => ({ ...prev, [newRowId]: prev[row.id] || [] }));
  }
}

/**
 * แถว CONTROLBOX (แบ่งแถวไม่ได้ → ใช้โกดังเดียว)
 */
export async function runAutoForSecuritySet<T extends { id: number; name: string; qty: number; withdrawFor: string }>(args: {
  set: T;
  exclude: string[];
  setSets: SetState<T[]>;
  setBarcodes: SetState<BarcodeRecord>;
}) {
  const { set } = args;
  const qty = Math.max(1, set.qty || 1);
  const result = await requestAutoBarcodes({
    assetName: set.name,
    qty,
    isSecuritySet: true,
    exclude: args.exclude,
    allowSplit: false,
  });
  if (!result) return;
  const alloc = result.allocations[0];
  args.setSets((prev) => prev.map((s) => (s.id === set.id ? { ...s, withdrawFor: alloc.warehouse } : s)));
  args.setBarcodes((prev) => ({ ...prev, [set.id]: pad(alloc.barcodes, qty) }));
  notifyAutoResult(set.name, alloc.barcodes.length, result.shortfall);
}
