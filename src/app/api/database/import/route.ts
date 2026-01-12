// app/api/database/import/route.ts
// API สำหรับ Import ข้อมูลเก่าเข้า AssetTransactionHistory
// ใช้ Document กลาง "IMPORT-LEGACY" เป็น reference
// พร้อม Validation และสร้าง Asset อัตโนมัติ

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// Helper: แปลงวันที่จาก Excel
const parseDate = (value: any): Date | null => {
  if (!value) return null;
  
  // ถ้าเป็น Date object อยู่แล้ว (xlsx cellDates: true)
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  
  // ถ้าเป็น Excel serial date
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  
  // ถ้าเป็น string
  if (typeof value === "string") {
    const str = value.trim();
    if (!str) return null;
    
    // รองรับ DD/MM/YYYY
    const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
    }
    
    // รองรับ YYYY-MM-DD
    const yyyymmdd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (yyyymmdd) {
      return new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]));
    }
    
    // ลอง parse ปกติ
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  
  return null;
};

// Helper: แปลงค่าเป็น string หรือ null
const safeString = (value: any): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && isNaN(value)) return null;
  const str = String(value).trim();
  return str === "" || str === "NaN" || str === "undefined" ? null : str;
};

// Helper: แปลงค่าเป็น int หรือ null
const safeInt = (value: any): number | null => {
  if (value === undefined || value === null) return null;
  const num = parseInt(String(value));
  return isNaN(num) ? null : num;
};

// Helper: เช็คว่าแถวนี้มีขา OUT หรือไม่
const hasOutData = (row: any): boolean => {
  return !!(parseDate(row["Out Date"]) || safeInt(row["Unit Out"]) || safeString(row["MCS Code (Out)"]) || safeString(row["To Shop"]));
};

// Type สำหรับข้อมูลแต่ละแถว
interface RowData {
  rowNum: number;
  barcode: string;
  assetName: string;
  hasIn: boolean;
  hasOut: boolean;
  inStockDate: Date | null;
  rawRow: any;
}

export async function POST(req: Request) {
  try {
    // 1. เช็ค Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // 2. เช็คว่าเป็น Admin
    const role = (session.user as any)?.role?.toUpperCase();
    if (role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden - Admin only" }, { status: 403 });
    }

    // 3. รับไฟล์ Excel
    const formData = await req.formData();
    const file = formData.get("excel") as File;
    if (!file) {
      return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
    }

    // 4. อ่านไฟล์ Excel
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "ไฟล์ไม่มีข้อมูล" }, { status: 400 });
    }

    // 5. จัดกลุ่มข้อมูลตาม Barcode และ Validate
    const barcodeGroups: Map<string, RowData[]> = new Map();
    const validationErrors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row number (1-based + header)

      const barcode = safeString(row["Barcode"]);
      const assetName = safeString(row["Asset Name"]);

      if (!barcode || !assetName) {
        validationErrors.push(`Row ${rowNum}: Missing Barcode or Asset Name`);
        continue;
      }

      const inStockDate = parseDate(row["In stock Date"]);
      const hasIn = !!inStockDate; // ต้องมี In stock Date ถึงจะถือว่ามีขาเข้า
      const hasOut = hasOutData(row);

      // ทุกแถวต้องมีขา IN
      if (!hasIn) {
        validationErrors.push(`Row ${rowNum}: Barcode "${barcode}" ไม่มีข้อมูลขาเข้า (In stock Date)`);
        continue;
      }

      const rowData: RowData = {
        rowNum,
        barcode,
        assetName,
        hasIn,
        hasOut,
        inStockDate,
        rawRow: row,
      };

      if (!barcodeGroups.has(barcode)) {
        barcodeGroups.set(barcode, []);
      }
      barcodeGroups.get(barcode)!.push(rowData);
    }

    // 6. Validate ลำดับ Transaction ของแต่ละ Barcode
    // กฎ: แถวก่อนหน้าต้องเป็น In-Out, แถวสุดท้ายเป็น In หรือ In-Out ได้
    for (const [barcode, transactions] of barcodeGroups) {
      // เรียงตาม inStockDate
      transactions.sort((a, b) => {
        if (!a.inStockDate || !b.inStockDate) return 0;
        return a.inStockDate.getTime() - b.inStockDate.getTime();
      });

      // ตรวจสอบ: แถวก่อนสุดท้ายต้องเป็น In-Out ทั้งหมด
      for (let i = 0; i < transactions.length - 1; i++) {
        const tx = transactions[i];
        if (!tx.hasOut) {
          validationErrors.push(`Row ${tx.rowNum}: Barcode "${barcode}" - แถวที่ไม่ใช่แถวสุดท้ายต้องมีข้อมูลขาออก (Out Date)`);
        }
      }
    }

    // ถ้ามี validation error ให้หยุด
    if (validationErrors.length > 0) {
      console.log("=== Import Validation Errors ===");
      validationErrors.forEach(err => console.log(err));
      console.log("================================");
      
      return NextResponse.json({
        success: false,
        message: `พบข้อผิดพลาดในข้อมูล ${validationErrors.length} รายการ`,
        errors: validationErrors.slice(0, 20), // แสดงแค่ 20 errors แรก
      }, { status: 400 });
    }

    // 7. หาหรือสร้าง Document กลาง "IMPORT-LEGACY"
    const userId = parseInt((session.user as any).id || "0");
    let legacyDoc = await prisma.document.findUnique({
      where: { docCode: "IMPORT-LEGACY" },
    });

    if (!legacyDoc) {
      legacyDoc = await prisma.document.create({
        data: {
          docCode: "IMPORT-LEGACY",
          documentType: "import",
          createdById: userId,
          fullName: "Legacy Import",
          company: "System",
          status: "approved",
        },
      });
      console.log("✅ Created IMPORT-LEGACY document:", legacyDoc.id);
    }

    // 8. Insert ข้อมูลลง AssetTransactionHistory
    let insertedTransactions = 0;
    let insertedAssets = 0;
    let skippedAssets = 0;
    const insertErrors: string[] = [];

    for (const [barcode, transactions] of barcodeGroups) {
      for (const tx of transactions) {
        const row = tx.rawRow;

        try {
          await prisma.assetTransactionHistory.create({
            data: {
              documentId: legacyDoc.id,

              // Asset Info
              barcode: barcode,
              assetName: tx.assetName,
              size: safeString(row["Size"]),
              grade: safeString(row["Grade"]),
              startWarranty: safeString(row["Start Warranty"]),
              endWarranty: safeString(row["End Warranty"]),
              cheilPO: safeString(row["Cheil PO"]),

              // ขา IN
              warehouseIn: safeString(row["Warehouse"]),
              inStockDate: tx.inStockDate,
              unitIn: safeInt(row["Unit In"]),
              fromVendor: safeString(row["From Vendor"]),
              mcsCodeIn: safeString(row["MCS Code (In)"]),
              fromShop: safeString(row["From Shop"]),
              remarkIn: safeString(row["Remark IN"]),

              // ขา OUT
              outDate: parseDate(row["Out Date"]),
              unitOut: safeInt(row["Unit Out"]),
              toVendor: safeString(row["To Vendor"]),
              status: safeString(row["Status"]),
              shopType: safeString(row["Shop Type"]),
              mcsCodeOut: safeString(row["MCS Code (Out)"]),
              toShop: safeString(row["To Shop"]),
              remarkOut: safeString(row["Remark OUT"]),

              // Auto Logic
              assetStatus: safeString(row["Asset Status"]) || "USED",
              balance: safeInt(row["Balance"]) ?? (tx.hasOut ? 0 : 1), // ถ้ามี OUT = 0, ไม่มี = 1
              transactionCategory: safeString(row["Transaction Category"]),

              // WK Columns
              wkOut: safeString(row["WK OUT"]),
              wkIn: safeString(row["WK IN"]),
              wkOutForRepair: safeString(row["WK OUT for Repair"]),
              wkInForRepair: safeString(row["WK IN for Repair"]),
              newInStock: safeString(row["New In Stock"]),
              refurbishedInStock: safeString(row["Refurbished Instock"]),
              borrow: safeString(row["Borrow"]),
              return: safeString(row["Return"]),
              repair: safeString(row["Repair"]),
              outToRentalWarehouse: safeString(row["Out to Rental WH"]),
              inToRentalWarehouse: safeString(row["In to Rental WH"]),
              discarded: safeString(row["Discarded"]),
              adjustError: safeString(row["Adjust Error"]),
            },
          });
          insertedTransactions++;
        } catch (err: any) {
          insertErrors.push(`Row ${tx.rowNum}: ${err.message || "Unknown error"}`);
        }
      }

      // 9. สร้าง Asset จากแถวสุดท้าย (In ล่าสุด) ของแต่ละ Barcode
      const lastTransaction = transactions[transactions.length - 1];
      const lastRow = lastTransaction.rawRow;

      // เช็คว่ามี Asset นี้อยู่แล้วหรือไม่
      const existingAsset = await prisma.asset.findUnique({
        where: { barcode },
      });

      if (!existingAsset) {
        try {
          await prisma.asset.create({
            data: {
              barcode: barcode,
              assetName: lastTransaction.assetName,
              size: safeString(lastRow["Size"]),
              warehouse: safeString(lastRow["Warehouse"]),
              startWarranty: safeString(lastRow["Start Warranty"]),
              endWarranty: safeString(lastRow["End Warranty"]),
              cheilPO: safeString(lastRow["Cheil PO"]),
              statusAsset: "Ready",
            },
          });
          insertedAssets++;
        } catch (err: any) {
          insertErrors.push(`Asset "${barcode}": ${err.message || "Unknown error"}`);
        }
      } else {
        skippedAssets++;
      }
    }

    console.log(`✅ Import completed: ${insertedTransactions} transactions, ${insertedAssets} assets created, ${skippedAssets} assets skipped`);

    return NextResponse.json({
      success: true,
      message: `นำเข้าสำเร็จ! Transaction: ${insertedTransactions} รายการ, Asset: ${insertedAssets} รายการ${skippedAssets > 0 ? ` (ข้าม ${skippedAssets} รายการที่มีอยู่แล้ว)` : ""}`,
      insertedTransactions,
      insertedAssets,
      skippedAssets,
      totalBarcodes: barcodeGroups.size,
      errors: insertErrors.slice(0, 10),
    });
  } catch (error: any) {
    console.error("[DATABASE IMPORT ERROR]", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}