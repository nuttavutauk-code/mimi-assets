// scripts/backfill-security-set-status.ts
// เติม assetStatus ให้ SecuritySetTransaction เดิมที่ยังว่าง (โค้ดเก่าไม่ได้บันทึก Status ของ Security Set)
//
// Mapping จาก remarkIn (ที่มาของรายการ):
//   "New Security Set add to WH"       → NEW          (Import New)
//   "Import Security Set USED"          → USED         (Import Used)
//   "Import Security Set REFURBISHED"   → REFURBISHED  (Import Refurbished)
//   "-"                                 → USED         (อนุมัติใบเก็บ Asset กลับ)
// แถวอื่น (เช่น remarkIn ว่าง = รายการขา OUT ของ Security Type C) ไม่แตะ
// แก้เฉพาะแถวที่ assetStatus ยังว่าง (null หรือ "") เท่านั้น
//
// วิธีใช้:
//   npx tsx scripts/backfill-security-set-status.ts           # dry-run: แสดงจำนวนที่จะเปลี่ยน ไม่แก้ข้อมูล
//   npx tsx scripts/backfill-security-set-status.ts --apply   # แก้ข้อมูลจริง (backup DB ก่อน!)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MAPPING: { remarkIn: string; status: string }[] = [
  { remarkIn: "New Security Set add to WH", status: "NEW" },
  { remarkIn: "Import Security Set USED", status: "USED" },
  { remarkIn: "Import Security Set REFURBISHED", status: "REFURBISHED" },
  { remarkIn: "-", status: "USED" },
];

const emptyStatus = { OR: [{ assetStatus: null }, { assetStatus: "" }] };

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "🚀 APPLY MODE — จะแก้ข้อมูลจริง" : "🔍 DRY-RUN — ไม่แก้ข้อมูล (ใส่ --apply เพื่อแก้จริง)");

  const before = await prisma.securitySetTransaction.groupBy({ by: ["assetStatus"], _count: { _all: true } });
  console.log("สถานะก่อนแก้:", before.map((b) => `${b.assetStatus ?? "(ว่าง)"}=${b._count._all}`).join(", "));

  let total = 0;
  for (const { remarkIn, status } of MAPPING) {
    const where = { remarkIn, ...emptyStatus };
    const count = await prisma.securitySetTransaction.count({ where });
    const inStock = await prisma.securitySetTransaction.count({ where: { ...where, balance: 1 } });
    console.log(`  "${remarkIn}" → ${status}: ${count} แถว (ยังอยู่ในสต็อก ${inStock})`);
    total += count;
  }

  // หมายเหตุ: NOT IN ของ SQL ไม่นับ null → ต้องรวม remarkIn = null แยก
  const untouched = await prisma.securitySetTransaction.count({
    where: {
      AND: [
        emptyStatus,
        { OR: [{ remarkIn: null }, { remarkIn: { notIn: MAPPING.map((m) => m.remarkIn) } }] },
      ],
    },
  });
  console.log(`รวมที่จะเปลี่ยน: ${total} แถว | Status ว่างที่ไม่แตะ (ไม่รู้ที่มา/ขา OUT): ${untouched} แถว`);

  if (!apply) return;

  const results = await prisma.$transaction(
    MAPPING.map(({ remarkIn, status }) =>
      prisma.securitySetTransaction.updateMany({ where: { remarkIn, ...emptyStatus }, data: { assetStatus: status } })
    )
  );
  console.log(`✅ แก้แล้ว ${results.reduce((n, r) => n + r.count, 0)} แถว`);

  const after = await prisma.securitySetTransaction.groupBy({ by: ["assetStatus"], _count: { _all: true } });
  console.log("สถานะหลังแก้:", after.map((b) => `${b.assetStatus ?? "(ว่าง)"}=${b._count._all}`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
