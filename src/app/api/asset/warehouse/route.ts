// 📂 app/api/asset/warehouse/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  try {
    // เช็ค Authentication
    const auth = await requireAuth();
    if (auth.response) return auth.response;


    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json({ success: false, message: "Missing asset name" }, { status: 400 });
    }

    // ✅ ค้นหา assetName ที่ตรงกัน
    const record = await prisma.librarySIS.findFirst({
      where: { assetName: { equals: name, mode: "insensitive" } },
      select: { warehouse: true },
    });

    if (!record || !record.warehouse) {
      return NextResponse.json({ success: false, warehouse: null });
    }

    return NextResponse.json({ success: true, warehouse: record.warehouse });
  } catch (error) {
    console.error("Error fetching warehouse:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
