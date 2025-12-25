import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// ✅ ฟังก์ชันแปลงค่าให้เป็น string ที่ปลอดภัย
const safeString = (value: any): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && isNaN(value)) return null;
  const str = String(value).trim();
  return str === "" || str === "NaN" || str === "undefined" ? null : str;
};

export async function POST(req: Request) {
  try {
    // เช็ค Authentication (Admin only)
    const auth = await requireAdmin();
    if (auth.response) return auth.response;


    const formData = await req.formData();
    const file = formData.get("excel") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    const parsed = json.map((r: any) => ({
      barcode: safeString(r["BARCODE"]),
      assetName: safeString(r["ASSET NAME"]),
      assetType: safeString(r["ASSET TYPE"]),
      dimension: safeString(r["DIMENSION"]),
      warehouse: safeString(r["WAREHOUSE"]),
      pictureUrl: safeString(r["IMAGE"]),
      status: safeString(r["STATUS"]),
      remark: safeString(r["REMARK"]),
      digit: safeString(r["DIGIT"]),
    }));

    await prisma.librarySIS.deleteMany();
    await prisma.librarySIS.createMany({ data: parsed });

    return NextResponse.json({
      ok: true,
      message: `นำเข้าข้อมูลสำเร็จ (${parsed.length} แถว)`,
    });
  } catch (err) {
    console.error("[IMPORT SIS ERROR]", err);
    return NextResponse.json({ error: "Import ล้มเหลว" }, { status: 500 });
  }
}