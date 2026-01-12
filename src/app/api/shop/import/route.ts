import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// ✅ ขนาด Batch (ปรับได้ตามความเหมาะสม)
const BATCH_SIZE = 500;

// ✅ ชื่อ Sheet ที่ต้องการอ่าน
const SHEET_OPEN = "MX Channel Master";
const SHEET_CLOSED = "MX Shop Closed";

// ✅ Mapping คอลัมน์จากไฟล์ดิบ -> ระบบเรา
const COLUMN_MAPPING = {
  "Site ID": "mcsCode",
  "Site Name": "shopName",
  "Region": "region",
  "State": "state",
  "MOBILE/Shop Investment Type": "shopType",
};

/**
 * 📦 API: POST /api/shop/import
 * อ่านไฟล์ Excel แล้ว update/create ข้อมูล Shop ตาม mcsCode
 * รองรับไฟล์ดิบที่มี Sheet "MX Channel Master" (OPEN) และ "MX Shop Closed" (CLOSED)
 */
export async function POST(req: Request) {
  try {
    // 1. เช็ค Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. เช็ค Role (Admin เท่านั้น)
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin only" }, { status: 403 });
    }

    // ✅ รับไฟล์จาก FormData
    const formData = await req.formData();
    const file = formData.get("excel") as File | null;

    if (!file) {
      return NextResponse.json({ error: "กรุณาอัปโหลดไฟล์ Excel" }, { status: 400 });
    }

    // ✅ แปลงไฟล์เป็น Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ✅ อ่านไฟล์ Excel (รองรับ .xlsx, .xls, .xlsb อัตโนมัติ)
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetNames = workbook.SheetNames;

    console.log(`📊 Found sheets: ${sheetNames.join(", ")}`);

    // ✅ เช็คว่ามี Sheet ที่ต้องการอย่างน้อย 1 อัน
    const hasOpenSheet = sheetNames.includes(SHEET_OPEN);
    const hasClosedSheet = sheetNames.includes(SHEET_CLOSED);

    if (!hasOpenSheet && !hasClosedSheet) {
      return NextResponse.json({
        error: `ไม่พบ Sheet ที่ต้องการ!`,
        hint: `ต้องมี Sheet "${SHEET_OPEN}" หรือ "${SHEET_CLOSED}" อย่างน้อย 1 อัน`,
        foundSheets: sheetNames,
      }, { status: 400 });
    }

    // ✅ ฟังก์ชันแปลงค่าให้เป็น string ที่ปลอดภัย (ป้องกัน NaN, undefined)
    const safeString = (value: any): string | null => {
      if (value === undefined || value === null) return null;
      if (typeof value === "number" && isNaN(value)) return null;
      const str = String(value).trim();
      return str === "" || str === "NaN" || str === "undefined" ? null : str;
    };

    // ✅ ฟังก์ชันอ่านข้อมูลจาก Sheet
    const parseSheet = (sheetName: string, status: string): any[] => {
      if (!sheetNames.includes(sheetName)) {
        console.log(`⏭️ Sheet "${sheetName}" not found, skipping...`);
        return [];
      }

      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      console.log(`📊 Sheet "${sheetName}": ${rows.length} rows`);

      let skippedNewShop = 0;

      const result = rows.map((row) => {
        const mcsCode = safeString(row["Site ID"]);
        if (!mcsCode) return null;

        // ✅ ข้าม row ที่ Site ID มีคำว่า "NEW SHOP"
        if (mcsCode.toUpperCase().includes("NEW SHOP")) {
          skippedNewShop++;
          return null;
        }

        return {
          mcsCode,
          shopName: safeString(row["Site Name"]),
          region: safeString(row["Region"]),
          state: safeString(row["State"]),
          shopType: safeString(row["MOBILE/Shop Investment Type"]),
          status,
        };
      }).filter(Boolean);

      if (skippedNewShop > 0) {
        console.log(`⏭️ Sheet "${sheetName}": Skipped ${skippedNewShop} rows with "NEW SHOP"`);
      }

      return result;
    };

    // ✅ อ่านข้อมูลจากทั้ง 2 Sheet
    const openShops = parseSheet(SHEET_OPEN, "OPEN");
    const closedShops = parseSheet(SHEET_CLOSED, "CLOSED");

    // ✅ รวมข้อมูลทั้งหมด
    const allShops = [...openShops, ...closedShops];

    if (allShops.length === 0) {
      return NextResponse.json({ error: "ไม่พบข้อมูลในไฟล์" }, { status: 400 });
    }

    console.log(`📊 Total shops: ${allShops.length} (OPEN: ${openShops.length}, CLOSED: ${closedShops.length})`);

    // ✅ ดึง mcsCode ที่มีอยู่แล้วทั้งหมด (ทำครั้งเดียว)
    const existingShops = await prisma.shop.findMany({
      select: { mcsCode: true },
    });
    const existingMcsCodes = new Set(existingShops.map((s) => s.mcsCode));

    // ✅ เตรียมข้อมูลแยก create และ update
    const shopsToCreate: any[] = [];
    const shopsToUpdate: any[] = [];
    const processedMcsCodes = new Set<string>();

    for (const shop of allShops) {
      // ข้ามถ้า mcsCode ซ้ำในไฟล์เดียวกัน (เอาตัวแรกที่เจอ)
      if (processedMcsCodes.has(shop.mcsCode)) {
        continue;
      }
      processedMcsCodes.add(shop.mcsCode);

      if (existingMcsCodes.has(shop.mcsCode)) {
        shopsToUpdate.push(shop);
      } else {
        shopsToCreate.push(shop);
      }
    }

    console.log(`📦 Shops to create: ${shopsToCreate.length}`);
    console.log(`📝 Shops to update: ${shopsToUpdate.length}`);

    // ✅ Batch Create - ใช้ createMany
    let createdCount = 0;
    for (let i = 0; i < shopsToCreate.length; i += BATCH_SIZE) {
      const batch = shopsToCreate.slice(i, i + BATCH_SIZE);

      await prisma.shop.createMany({
        data: batch,
        skipDuplicates: true,
      });

      createdCount += batch.length;
      console.log(`✅ Created shops: ${createdCount}/${shopsToCreate.length}`);
    }

    // ✅ Batch Update - ใช้ $transaction
    let updatedCount = 0;
    for (let i = 0; i < shopsToUpdate.length; i += BATCH_SIZE) {
      const batch = shopsToUpdate.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(
        batch.map((shop) =>
          prisma.shop.update({
            where: { mcsCode: shop.mcsCode },
            data: {
              shopName: shop.shopName,
              region: shop.region,
              state: shop.state,
              shopType: shop.shopType,
              status: shop.status,
            },
          })
        )
      );

      updatedCount += batch.length;
      console.log(`✅ Updated shops: ${updatedCount}/${shopsToUpdate.length}`);
    }

    // ✅ สร้าง response message
    let message = `นำเข้าข้อมูล Shop สำเร็จ`;
    message += ` | เพิ่มใหม่ ${createdCount} รายการ`;
    message += ` | อัปเดต ${updatedCount} รายการ`;
    message += ` | (OPEN: ${openShops.length}, CLOSED: ${closedShops.length})`;

    console.log(`🎉 Import completed: ${message}`);

    return NextResponse.json({
      success: true,
      message,
      created: createdCount,
      updated: updatedCount,
      openCount: openShops.length,
      closedCount: closedShops.length,
      total: createdCount + updatedCount,
    });
  } catch (error) {
    console.error("[SHOP_IMPORT_ERROR]", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}