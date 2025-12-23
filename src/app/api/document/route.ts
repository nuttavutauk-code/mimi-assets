import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // ✅ ดึง session จาก NextAuth
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    // ✅ ดึงข้อมูล user จาก database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ✅ ดึง initials เช่น "DP"
    const initials = user.initials?.toUpperCase() || "XX";

    // ✅ วันที่ปัจจุบัน
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    // ✅ หาใบเบิกที่สร้างวันนี้
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const countToday = await prisma.document.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // ✅ รันเลขต่อท้าย
    const seq = String(countToday + 1).padStart(2, "0");

    // ✅ สร้างเลขที่ใบเบิก
    const docCode = `${initials}${yy}${mm}${dd}${seq}`;

    return NextResponse.json({ docCode });
  } catch (error) {
    console.error("[DOCUMENT_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
