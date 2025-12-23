import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // ✅ รับทั้ง "q" และ "query" เพื่อ compatibility
  const q = searchParams.get("q") || searchParams.get("query") || "";
  const status = searchParams.get("status"); // ✅ รับ status filter (OPEN/CLOSED)

  try {
    // ✅ สร้าง where condition
    const whereCondition: any = {
      OR: [
        { mcsCode: { contains: q, mode: "insensitive" } },
        { shopName: { contains: q, mode: "insensitive" } },
      ],
    };

    // ✅ เพิ่ม status filter ถ้ามี
    if (status) {
      whereCondition.status = { equals: status, mode: "insensitive" };
    }

    const shops = await prisma.shop.findMany({
      where: whereCondition,
      take: 10,
    });

    return NextResponse.json({ shops });
  } catch (error) {
    console.error("[SHOP_SEARCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch shops" }, { status: 500 });
  }
}