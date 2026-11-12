// Logic เลือก Barcode อัตโนมัติ (ใช้ฝั่ง server เท่านั้น)
// กฎ:
//   1. Balance = 1 (เช็คจาก transaction ล่าสุดของ Barcode นั้น และต้องอยู่ในโกดังที่ระบุ)
//   2. Asset Status = NEW ก่อน ถ้าไม่มีค่อยเป็น REFURBISHED (USED/ค่าว่าง/อื่นๆ ไม่เลือก) — ใช้กับ CONTROLBOX ด้วย
//   3. In stock Date ใหม่สุดก่อน
//   + ถ้าระบุ size → size ต้องตรงกัน
//   + ตัด Barcode ที่ถูก assign ค้างใน PickAssetTask และที่ส่งมาใน exclude

import { prisma } from "@/lib/prisma";

export interface PickParams {
  assetName: string;
  warehouse: string;
  size?: string | null;
  isSecuritySet?: boolean;
  limit: number;
  exclude?: Iterable<string>;
}

export interface WarehouseAllocation {
  warehouse: string;
  barcodes: string[];
}

interface Candidate {
  barcode: string;
  assetStatus: string | null;
  inStockDate: Date | null;
}

function statusRank(status: string | null): number {
  const s = (status || "").trim().toUpperCase();
  if (s === "NEW") return 0;
  if (s.startsWith("REFURBISH")) return 1; // REFURBISHED / REFURBISH
  return -1; // ไม่เลือก
}

function sortCandidates(list: Candidate[]): Candidate[] {
  const rank = (c: Candidate) => statusRank(c.assetStatus);
  return list
    .filter((c) => rank(c) >= 0)
    .sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      const ta = a.inStockDate ? a.inStockDate.getTime() : -Infinity;
      const tb = b.inStockDate ? b.inStockDate.getTime() : -Infinity;
      if (ta !== tb) return tb - ta; // ใหม่สุดก่อน, ไม่มีวันที่อยู่ท้าย
      return a.barcode.localeCompare(b.barcode);
    });
}

export async function getAssignedBarcodes(): Promise<Set<string>> {
  const assigned = await prisma.pickAssetTask.findMany({
    where: {
      barcode: { not: null },
      status: { notIn: ["completed", "cancelled"] },
    },
    select: { barcode: true },
  });
  return new Set(assigned.map((t) => t.barcode!).filter(Boolean));
}

/**
 * หา Barcode ที่ผ่านเงื่อนไขในโกดังเดียว เรียงตามลำดับความสำคัญ (สูงสุด limit ตัว)
 */
export async function pickBarcodesForWarehouse(
  params: PickParams,
  assigned?: Set<string>
): Promise<string[]> {
  const { assetName, warehouse, isSecuritySet = false, limit } = params;
  const size = (params.size || "").trim();
  if (!assetName || !warehouse || limit <= 0) return [];

  const exclude = new Set(params.exclude || []);
  const assignedSet = assigned ?? (await getAssignedBarcodes());
  const sizeFilter = size ? { size: { equals: size, mode: "insensitive" as const } } : {};

  let latest: (Candidate & { balance: number; warehouseIn: string | null })[] = [];

  if (isSecuritySet) {
    const rows = await prisma.securitySetTransaction.findMany({
      where: { assetName, warehouseIn: warehouse, balance: 1, barcode: { not: null }, ...sizeFilter },
      select: { barcode: true },
      distinct: ["barcode"],
    });
    const barcodes = rows.map((r) => r.barcode!).filter((b) => b && !exclude.has(b) && !assignedSet.has(b));
    if (barcodes.length === 0) return [];
    const latestRows = await prisma.securitySetTransaction.findMany({
      where: { barcode: { in: barcodes } },
      select: { barcode: true, balance: true, warehouseIn: true, assetStatus: true, inStockDate: true },
      orderBy: [{ barcode: "asc" }, { id: "desc" }],
      distinct: ["barcode"],
    });
    latest = latestRows.map((r) => ({ ...r, barcode: r.barcode! }));
  } else {
    const rows = await prisma.assetTransactionHistory.findMany({
      where: { assetName, warehouseIn: warehouse, balance: 1, ...sizeFilter },
      select: { barcode: true },
      distinct: ["barcode"],
    });
    const barcodes = rows.map((r) => r.barcode).filter((b) => b && !exclude.has(b) && !assignedSet.has(b));
    if (barcodes.length === 0) return [];
    latest = await prisma.assetTransactionHistory.findMany({
      where: { barcode: { in: barcodes } },
      select: { barcode: true, balance: true, warehouseIn: true, assetStatus: true, inStockDate: true },
      orderBy: [{ barcode: "asc" }, { id: "desc" }],
      distinct: ["barcode"],
    });
  }

  // transaction ล่าสุดต้องยังอยู่ในโกดังนี้และ balance = 1
  const valid = latest.filter((r) => r.balance === 1 && r.warehouseIn === warehouse);
  return sortCandidates(valid)
    .slice(0, limit)
    .map((c) => c.barcode);
}

/**
 * เลือก Barcode ตาม rule (โกดัง 1 → โกดัง 2)
 * allowSplit = true  → เอาจากโกดัง 1 เท่าที่มี ส่วนที่ขาดเอาจากโกดัง 2 (อาจได้ 2 allocation)
 * allowSplit = false → ใช้โกดังเดียว: โกดัง 1 ถ้าพอ, ไม่พอใช้โกดัง 2 ถ้าพอ, ไม่พอทั้งคู่ใช้โกดังที่มีมากกว่า
 */
export async function allocateBarcodes(opts: {
  assetName: string;
  size?: string | null;
  qty: number;
  isSecuritySet?: boolean;
  exclude?: string[];
  warehouse1: string;
  warehouse2?: string | null;
  allowSplit: boolean;
}): Promise<{ allocations: WarehouseAllocation[]; shortfall: number }> {
  const { qty, warehouse1, allowSplit } = opts;
  const warehouse2 = opts.warehouse2 && opts.warehouse2 !== warehouse1 ? opts.warehouse2 : null;
  const assigned = await getAssignedBarcodes();
  const base = {
    assetName: opts.assetName,
    size: opts.size,
    isSecuritySet: opts.isSecuritySet,
    exclude: opts.exclude || [],
  };

  const fromW1 = await pickBarcodesForWarehouse({ ...base, warehouse: warehouse1, limit: qty }, assigned);

  if (fromW1.length >= qty || !warehouse2) {
    return {
      allocations: fromW1.length > 0 ? [{ warehouse: warehouse1, barcodes: fromW1 }] : [],
      shortfall: qty - fromW1.length,
    };
  }

  if (allowSplit) {
    const remaining = qty - fromW1.length;
    const fromW2 = await pickBarcodesForWarehouse(
      { ...base, warehouse: warehouse2, limit: remaining, exclude: [...base.exclude, ...fromW1] },
      assigned
    );
    const allocations: WarehouseAllocation[] = [];
    if (fromW1.length > 0) allocations.push({ warehouse: warehouse1, barcodes: fromW1 });
    if (fromW2.length > 0) allocations.push({ warehouse: warehouse2, barcodes: fromW2 });
    return { allocations, shortfall: remaining - fromW2.length };
  }

  const fromW2 = await pickBarcodesForWarehouse({ ...base, warehouse: warehouse2, limit: qty }, assigned);
  const best =
    fromW2.length > fromW1.length
      ? { warehouse: warehouse2, barcodes: fromW2 }
      : { warehouse: warehouse1, barcodes: fromW1 };
  return {
    allocations: best.barcodes.length > 0 ? [best] : [],
    shortfall: qty - best.barcodes.length,
  };
}
