import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth-helpers";
import { readdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

// ✅ ฟังก์ชันแปลงค่าให้เป็น string ที่ปลอดภัย
const safeString = (value: any): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && isNaN(value)) return null;
  const str = String(value).trim();
  return str === "" || str === "NaN" || str === "undefined" ? null : str;
};

// ✅ นามสกุลไฟล์รูปที่รองรับ
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

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

    // ✅ Auto-sync รูปภาพจากโฟลเดอร์ /public/uploads/sis/
    let syncedCount = 0;
    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads", "sis");
      const files = await readdir(uploadDir);
      
      // สร้าง map ของไฟล์รูป: ชื่อไฟล์ (ไม่รวมนามสกุล) -> path
      const imageMap = new Map<string, string>();
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          const nameWithoutExt = path.basename(f, ext).toLowerCase().trim();
          imageMap.set(nameWithoutExt, `/uploads/sis/${f}`);
        }
      }

      // ดึงข้อมูลที่เพิ่งสร้างใหม่
      const allRecords = await prisma.librarySIS.findMany({
        select: { id: true, assetName: true, pictureUrl: true },
      });

      // อัปเดต pictureUrl สำหรับรายการที่มีรูปตรงกัน
      for (const record of allRecords) {
        if (record.assetName && !record.pictureUrl) {
          const assetNameLower = record.assetName.toLowerCase().trim();
          const matchedImageUrl = imageMap.get(assetNameLower);
          
          if (matchedImageUrl) {
            await prisma.librarySIS.update({
              where: { id: record.id },
              data: { pictureUrl: matchedImageUrl },
            });
            syncedCount++;
          }
        }
      }
    } catch (syncError) {
      // ถ้า sync ไม่สำเร็จ (เช่น โฟลเดอร์ไม่มี) ก็ไม่เป็นไร ยังคง import สำเร็จ
      console.log("[SYNC IMAGES SIS] No existing images to sync or folder not found");
    }

    return NextResponse.json({
      ok: true,
      message: `นำเข้าข้อมูลสำเร็จ (${parsed.length} แถว)${syncedCount > 0 ? ` | Sync รูปภาพ ${syncedCount} รายการ` : ""}`,
      imported: parsed.length,
      synced: syncedCount,
    });
  } catch (err) {
    console.error("[IMPORT SIS ERROR]", err);
    return NextResponse.json({ error: "Import ล้มเหลว" }, { status: 500 });
  }
}