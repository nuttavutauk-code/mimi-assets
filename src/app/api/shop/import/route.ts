import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// ✅ ขนาด Batch (ปรับได้ตามความเหมาะสม)
const BATCH_SIZE = 500;

/**
 * 📦 API: POST /api/shop/import
 * อ่านไฟล์ Excel แล้ว update/create ข้อมูล Shop ตาม mcsCode
 * รองรับข้อมูล 10,000+ รายการด้วย Batch Processing
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

    // ✅ อ่านไฟล์ Excel
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return NextResponse.json({ error: "ไม่พบข้อมูลในไฟล์" }, { status: 400 });
    }

    // ✅ ตรวจสอบคอลัมน์ในไฟล์
    const REQUIRED_COLUMNS = ["MCS CODE"];
    const EXPECTED_COLUMNS = ["MCS CODE", "SHOP NAME", "REGION", "STATE", "SHOP TYPE", "STATUS"];
    const fileColumns = Object.keys(rows[0] || {});
    const missingColumns = REQUIRED_COLUMNS.filter(col => !fileColumns.includes(col));
    
    if (missingColumns.length > 0) {
      return NextResponse.json({ 
        error: `ไฟล์ไม่ถูกต้อง! ไม่พบคอลัมน์: ${missingColumns.join(", ")}`,
        expectedColumns: EXPECTED_COLUMNS,
        foundColumns: fileColumns,
        hint: "กรุณาใช้ไฟล์เทมเพลต Shop ที่ถูกต้อง"
      }, { status: 400 });
    }

    // ✅ ตรวจสอบว่าไม่ใช่ไฟล์ Asset (มีคอลัมน์ BARCODE)
    if (fileColumns.includes("BARCODE")) {
      return NextResponse.json({ 
        error: "ไฟล์นี้เป็นเทมเพลต Asset ไม่ใช่เทมเพลต Shop!",
        hint: "กรุณาใช้ไฟล์เทมเพลต Shop ที่มีคอลัมน์: " + EXPECTED_COLUMNS.join(", ")
      }, { status: 400 });
    }

    console.log(`📊 Total rows in Excel: ${rows.length}`);

    // ✅ ดึง mcsCode ที่มีอยู่แล้วทั้งหมด (ทำครั้งเดียว)
    const existingShops = await prisma.shop.findMany({
      select: { mcsCode: true },
    });
    const existingMcsCodes = new Set(existingShops.map((s) => s.mcsCode));

    // ✅ เตรียมข้อมูลแยก create และ update
    const shopsToCreate: any[] = [];
    const shopsToUpdate: any[] = [];
    let skipped = 0;

    for (const row of rows) {
      const mcsCode = String(row["MCS CODE"] || "").trim();
      if (!mcsCode) {
        skipped++;
        continue;
      }

      const shopData = {
        mcsCode,
        shopName: row["SHOP NAME"] ? String(row["SHOP NAME"]).trim() : null,
        region: row["REGION"] ? String(row["REGION"]).trim() : null,
        state: row["STATE"] ? String(row["STATE"]).trim() : null,
        shopType: row["SHOP TYPE"] ? String(row["SHOP TYPE"]).trim() : null,
        status: row["STATUS"] ? String(row["STATUS"]).trim() : null,
      };

      if (existingMcsCodes.has(mcsCode)) {
        shopsToUpdate.push(shopData);
      } else {
        shopsToCreate.push(shopData);
        // เพิ่มเข้า Set เพื่อป้องกัน duplicate ในไฟล์เดียวกัน
        existingMcsCodes.add(mcsCode);
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

    if (skipped > 0) {
      message += ` | ข้าม ${skipped} แถวที่ไม่มี MCS CODE`;
    }

    console.log(`🎉 Import completed: ${message}`);

    return NextResponse.json({
      success: true,
      message,
      created: createdCount,
      updated: updatedCount,
      skipped,
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