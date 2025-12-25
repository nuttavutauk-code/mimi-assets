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
            { assetName: { contains: search } },
            { assetType: { contains: search } },
            { warehouse: { contains: search } },
          ],
        }
      : {};

    const [items, total, lastRecord] = await Promise.all([
      prisma.librarySIS.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: limit,
      }),
      prisma.librarySIS.count({ where }),
      prisma.librarySIS.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);

    return NextResponse.json({
      data: items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      lastUpdated: lastRecord?.updatedAt || null,
    });
  } catch (err) {
    console.error("[GET Library SIS ERROR]", err);
    return NextResponse.json({ error: "Failed to fetch Library SIS" }, { status: 500 });
  }
}