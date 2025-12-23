import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; // ✅ ใช้อันนี้แทน

export async function GET() {
  try {
    // ✅ ดึงข้อมูลผู้ใช้จาก session
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ✅ ดึง initials เช่น "RC", "AD"
    const initials = user.initials?.toUpperCase() || "XX";

    // ✅ วันที่ปัจจุบัน (ใช้ไทย format YYMMDD)
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const datePrefix = `${initials}${yy}${mm}${dd}`;

    // ✅ ค้นหาเอกสารล่าสุดของ user นี้ใน "วันเดียวกัน"
    const lastDoc = await prisma.document.findFirst({
      where: {
        docCode: {
          startsWith: datePrefix, // เช่น RC251104
        },
      },
      orderBy: { docCode: "desc" }, // หา docCode ล่าสุด
    });

    let nextSeq = "01";

    if (lastDoc?.docCode) {
      // ✅ แยกเลขท้าย 2 หลักจาก docCode แล้ว +1
      const lastSeq = parseInt(lastDoc.docCode.slice(-2), 10);
      const newSeq = lastSeq + 1;
      nextSeq = String(newSeq).padStart(2, "0");
    }

    // ✅ รวมเป็น docCode ใหม่
    const docCode = `${datePrefix}${nextSeq}`;

    return NextResponse.json({ success: true, docCode });
  } catch (error) {
    console.error("[GENERATE_DOC_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate document code" },
      { status: 500 }
    );
  }
}
