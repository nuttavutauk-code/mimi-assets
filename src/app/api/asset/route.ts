import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  try {
    // เช็ค Authentication
    const auth = await requireAuth();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 10;
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const where = search
      ? {
        OR: [
          { barcode: { contains: search, mode: "insensitive" as const } },
          { assetName: { contains: search, mode: "insensitive" as const } },
          { size: { contains: search, mode: "insensitive" as const } },
          { warehouse: { contains: search, mode: "insensitive" as const } },
        ],
      }
      : {};

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { id: "desc" },
        skip,
        take: limit,
      }),
      prisma.asset.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[ASSET_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}