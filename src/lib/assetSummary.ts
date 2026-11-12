// สรุปสต็อก Asset — query ฝั่ง server
// นับจาก transaction ล่าสุดของแต่ละ Barcode ที่ balance = 1 เท่านั้น
// (ไม่นับแถว balance = 1 ตรงๆ เพราะมีแถวเก่าที่ balance ค้าง 1 ทั้งที่ Barcode ย้ายไปแล้ว → ยอดจะเกิน)

import { prisma } from "@/lib/prisma";
import { NO_WAREHOUSE, type SummaryRow } from "@/lib/assetSummaryPivot";

export async function getInStockSummaryRows(): Promise<SummaryRow[]> {
  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      t."assetName" AS "assetName",
      COALESCE(NULLIF(TRIM(t."warehouseIn"), ''), ${NO_WAREHOUSE}) AS "warehouse",
      CASE
        WHEN UPPER(TRIM(t."assetStatus")) = 'NEW' THEN 'NEW'
        WHEN UPPER(TRIM(t."assetStatus")) LIKE 'REFURBISH%' THEN 'REFURBISHED'
        WHEN UPPER(TRIM(t."assetStatus")) = 'USED' THEN 'USED'
        ELSE 'ไม่ระบุ'
      END AS "status",
      COUNT(*)::int AS "count"
    FROM (
      SELECT DISTINCT ON (barcode) *
      FROM "AssetTransactionHistory"
      ORDER BY barcode, id DESC
    ) t
    WHERE t.balance = 1
    GROUP BY 1, 2, 3
  `;
  return rows;
}
