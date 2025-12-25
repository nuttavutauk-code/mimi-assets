// app/api/database/export/route.ts
// API สำหรับ Export ข้อมูล AssetTransactionHistory เป็น Excel

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    // 1. เช็ค Authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. เช็คว่าเป็น Admin
    const role = (session.user as any)?.role?.toUpperCase();
    if (role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Forbidden - Admin only" },
        { status: 403 }
      );
    }

    // 3. ดึงข้อมูลทั้งหมด
    const transactions = await prisma.assetTransactionHistory.findMany({
      orderBy: { createdAt: "asc" },
    });

    // 4. Format data สำหรับ Excel
    const excelData = transactions.map((t) => ({
      "Barcode": t.barcode,
      "Asset Name": t.assetName,
      "Warehouse": t.warehouseIn || "",
      "Asset Status": t.assetStatus || "",
      "In stock Date": t.inStockDate ? new Date(t.inStockDate).toLocaleDateString("th-TH") : "",
      "Start Warranty": t.startWarranty || "",
      "End Warranty": t.endWarranty || "",
      "Cheil PO": t.cheilPO || "",
      "Unit In": t.unitIn ?? "",
      "From Vendor": t.fromVendor || "",
      "MCS Code (In)": t.mcsCodeIn || "",
      "From Shop": t.fromShop || "",
      "Out Date": t.outDate ? new Date(t.outDate).toLocaleDateString("th-TH") : "",
      "Unit Out": t.unitOut ?? "",
      "To Vendor": t.toVendor || "",
      "Status": t.status || "",
      "Shop Type": t.shopType || "",
      "MCS Code (Out)": t.mcsCodeOut || "",
      "To Shop": t.toShop || "",
      "Balance": t.balance,
      "Size": t.size || "",
      "Grade": t.grade || "",
      "Remark IN": t.remarkIn || "",
      "Remark OUT": t.remarkOut || "",
      "WK OUT": t.wkOut || "",
      "WK IN": t.wkIn || "",
      "WK OUT for Repair": t.wkOutForRepair || "",
      "WK IN for Repair": t.wkInForRepair || "",
      "New In Stock": t.newInStock || "",
      "Refurbished Instock": t.refurbishedInStock || "",
      "Borrow": t.borrow || "",
      "Return": t.return || "",
      "Repair": t.repair || "",
      "Out to Rental WH": t.outToRentalWarehouse || "",
      "In to Rental WH": t.inToRentalWarehouse || "",
      "Discarded": t.discarded || "",
      "Adjust Error": t.adjustError || "",
    }));

    // 5. สร้าง Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Asset Database");

    // 6. สร้าง buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // 7. ส่งไฟล์กลับ
    const filename = `Asset_Database_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting database:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}