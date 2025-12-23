import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 📦 API: /api/library/ses/import
 * Method: POST
 * Body: multipart/form-data (ไฟล์ Excel)
 */
export async function POST(req: Request) {
  try {
    // เช็ค Authentication (Admin only)
    const auth = await requireAdmin();
    if (auth.response) return auth.response;


    const form = await req.formData();
    const excelFile = form.get("excel") as File | null;

    if (!excelFile) {
      return NextResponse.json({ error: "กรุณาแนบไฟล์ Excel" }, { status: 400 });
    }

    // อ่านข้อมูล Excel
    const excelBuffer = Buffer.from(await excelFile.arrayBuffer());
    const workbook = XLSX.read(excelBuffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });

    // แปลงข้อมูลเป็นรูปแบบที่ตรงกับ Prisma model
    const parsed = rows.map((r) => ({
      category: r["CATEGORY"] ?? null,
      imageUrl: r["IMAGE_URL"] ?? null,
      assetName: r["ASSET NAME"] ?? "",
      code: r["CODE"] ?? null,
      barcode: r["BARCODE"] ?? null,
      dimensionMm: r["DIMENSION(mm)"] ?? null,
      status: r["STATUS"] ?? null,
      remark: r["REMARK"] ?? null,
    }));

    // ลบข้อมูลเก่าทั้งหมดก่อนเพิ่มใหม่
    await prisma.librarySES.deleteMany({});
    await prisma.librarySES.createMany({ data: parsed });

    return NextResponse.json({
      ok: true,
      message: `นำเข้าเสร็จสิ้น (${parsed.length} แถว)`,
    });
  } catch (err) {
    console.error("[IMPORT SES ERROR]", err);
    return NextResponse.json({ error: "Import ล้มเหลว" }, { status: 500 });
  }
}
