// src/app/api/asset/import-refurbished/route.ts
// API สำหรับ Import Asset REFURBISHED (ของซ่อมแล้ว) พร้อมสร้าง AssetTransactionHistory

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

// ✅ ฟังก์ชันแปลงวันที่ DD-MM-YYYY เป็น Date object
function parseDate(dateValue: any): Date | null {
    if (!dateValue) return null;

    // ถ้าเป็น Excel serial date (number)
    if (typeof dateValue === "number") {
        return new Date((dateValue - 25569) * 86400 * 1000);
    }

    const dateStr = String(dateValue).trim();
    if (!dateStr) return null;

    // ลอง DD-MM-YYYY หรือ DD/MM/YYYY ก่อน
    const ddmmyyyy = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (ddmmyyyy) {
        const day = parseInt(ddmmyyyy[1]);
        const month = parseInt(ddmmyyyy[2]) - 1; // Month is 0-indexed
        const year = parseInt(ddmmyyyy[3]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
    }

    // ลอง YYYY-MM-DD
    const yyyymmdd = dateStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (yyyymmdd) {
        const year = parseInt(yyyymmdd[1]);
        const month = parseInt(yyyymmdd[2]) - 1;
        const day = parseInt(yyyymmdd[3]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
    }

    // ลอง parse ตรงๆ
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;

    return null;
}

export async function POST(request: NextRequest) {
    try {
        // 1. เช็ค Authentication
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role?.toUpperCase() !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. รับไฟล์ Excel
        const formData = await request.formData();
        const file = formData.get("excel") as File;

        if (!file) {
            return NextResponse.json({ error: "กรุณาเลือกไฟล์" }, { status: 400 });
        }

        // 3. อ่านไฟล์ Excel
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (rows.length === 0) {
            return NextResponse.json({ error: "ไฟล์ไม่มีข้อมูล" }, { status: 400 });
        }

        // 4. ดึง User ID ของ Admin
        const adminId = parseInt((session.user as any).id || (session.user as any).sub || "0");

        // ✅ 5. ดึงรายการ Vendor ทั้งหมดจากระบบ
        const users = await prisma.user.findMany({
            where: {
                vendor: { not: null },
            },
            select: { vendor: true },
        });
        const validVendors = [...new Set(users.map(u => u.vendor).filter(Boolean))] as string[];

        // ✅ 6. Validate Warehouse In ทุกแถวก่อน Import
        const invalidWarehouses: { row: number; warehouse: string }[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // +2 เพราะ row 1 คือ header

            const warehouseIn = String(row.warehouseIn || row.WarehouseIn || row["Warehouse In"] || row["โกดังรับเข้า"] || "").trim();

            // ถ้ามีค่า warehouseIn ต้องเป็น Vendor ที่มีจริง
            if (warehouseIn && !validVendors.includes(warehouseIn)) {
                invalidWarehouses.push({ row: rowNum, warehouse: warehouseIn });
            }
        }

        // ✅ ถ้ามี Warehouse ไม่ถูกต้อง → ไม่ให้ Import ทั้งไฟล์
        if (invalidWarehouses.length > 0) {
            const errorDetails = invalidWarehouses.slice(0, 5).map(w => `แถว ${w.row}: "${w.warehouse}"`).join(", ");
            const moreCount = invalidWarehouses.length > 5 ? ` และอีก ${invalidWarehouses.length - 5} รายการ` : "";
            
            return NextResponse.json({
                error: `Warehouse In ไม่ถูกต้อง: ${errorDetails}${moreCount}`,
                invalidWarehouses: invalidWarehouses.slice(0, 10),
                validVendors: validVendors.slice(0, 20), // แสดง vendor ที่ใช้ได้
            }, { status: 400 });
        }

        // 7. Import ทีละรายการ
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            // ดึงค่าจาก Excel (รองรับทั้งชื่อภาษาไทยและอังกฤษ)
            const barcode = String(row.barcode || row.Barcode || row["Barcode"] || "").trim();
            const assetName = String(row.assetName || row.AssetName || row["Asset Name"] || row["ชื่อ Asset"] || "").trim();
            const size = String(row.size || row.Size || row["Size"] || row["ขนาด"] || "").trim() || null;
            const grade = String(row.grade || row.Grade || row["Grade"] || row["เกรด"] || "").trim() || null;
            const warehouseIn = String(row.warehouseIn || row.WarehouseIn || row["Warehouse In"] || row["โกดังรับเข้า"] || "").trim() || null;
            const fromVendor = String(row.fromVendor || row.FromVendor || row["From Vendor"] || row["จาก Vendor"] || "").trim() || null;
            const mcsCodeIn = String(row.mcsCodeIn || row.McsCodeIn || row["MCS Code In"] || row["MCS Code (In)"] || "").trim() || null;
            const fromShop = String(row.fromShop || row.FromShop || row["From Shop"] || row["จากร้าน"] || "").trim() || null;
            const remarkIn = String(row.remarkIn || row.RemarkIn || row["Remark In"] || row["Remark"] || row["หมายเหตุ"] || "").trim() || null;
            const startWarranty = String(row.startWarranty || row.StartWarranty || row["Start Warranty"] || row["เริ่มประกัน"] || "").trim() || null;
            const endWarranty = String(row.endWarranty || row.EndWarranty || row["End Warranty"] || row["สิ้นสุดประกัน"] || "").trim() || null;
            const cheilPO = String(row.cheilPO || row.CheilPO || row["Cheil PO"] || row["PO"] || "").trim() || null;

            // ดึงวันที่ (รองรับ DD-MM-YYYY)
            const inStockDateRaw = row.inStockDate || row.InStockDate || row["In Stock Date"] || row["วันที่รับเข้า"] || "";
            const inStockDate = parseDate(inStockDateRaw);

            // Validate ข้อมูลจำเป็น
            if (!barcode) {
                errors.push(`แถว ${rowNum}: ไม่มี Barcode`);
                skipped++;
                continue;
            }

            if (!assetName) {
                errors.push(`แถว ${rowNum}: ไม่มี Asset Name`);
                skipped++;
                continue;
            }

            // เช็คว่า Barcode ซ้ำหรือไม่
            const existingAsset = await prisma.asset.findFirst({
                where: { barcode },
            });

            if (existingAsset) {
                errors.push(`แถว ${rowNum}: Barcode ${barcode} มีอยู่แล้วในระบบ`);
                skipped++;
                continue;
            }

            // เช็คว่ามี Transaction History ที่ Barcode นี้อยู่แล้วหรือไม่
            const existingTransaction = await prisma.assetTransactionHistory.findFirst({
                where: { barcode },
            });

            if (existingTransaction) {
                errors.push(`แถว ${rowNum}: Barcode ${barcode} มี Transaction History อยู่แล้ว`);
                skipped++;
                continue;
            }

            try {
                // ✅ สร้าง Asset
                await prisma.asset.create({
                    data: {
                        barcode,
                        assetName,
                        size: size || undefined,
                        warehouse: warehouseIn || undefined,
                        startWarranty: startWarranty || undefined,
                        endWarranty: endWarranty || undefined,
                        cheilPO: cheilPO || undefined,
                    },
                });

                // ✅ สร้าง AssetTransactionHistory
                await prisma.assetTransactionHistory.create({
                    data: {
                        // ข้อมูล Asset
                        barcode,
                        assetName,
                        size: size || null,
                        grade: grade || null,
                        startWarranty: startWarranty || null,
                        endWarranty: endWarranty || null,
                        cheilPO: cheilPO || null,

                        // ขา IN
                        warehouseIn: warehouseIn || null,
                        inStockDate: inStockDate || new Date(),
                        unitIn: 1,
                        fromVendor: fromVendor || null,
                        mcsCodeIn: mcsCodeIn || null,
                        fromShop: fromShop || null,
                        remarkIn: remarkIn || "Import Asset REFURBISHED",

                        // Auto fields
                        assetStatus: "REFURBISHED", // ✅ สถานะเป็น REFURBISHED
                        balance: 1, // ✅ มีของอยู่ในโกดัง

                        // Metadata
                        approvedBy: adminId,
                        approvedAt: new Date(),
                    },
                });

                imported++;
            } catch (err) {
                console.error(`Error importing row ${rowNum}:`, err);
                errors.push(`แถว ${rowNum}: เกิดข้อผิดพลาดในการบันทึก`);
                skipped++;
            }
        }

        // 8. สร้าง Response
        let message = `นำเข้า Asset REFURBISHED สำเร็จ ${imported} รายการ`;
        if (skipped > 0) {
            message += ` (ข้าม ${skipped} รายการ)`;
        }

        return NextResponse.json({
            success: true,
            message,
            imported,
            skipped,
            errors: errors.slice(0, 10),
        });
    } catch (error) {
        console.error("Error importing assets:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
            { status: 500 }
        );
    }
}