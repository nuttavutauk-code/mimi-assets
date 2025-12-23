import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  try {
    // เช็ค Authentication (Admin only)
    const auth = await requireAdmin();
    if (auth.response) return auth.response;


    const shops = await prisma.shop.findMany({
      orderBy: { id: "asc" },
    });

    if (!shops || shops.length === 0) {
      return NextResponse.json({ error: "ไม่มีข้อมูลร้านค้า" }, { status: 404 });
    }

    // ✅ แปลงข้อมูลเป็น Sheet
    const data = shops.map((s) => ({
      "MCS CODE": s.mcsCode,
      "SHOP NAME": s.shopName,
      REGION: s.region,
      STATE: s.state,
      "SHOP TYPE": s.shopType,
      STATUS: s.status,
      "CREATED AT": new Date(s.createdAt).toLocaleString(),
      "UPDATED AT": new Date(s.updatedAt).toLocaleString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Shops");

    // ✅ เขียนเป็น buffer เพื่อให้ browser ดาวน์โหลด
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="Shop_Data_${new Date().toISOString().split("T")[0]}.xlsx"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("[SHOP_EXPORT_ERROR]", error);
    return NextResponse.json({ error: "Export Excel failed" }, { status: 500 });
  }
}