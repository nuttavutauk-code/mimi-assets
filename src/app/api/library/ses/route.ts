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
      ? ({
          OR: [
            { category: { contains: search } },
            { assetName: { contains: search } },
            { code: { contains: search } },
          ],
        })
      : ({} );

    const [items, total] = await Promise.all([
      prisma.librarySES.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: limit,
      }),
      prisma.librarySES.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[GET Library SES ERROR]", err);
    return NextResponse.json({ error: "Failed to fetch Library SES" }, { status: 500 });
  }
}
