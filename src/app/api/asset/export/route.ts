import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  try {
    // เช็ค Authentication (Admin only)
    const auth = await requireAdmin();
    if (auth.response) return auth.response;


    // ✅ ดึงข้อมูลทั้งหมดจากฐานข้อมูล
    const assets = await prisma.asset.findMany({
      orderBy: { barcode: "asc" },
    });

    // ✅ ฟังก์ชันแปลงวันที่ให้เป็น DD-MM-YYYY
    const formatDate = (value: any): string => {
      if (!value) return "";
      const date = new Date(value);
      if (isNaN(date.getTime())) return "";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    // ✅ แปลงข้อมูลให้อยู่ในรูปแบบที่ใช้กับ Excel
    const data = assets.map((item) => ({
      BARCODE: item.barcode || "",
      "ASSET NAME": item.assetName || "",
      SIZE: item.size || "",
      WAREHOUSE: item.warehouse || "",
      "START WARRANTY": formatDate(item.startWarranty),
      "END WARRANTY": formatDate(item.endWarranty),
      "CHEIL PO": item.cheilPO || "",
    }));

    // ✅ สร้างไฟล์ Excel
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");

    // ✅ เขียนเป็น buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // ✅ ส่งกลับเป็นไฟล์ Excel
    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": 'attachment; filename="Asset_List.xlsx"',
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("[ASSET_EXPORT_ERROR]", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}