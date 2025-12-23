import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

/**
 * 🔍 API: ดึงรายการ Size ของ Asset ที่เลือก
 * GET /api/asset/sizes?name=Light Box
 * 
 * สำหรับ Lightbox และ ACC WALL:
 * - ถ้ามี Asset ที่ไม่มี Size → เพิ่มตัวเลือก "ไม่มีsize"
 */
export async function GET(req: Request) {
  try {
    // เช็ค Authentication
    const auth = await requireAuth();
    if (auth.response) return auth.response;


    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json({ sizes: [], hasNoSize: false });
    }

    const assets = await prisma.asset.findMany({
      where: {
        assetName: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: {
        size: true,
      },
    });

    // 🔹 กรองเฉพาะ size ที่ไม่ว่างและไม่ซ้ำ
    const sizes = Array.from(
      new Set(
        assets
          .map((a) => a.size)
          .filter((s): s is string => !!s && s.trim() !== "")
      )
    );

    // 🔹 เช็คว่ามี Asset ที่ไม่มี Size หรือไม่
    const hasNoSize = assets.some((a) => !a.size || a.size.trim() === "");

    // 🔹 สำหรับ Lightbox และ ACC WALL: เพิ่ม "ไม่มีsize" เสมอ (ให้ user เลือก custom size ได้)
    const nameLower = name.toLowerCase().replace(/\s+/g, '');
    const isCustomSizeAsset = nameLower.includes("lightbox") ||
      nameLower.includes("accwall") ||
      name.toLowerCase().includes("light box") ||
      name.toLowerCase().includes("acc wall");

    if (isCustomSizeAsset) {
      // เพิ่ม "ไม่มีsize" เสมอ ถ้ายังไม่มี
      if (!sizes.includes("ไม่มีsize")) {
        sizes.push("ไม่มีsize");
      }
    }

    return NextResponse.json({ sizes, hasNoSize });
  } catch (error) {
    console.error("❌ Error /api/asset/sizes:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset sizes" },
      { status: 500 }
    );
  }
}