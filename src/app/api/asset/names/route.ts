// app/api/asset/names/route.ts
// API สำหรับดึงรายชื่อ Asset Name ทั้งหมด (unique)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    // 1. เช็ค Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. ดึง asset names ที่ไม่ซ้ำกัน
    const assets = await prisma.asset.findMany({
      where: {
        assetName: {
          not: null,
        },
      },
      select: {
        assetName: true,
      },
      distinct: ["assetName"],
      orderBy: {
        assetName: "asc",
      },
    });

    // 3. กรองเอาเฉพาะที่มีค่า
    const names = assets
      .map((a) => a.assetName)
      .filter((name): name is string => !!name);

    return NextResponse.json({
      success: true,
      names,
    });
  } catch (error) {
    console.error("[GET ASSET NAMES ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch asset names" },
      { status: 500 }
    );
  }
}