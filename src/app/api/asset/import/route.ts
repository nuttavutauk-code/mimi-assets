import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// ✅ ขนาด Batch (ปรับได้ตามความเหมาะสม)
const BATCH_SIZE = 500;

// ✅ รายชื่อ Asset ที่ต้องบันทึกลงตารางรอง (SecuritySetTransaction)
const SECURITY_SET_NAMES = [
  "CONTROLBOX 6 PORT (M-60000R) with power cable",
  "Security Type C Ver.7.1",
  "Security Type C Ver.7.0",
];

// ✅ ฟังก์ชันคำนวณ Week Number (ตามสูตร Excel: WEEKNUM(date, 15) = ISO Week เริ่มวันจันทร์)
// Output Format: "2025 WK 11"
function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()} WK ${weekNo.toString().padStart(2, "0")}`;
}

// ฟังก์ชันเช็คว่าเป็น Security Set หรือไม่
const isSecuritySetAsset = (assetName: string): boolean => {
  return SECURITY_SET_NAMES.some(name =>
    assetName.toLowerCase().trim() === name.toLowerCase().trim()
  );
};

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

    const formData = await req.formData();
    const file = formData.get("excel") as File;
    if (!file)
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ✅ อ่าน Excel
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

    if (!jsonData.length) {
      return NextResponse.json({ error: "ไม่พบข้อมูลในไฟล์" }, { status: 400 });
    }

    // ✅ ตรวจสอบคอลัมน์ในไฟล์
    const REQUIRED_COLUMNS = ["BARCODE", "ASSET NAME"];
    const EXPECTED_COLUMNS = ["BARCODE", "ASSET NAME", "SIZE", "WAREHOUSE", "START WARRANTY", "END WARRANTY", "CHEIL PO"];
    const fileColumns = Object.keys(jsonData[0] || {});
    const missingColumns = REQUIRED_COLUMNS.filter(col => !fileColumns.includes(col));
    
    if (missingColumns.length > 0) {
      return NextResponse.json({ 
        error: `ไฟล์ไม่ถูกต้อง! ไม่พบคอลัมน์: ${missingColumns.join(", ")}`,
        expectedColumns: EXPECTED_COLUMNS,
        foundColumns: fileColumns,
        hint: "กรุณาใช้ไฟล์เทมเพลต Asset ที่ถูกต้อง"
      }, { status: 400 });
    }

    // ✅ ตรวจสอบว่าไม่ใช่ไฟล์ Shop (มีคอลัมน์ MCS CODE แต่ไม่มี BARCODE)
    if (fileColumns.includes("MCS CODE") && !fileColumns.includes("BARCODE")) {
      return NextResponse.json({ 
        error: "ไฟล์นี้เป็นเทมเพลต Shop ไม่ใช่เทมเพลต Asset!",
        hint: "กรุณาใช้ไฟล์เทมเพลต Asset ที่มีคอลัมน์: " + EXPECTED_COLUMNS.join(", ")
      }, { status: 400 });
    }

    console.log(`📊 Total rows in Excel: ${jsonData.length}`);

    // ✅ ตรวจสอบ Barcode ซ้ำในไฟล์
    const barcodesInFile: string[] = [];
    const duplicateBarcodes: string[] = [];
    
    for (const row of jsonData) {
      if (!row["BARCODE"]) continue;
      const barcode = String(row["BARCODE"]).trim();
      
      if (barcodesInFile.includes(barcode)) {
        if (!duplicateBarcodes.includes(barcode)) {
          duplicateBarcodes.push(barcode);
        }
      } else {
        barcodesInFile.push(barcode);
      }
    }

    if (duplicateBarcodes.length > 0) {
      return NextResponse.json({ 
        error: `พบ Barcode ซ้ำในไฟล์! ไม่สามารถ Import ได้`,
        duplicateBarcodes: duplicateBarcodes.slice(0, 20), // แสดงแค่ 20 รายการแรก
        totalDuplicates: duplicateBarcodes.length,
        hint: "กรุณาตรวจสอบและลบ Barcode ที่ซ้ำออกจากไฟล์ก่อน Import"
      }, { status: 400 });
    }

    // ✅ ดึง Vendor ทั้งหมดจาก User table เพื่อ validate (ทำครั้งเดียว)
    const users = await prisma.user.findMany({
      where: { vendor: { not: null } },
      select: { vendor: true },
    });
    const validVendors = new Set(
      users.map((u) => u.vendor?.toLowerCase().trim()).filter(Boolean)
    );

    // ✅ ดึง Barcode ที่มี Active Transaction อยู่แล้ว (ตารางหลัก)
    const existingActiveTransactions = await prisma.assetTransactionHistory.findMany({
      where: { balance: 1 },
      select: { barcode: true },
    });
    const activeBarcodes = new Set(existingActiveTransactions.map((t) => t.barcode));

    // ✅ ดึง Barcode ที่มีอยู่ในตารางรอง (Security Set)
    const existingSecurityTransactions = await prisma.securitySetTransaction.findMany({
      select: { barcode: true },
    });
    const existingSecurityBarcodes = new Set(
      existingSecurityTransactions.map((t) => t.barcode).filter(Boolean)
    );

    // ✅ หาหรือสร้าง Import Document (ทำครั้งเดียว)
    let importDocument = await prisma.document.findFirst({
      where: { documentType: "IMPORT" },
    });

    if (!importDocument) {
      const adminUser = await prisma.user.findFirst({
        where: { role: "ADMIN" },
      });
      const anyUser = adminUser || (await prisma.user.findFirst());

      if (!anyUser) {
        return NextResponse.json({ error: "No user found in database" }, { status: 400 });
      }

      importDocument = await prisma.document.create({
        data: {
          docCode: `IMPORT-${Date.now()}`,
          documentType: "IMPORT",
          fullName: "System Import",
          createdById: anyUser.id,
          status: "approved",
        },
      });
    }

    // ✅ ฟังก์ชันแปลงวันที่จาก Excel → DD-MM-YYYY
    const parseExcelDate = (value: any): string | null => {
      if (!value) return null;

      let date: Date;

      if (typeof value === "number") {
        const excelEpoch = new Date(1899, 11, 30);
        date = new Date(excelEpoch.getTime() + value * 86400000);
      } else if (typeof value === "string") {
        date = new Date(value.trim());
      } else {
        return null;
      }

      if (isNaN(date.getTime())) return null;

      const year = date.getFullYear();
      if (year < 2000 || year > 2100) return null;

      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      return `${day}-${month}-${year}`;
    };

    // ✅ เตรียมข้อมูลทั้งหมดก่อน
    const assetsToUpsert: any[] = [];
    const transactionsToCreate: any[] = []; // ตารางหลัก
    const securityTransactionsToCreate: any[] = []; // ตารางรอง
    let skipped = 0;
    let skippedTransaction = 0;
    let skippedSecurityTransaction = 0;
    const invalidWarehouse: string[] = [];

    for (const row of jsonData) {
      if (!row["BARCODE"]) continue;

      const barcode = String(row["BARCODE"]).trim();
      const assetName = String(row["ASSET NAME"] || "").trim();
      const size = String(row["SIZE"] || "").trim();
      const startWarranty = parseExcelDate(row["START WARRANTY"]);
      const endWarranty = parseExcelDate(row["END WARRANTY"]);
      const cheilPO = String(row["CHEIL PO"] || "").trim();

      // ข้ามถ้าวันที่ผิด
      if (
        (row["START WARRANTY"] && !startWarranty) ||
        (row["END WARRANTY"] && !endWarranty)
      ) {
        skipped++;
        continue;
      }

      // ✅ ตรวจสอบ WAREHOUSE
      const warehouse = String(row["WAREHOUSE"] || "").trim();
      let warehouseValid = true;

      if (warehouse) {
        if (!validVendors.has(warehouse.toLowerCase())) {
          warehouseValid = false;
          if (!invalidWarehouse.includes(warehouse)) {
            invalidWarehouse.push(warehouse);
          }
        }
      }

      const validWarehouse = warehouseValid ? warehouse : null;

      // ✅ เช็คว่าเป็น Security Set หรือไม่
      const isSecuritySet = isSecuritySetAsset(assetName);

      if (isSecuritySet) {
        // ===== Security Set Asset → บันทึกลงตารางรอง =====
        // ไม่ต้อง upsert ลงตาราง Asset หลัก

        // เช็คว่า Barcode นี้มีอยู่ในตารางรองแล้วหรือไม่
        if (existingSecurityBarcodes.has(barcode)) {
          skippedSecurityTransaction++;
        } else {
          securityTransactionsToCreate.push({
            docCode: importDocument.docCode,
            documentId: importDocument.id,
            assetName,
            barcode,
            // ===== ขา IN (เข้าโกดัง) =====
            warehouseIn: validWarehouse,
            inStockDate: new Date(),
            unitIn: 1,
            fromVendor: validWarehouse,
            mcsCodeIn: "-",
            fromShop: validWarehouse,
            remarkIn: "New Security Set add to WH",
          });
          // เพิ่มเข้า Set เพื่อป้องกัน duplicate ในไฟล์เดียวกัน
          existingSecurityBarcodes.add(barcode);
        }
      } else {
        // ===== Asset ปกติ → บันทึกลงตารางหลัก =====

        // ✅ เพิ่มเข้า array สำหรับ upsert
        assetsToUpsert.push({
          barcode,
          assetName,
          size,
          warehouse: validWarehouse,
          startWarranty,
          endWarranty,
          cheilPO,
        });

        // ✅ เช็คว่าต้องสร้าง Transaction หรือไม่
        if (activeBarcodes.has(barcode)) {
          skippedTransaction++;
        } else {
          const currentDate = new Date();
          transactionsToCreate.push({
            documentId: importDocument.id,
            barcode,
            assetName,
            size,
            startWarranty,
            endWarranty,
            cheilPO,
            grade: "A",
            warehouseIn: validWarehouse,
            inStockDate: currentDate,
            unitIn: 1,
            fromVendor: validWarehouse,
            fromShop: validWarehouse,
            mcsCodeIn: "-",
            remarkIn: "New Asset add to WH",
            assetStatus: "NEW",
            balance: 1,
            // ✅ บันทึก New In Stock
            newInStock: getWeekNumber(currentDate),
          });
          // เพิ่มเข้า Set เพื่อป้องกัน duplicate ในไฟล์เดียวกัน
          activeBarcodes.add(barcode);
        }
      }
    }

    console.log(`📦 Assets to upsert: ${assetsToUpsert.length}`);
    console.log(`📝 Transactions to create (ตารางหลัก): ${transactionsToCreate.length}`);
    console.log(`🔒 Security Set Transactions to create (ตารางรอง): ${securityTransactionsToCreate.length}`);

    // ✅ แบ่ง Batch และประมวลผล Assets
    let assetCount = 0;
    for (let i = 0; i < assetsToUpsert.length; i += BATCH_SIZE) {
      const batch = assetsToUpsert.slice(i, i + BATCH_SIZE);

      // ใช้ transaction เพื่อทำ upsert หลายๆ ตัวพร้อมกัน
      await prisma.$transaction(
        batch.map((asset) =>
          prisma.asset.upsert({
            where: { barcode: asset.barcode },
            update: {
              assetName: asset.assetName,
              size: asset.size,
              warehouse: asset.warehouse,
              startWarranty: asset.startWarranty,
              endWarranty: asset.endWarranty,
              cheilPO: asset.cheilPO,
            },
            create: asset,
          })
        )
      );

      assetCount += batch.length;
      console.log(`✅ Processed assets: ${assetCount}/${assetsToUpsert.length}`);
    }

    // ✅ แบ่ง Batch และประมวลผล Transactions (ตารางหลัก)
    let transactionCount = 0;
    for (let i = 0; i < transactionsToCreate.length; i += BATCH_SIZE) {
      const batch = transactionsToCreate.slice(i, i + BATCH_SIZE);

      // ใช้ createMany สำหรับ insert หลายๆ ตัวพร้อมกัน
      await prisma.assetTransactionHistory.createMany({
        data: batch,
        skipDuplicates: true,
      });

      transactionCount += batch.length;
      console.log(`✅ Processed transactions (ตารางหลัก): ${transactionCount}/${transactionsToCreate.length}`);
    }

    // ✅ แบ่ง Batch และประมวลผล Security Set Transactions (ตารางรอง)
    let securityTransactionCount = 0;
    for (let i = 0; i < securityTransactionsToCreate.length; i += BATCH_SIZE) {
      const batch = securityTransactionsToCreate.slice(i, i + BATCH_SIZE);

      await prisma.securitySetTransaction.createMany({
        data: batch,
        skipDuplicates: true,
      });

      securityTransactionCount += batch.length;
      console.log(`✅ Processed security transactions (ตารางรอง): ${securityTransactionCount}/${securityTransactionsToCreate.length}`);
    }

    // ✅ สร้าง response message
    let message = `นำเข้า Asset สำเร็จ ${assetCount} รายการ`;
    message += ` | สร้าง Transaction (ตารางหลัก) ${transactionCount} รายการ`;
    message += ` | สร้าง Security Set Transaction (ตารางรอง) ${securityTransactionCount} รายการ`;

    if (skippedTransaction > 0) {
      message += ` | ข้าม ${skippedTransaction} รายการที่มี Active Transaction อยู่แล้ว`;
    }
    if (skippedSecurityTransaction > 0) {
      message += ` | ข้าม ${skippedSecurityTransaction} Security Set ที่มีอยู่แล้ว`;
    }
    if (skipped > 0) {
      message += ` | ข้าม ${skipped} แถวที่ข้อมูลวันที่ไม่ถูกต้อง`;
    }
    if (invalidWarehouse.length > 0) {
      message += ` | ⚠️ Warehouse ไม่ตรงกับ Vendor: ${invalidWarehouse.join(", ")}`;
    }

    console.log(`🎉 Import completed: ${message}`);

    return NextResponse.json({
      success: true,
      message,
      assetCount,
      transactionCount,
      securityTransactionCount,
      skipped,
      skippedTransaction,
      skippedSecurityTransaction,
      invalidWarehouse,
    });
  } catch (error) {
    console.error("[ASSET_IMPORT_ERROR]", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}