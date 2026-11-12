// GET /api/asset-summary — สรุปของที่อยู่ในโกดัง (Asset Name × โกดัง × Status)
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getInStockSummaryRows } from "@/lib/assetSummary";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const rows = await getInStockSummaryRows();
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error("[ASSET SUMMARY]", error);
    return NextResponse.json({ success: false, message: "โหลดข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
