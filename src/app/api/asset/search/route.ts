import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

/**
 * 🔍 API: ค้นหา Asset Name (AutoComplete)
 * GET /api/asset/search?query=light
 */
export async function GET(req: Request) {
  try {
    // เช็ค Authentication
    const auth = await requireAuth();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ assets: [] });
    }

    const assets = await prisma.asset.findMany({
      where: {
        assetName: {
          contains: query,
          mode: "insensitive", // ไม่สนตัวพิมพ์เล็ก/ใหญ่
        },
      },
      select: {
        assetName: true,
        size: true,
      },
      take: 50,
    });

    // 🔹 กรองชื่อซ้ำ เหลือชื่อเดียว (ชื่อเดียวกันไม่ต้องซ้ำ)
    const uniqueNames = Array.from(
      new Map(
        assets
          .filter((a) => a.assetName)
          .map((a) => [a.assetName?.trim().toLowerCase(), a])
      ).values()
    );

    return NextResponse.json({ assets: uniqueNames });
  } catch (error) {
    console.error("❌ Error /api/asset/search:", error);
    return NextResponse.json(
      { error: "Failed to fetch assets" },
      { status: 500 }
    );
  }
}
