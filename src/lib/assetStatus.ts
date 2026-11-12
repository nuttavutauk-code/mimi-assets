// หา Asset Status เดิมของ Barcode (ใช้ตอนของกลับเข้าสต็อก)
//
// ปัญหา: ตอนเบิกออก (Picker) ระบบเขียน assetStatus ทับเป็น "-" ตามกฎ SYSTEM_RULES.md
// ทำให้เมื่อของกลับเข้าสต็อก (ลบเอกสาร / เปลี่ยน Barcode / รับโอนย้าย) ไม่รู้ว่าเดิมเป็นอะไร
// วิธีแก้: ไล่ดูประวัติของ Barcode จากใหม่ไปเก่า แล้วอนุมาน Status จากฟิลด์ที่ไม่ถูกเขียนทับ
// (remarkIn, newInStock, refurbishedInStock, mcsCodeIn)

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export interface StatusSource {
  assetStatus: string | null;
  remarkIn: string | null;
  mcsCodeIn: string | null;
  newInStock: string | null;
  refurbishedInStock: string | null;
  wkInForRepair: string | null;
}

const statusSelect = {
  id: true,
  assetStatus: true,
  remarkIn: true,
  mcsCodeIn: true,
  newInStock: true,
  refurbishedInStock: true,
  wkInForRepair: true,
} as const;

/** Status ที่ถือว่าเป็นค่าจริง (ไม่ใช่ "-" หรือว่าง) */
export function isRealAssetStatus(status: string | null | undefined): boolean {
  const s = (status || "").trim().toUpperCase();
  return s === "NEW" || s === "USED" || s.startsWith("REFURBISH");
}

/**
 * อนุมาน Status จากแถวเดียว คืน null ถ้าแถวนี้บอกไม่ได้ (เช่นแถวรับโอนย้าย → ต้องดูแถวก่อนหน้า)
 */
export function inferStatusFromRow(row: StatusSource): string | null {
  if (isRealAssetStatus(row.assetStatus)) return row.assetStatus!.trim();

  const remark = (row.remarkIn || "").trim();
  if (remark === "New Asset add to WH" || row.newInStock) return "NEW";
  if (remark === "Import Asset USED") return "USED";
  if (remark === "Import Asset REFURBISHED") return "REFURBISHED";
  if (remark === "ซ่อมเสร็จ" || row.refurbishedInStock) return "REFURBISH";
  // เก็บกลับจากร้าน/งานยืม: อนุมัติใบเก็บกลับบันทึก remarkIn "-" เสมอ → USED
  if (remark === "-") return "USED";
  // ข้อมูลเก่า: remarkIn ว่าง แต่มี MCS Code ของร้านต้นทาง → เก็บกลับจากร้าน → USED
  const mcs = (row.mcsCodeIn || "").trim();
  if (remark === "" && mcs && mcs !== "-" && mcs !== "_") return "USED";
  return null;
}

/** แถวรับโอนย้ายระหว่างโกดัง (receive-transfer) — ไม่มีข้อมูล Status ของตัวเอง ต้องดูแถวก่อนหน้า */
function isTransferInRow(row: StatusSource): boolean {
  return !!row.wkInForRepair && row.mcsCodeIn === "-";
}

/**
 * หา Status เดิมของ Barcode โดยไล่จากแถว upToId (รวมแถวนั้น) ย้อนไปแถวเก่า
 * ไม่ระบุ upToId = ดูทุกแถว คืน null ถ้าหาไม่ได้
 */
export async function resolveOriginalAssetStatus(
  barcode: string,
  upToId?: number,
  db: Db = prisma
): Promise<string | null> {
  const rows = await db.assetTransactionHistory.findMany({
    where: { barcode, ...(upToId ? { id: { lte: upToId } } : {}) },
    select: statusSelect,
    orderBy: { id: "desc" },
  });
  for (const row of rows) {
    const status = inferStatusFromRow(row);
    if (status) return status;
    // ไล่ต่อเฉพาะแถวรับโอนย้าย ถ้าเป็นแถวที่ไม่รู้ที่มา → หยุด (ปลอดภัยกว่าเดา)
    if (!isTransferInRow(row)) return null;
  }
  return null;
}
