import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth-helpers";
import { readdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ✅ ฟังก์ชันแปลงค่าให้เป็น string ที่ปลอดภัย
const safeString = (value: any): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && isNaN(value)) return null;
  const str = String(value).trim();
  return str === "" || str === "NaN" || str === "undefined" ? null : str;
};

// ✅ นามสกุลไฟล์รูปที่รองรับ
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

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

    // ✅ Auto-sync รูปภาพจากโฟลเดอร์ /public/uploads/ses/
    let syncedCount = 0;
    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads", "ses");
      const files = await readdir(uploadDir);
      
      // สร้าง map ของไฟล์รูป: ชื่อไฟล์ (ไม่รวมนามสกุล) -> path
      const imageMap = new Map<string, string>();
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          const nameWithoutExt = path.basename(file, ext).toLowerCase().trim();
          imageMap.set(nameWithoutExt, `/uploads/ses/${file}`);
        }
      }

      // ดึงข้อมูลที่เพิ่งสร้างใหม่
      const allRecords = await prisma.librarySES.findMany({
        select: { id: true, assetName: true, imageUrl: true },
      });

      // อัปเดต imageUrl สำหรับรายการที่มีรูปตรงกัน
      for (const record of allRecords) {
        if (record.assetName && !record.imageUrl) {
          const assetNameLower = record.assetName.toLowerCase().trim();
          const matchedImageUrl = imageMap.get(assetNameLower);
          
          if (matchedImageUrl) {
            await prisma.librarySES.update({
              where: { id: record.id },
              data: { imageUrl: matchedImageUrl },
            });
            syncedCount++;
          }
        }
      }
    } catch (syncError) {
      // ถ้า sync ไม่สำเร็จ (เช่น โฟลเดอร์ไม่มี) ก็ไม่เป็นไร ยังคง import สำเร็จ
      console.log("[SYNC IMAGES] No existing images to sync or folder not found");
    }

    return NextResponse.json({
      ok: true,
      message: `นำเข้าเสร็จสิ้น (${parsed.length} แถว)${syncedCount > 0 ? ` | Sync รูปภาพ ${syncedCount} รายการ` : ""}`,
      imported: parsed.length,
      synced: syncedCount,
    });
  } catch (err) {
    console.error("[IMPORT SES ERROR]", err);
    return NextResponse.json({ error: "Import ล้มเหลว" }, { status: 500 });
  }
}