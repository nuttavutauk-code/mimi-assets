// POST /api/auto-barcode/pick — เลือก Barcode อัตโนมัติตามการตั้งค่า (Admin เท่านั้น)
// body: { assetName, size?, qty, exclude?: string[], allowSplit?: boolean }
// response: { success, ruleFound, allocations: [{ warehouse, barcodes }], shortfall }
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { allocateBarcodes } from "@/lib/autoBarcode";

const MAX_QTY = 500;

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const assetName = typeof body.assetName === "string" ? body.assetName.trim() : "";
    const size = typeof body.size === "string" ? body.size.trim() : "";
    const qty = Math.floor(Number(body.qty));
    const allowSplit = body.allowSplit !== false;
    const exclude = Array.isArray(body.exclude)
      ? body.exclude.filter((b: unknown): b is string => typeof b === "string" && b.length > 0)
      : [];

    if (!assetName) return NextResponse.json({ success: false, message: "กรุณาระบุ Asset Name" }, { status: 400 });
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) {
      return NextResponse.json({ success: false, message: "จำนวนไม่ถูกต้อง" }, { status: 400 });
    }

    const rule = await prisma.autoBarcodeRule.findUnique({ where: { assetName } });
    if (!rule) {
      return NextResponse.json({ success: true, ruleFound: false, allocations: [], shortfall: qty });
    }

    const result = await allocateBarcodes({
      assetName,
      size,
      qty,
      isSecuritySet: rule.isSecuritySet, // ใช้ค่าจากการตั้งค่า (CONTROLBOX → SecuritySetTransaction)
      exclude,
      warehouse1: rule.warehouse1,
      warehouse2: rule.warehouse2,
      allowSplit,
    });

    return NextResponse.json({ success: true, ruleFound: true, ...result });
  } catch (error) {
    console.error("[AUTO BARCODE PICK]", error);
    return NextResponse.json({ success: false, message: "เลือก Barcode อัตโนมัติไม่สำเร็จ" }, { status: 500 });
  }
}
