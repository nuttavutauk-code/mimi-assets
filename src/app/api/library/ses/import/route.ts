import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ✅ ฟังก์ชันแปลงค่าให้เป็น string ที่ปลอดภัย
const safeString = (value: any): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && isNaN(value)) return null;
  const str = String(value).trim();
  return str === "" || str === "NaN" || str === "undefined" ? null : str;
};

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
      category: safeString(r["CATEGORY"]),
      imageUrl: safeString(r["IMAGE_URL"]),
      assetName: safeString(r["ASSET NAME"]) ?? "",
      code: safeString(r["CODE"]),
      barcode: safeString(r["BARCODE"]),
      dimensionMm: safeString(r["DIMENSION(mm)"]),
      status: safeString(r["STATUS"]),
      remark: safeString(r["REMARK"]),
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