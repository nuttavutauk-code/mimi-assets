import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

/**
 * 📦 GET /api/shop
 * รองรับ search + pagination
 */
export async function GET(req: Request) {
  try {
    // เช็ค Authentication
    const auth = await requireAuth();
    if (auth.response) return auth.response;


    const { searchParams } = new URL(req.url);

    // ✅ ดึงค่าพารามิเตอร์
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 10;
    const search = searchParams.get("search")?.trim() || "";
    const skip = (page - 1) * limit;

    // ✅ เงื่อนไขค้นหา (search จาก mcsCode หรือ shopName)
    const where = search
      ? {
          OR: [
            { mcsCode: { contains: search} },
            { shopName: { contains: search} },
            { region: { contains: search} },
            { state: { contains: search} },
          ],
        }
      : {};

    // ✅ ดึงข้อมูล + จำนวนรวม
    const [shops, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: limit,
      }),
      prisma.shop.count({ where }),
    ]);

    return NextResponse.json({
      data: shops,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[GET_SHOP_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch shops" }, { status: 500 });
  }
}
