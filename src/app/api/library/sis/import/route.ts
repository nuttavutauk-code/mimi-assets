import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { promises as fs } from "fs";
import { requireAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

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
      barcode: r["BARCODE"] ?? null,
      assetName: r["ASSET NAME"] ?? null,
      assetType: r["ASSET TYPE"] ?? null,
      dimension: r["DIMENSION"] ?? null,
      warehouse: r["WAREHOUSE"] ?? null,
      pictureUrl: r["IMAGE"] ?? null,
      status: r["STATUS"] ?? null,
      remark: r["REMARK"] ?? null,
      digit: r["DIGIT"] ? String(r["DIGIT"]) : null,
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
