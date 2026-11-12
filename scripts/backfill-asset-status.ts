// scripts/backfill-asset-status.ts
// เติม assetStatus ให้ AssetTransactionHistory ที่ "อยู่ในสต็อก" (balance = 1) แต่ Status เป็น "-" หรือว่าง
//
// สาเหตุที่เกิด:
//   - ลบเอกสาร / เปลี่ยน Barcode หลังเบิก → ของกลับเข้าสต็อก แต่ Status ยังเป็น "-" ที่ถูกเขียนทับตอนเบิก
//   - รับโอนย้ายระหว่างโกดัง → โค้ดเดิมตั้ง Status เป็น "-"
// วิธีหา Status เดิม: ไล่ประวัติของ Barcode (ดู src/lib/assetStatus.ts)
// แถวที่หา Status เดิมไม่ได้ → ไม่แตะ
// แถวที่ออกไปแล้ว (balance = 0) → ไม่แตะ (คง "-" ตามกฎ)
//
// วิธีใช้:
//   npx tsx scripts/backfill-asset-status.ts           # dry-run: แสดงสิ่งที่จะเปลี่ยน ไม่แก้ข้อมูล
//   npx tsx scripts/backfill-asset-status.ts --apply   # แก้ข้อมูลจริง (backup DB ก่อน!)

import { prisma } from "../src/lib/prisma";
import { isRealAssetStatus, resolveOriginalAssetStatus } from "../src/lib/assetStatus";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "🚀 APPLY MODE — จะแก้ข้อมูลจริง" : "🔍 DRY-RUN — ไม่แก้ข้อมูล (ใส่ --apply เพื่อแก้จริง)");

  const candidates = await prisma.assetTransactionHistory.findMany({
    where: { balance: 1, OR: [{ assetStatus: null }, { assetStatus: "" }, { assetStatus: "-" }] },
    select: { id: true, barcode: true, assetStatus: true, remarkIn: true },
    orderBy: { id: "asc" },
  });
  console.log(`แถวในสต็อกที่ Status ว่าง/"-": ${candidates.length}`);

  const updates: { id: number; status: string }[] = [];
  const summary: Record<string, number> = {};
  const unresolved: string[] = [];

  for (const row of candidates) {
    if (isRealAssetStatus(row.assetStatus)) continue;
    const status = await resolveOriginalAssetStatus(row.barcode, row.id);
    if (!status) {
      unresolved.push(`${row.barcode} (remarkIn: ${row.remarkIn ?? "-"})`);
      continue;
    }
    updates.push({ id: row.id, status });
    const key = `${row.remarkIn ?? "(ว่าง)"} → ${status}`;
    summary[key] = (summary[key] || 0) + 1;
  }

  console.log("จะเปลี่ยน:");
  for (const [k, n] of Object.entries(summary)) console.log(`  ${k}: ${n} แถว`);
  console.log(`รวม ${updates.length} แถว | หา Status เดิมไม่ได้ (ไม่แตะ): ${unresolved.length} แถว`);
  if (unresolved.length) console.log("  ตัวอย่างที่หาไม่ได้:", unresolved.slice(0, 10).join(", "));

  if (!apply || updates.length === 0) return;

  await prisma.$transaction(
    updates.map((u) =>
      prisma.assetTransactionHistory.update({ where: { id: u.id }, data: { assetStatus: u.status } })
    )
  );
  console.log(`✅ แก้แล้ว ${updates.length} แถว`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
