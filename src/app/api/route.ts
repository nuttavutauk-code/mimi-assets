import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const vendors = await prisma.user.findMany({
      where: {
        vendor: {
          not: null,
          notIn: ["-"], // ✅ ตัดค่า "-" ออกจากผลลัพธ์
        },
      },
      select: { vendor: true },
      distinct: ["vendor"],
      orderBy: { vendor: "asc" },
    });

    return NextResponse.json({
      success: true,
      vendors: vendors.map((v) => v.vendor),
    });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json({ success: false, vendors: [] }, { status: 500 });
  }
}
