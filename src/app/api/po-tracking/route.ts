import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { PO_FIELDS } from "@/lib/po-tracking/constants";
import { buildSearchWhere } from "@/lib/po-tracking/search";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const where = buildSearchWhere(searchParams.get("q"));

    const select = Object.fromEntries([...PO_FIELDS, "id", "jobGroupId", "createdAt"].map((f) => [f, true]));

    const [rows, totalCount] = await Promise.all([
      prisma.poTrackingRow.findMany({
        where,
        select,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.poTrackingRow.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: { currentPage: page, totalPages: Math.max(1, Math.ceil(totalCount / limit)), totalCount, limit },
    });
  } catch (error) {
    console.error("[PO_TRACKING_LIST_ERROR]", error);
    return NextResponse.json({ success: false, message: "โหลดข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
