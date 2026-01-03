// app/api/asset/generate-nobc/route.ts
// API สำหรับ generate barcode แบบ NO BARCODE
// Format: NOBC-{Initials}-{YY}-{M}-{DD}-{XX}

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

    // 2. ดึง initials ของ user
    const userId = parseInt((session.user as any).id || "0");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { initials: true },
    });

    if (!user || !user.initials) {
      return NextResponse.json(
        { error: "User initials not found" },
        { status: 400 }
      );
    }

    // 3. สร้าง prefix วันนี้
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2); // 26
    const month = String(now.getMonth() + 1); // 1-12 (ไม่ pad zero)
    const day = String(now.getDate()).padStart(2, "0"); // 01-31

    const prefix = `NOBC-${user.initials}-${year}-${month}-${day}`;

    // 4. หา running number ของวันนี้
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // นับจำนวน barcode ที่ขึ้นต้นด้วย prefix นี้
    const count = await prisma.asset.count({
      where: {
        barcode: {
          startsWith: prefix,
        },
      },
    });

    // 5. สร้าง running number 2 หลัก
    const runningNumber = String(count + 1).padStart(2, "0");

    // 6. สร้าง barcode
    const barcode = `${prefix}-${runningNumber}`;

    return NextResponse.json({
      success: true,
      barcode,
      initials: user.initials,
    });
  } catch (error) {
    console.error("[GENERATE NOBC ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate barcode" },
      { status: 500 }
    );
  }
}