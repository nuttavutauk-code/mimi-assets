// GET /api/asset-summary/export?status=&search= — Export สรุปสต็อกเป็น Excel (3 sheet)
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth-helpers";
import { getInStockSummaryRows } from "@/lib/assetSummary";
import { buildPivot, filterSummaryRows, groupSummary, type Group } from "@/lib/assetSummaryPivot";

function groupSheet(groups: Group[], keyLabel: string, detailLabel: string) {
  const data: Record<string, string | number>[] = [];
  for (const g of groups) {
    data.push({
      [keyLabel]: g.key,
      [detailLabel]: "รวม",
      "จำนวน": g.total,
      NEW: g.byStatus.NEW,
      REFURBISHED: g.byStatus.REFURBISHED,
      USED: g.byStatus.USED,
      "ไม่ระบุ Status": g.byStatus["ไม่ระบุ"],
    });
    for (const d of g.details) {
      data.push({
        [keyLabel]: g.key,
        [detailLabel]: d.key,
        "จำนวน": d.total,
        NEW: d.byStatus.NEW,
        REFURBISHED: d.byStatus.REFURBISHED,
        USED: d.byStatus.USED,
        "ไม่ระบุ Status": d.byStatus["ไม่ระบุ"],
      });
    }
  }
  return XLSX.utils.json_to_sheet(data);
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";
    const search = searchParams.get("search") || "";
    const rows = filterSummaryRows(await getInStockSummaryRows(), status, search);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, groupSheet(groupSummary(rows, "asset"), "Asset Name", "โกดัง"), "ตาม Asset");
    XLSX.utils.book_append_sheet(workbook, groupSheet(groupSummary(rows, "warehouse"), "โกดัง", "Asset Name"), "ตามโกดัง");

    const pivot = buildPivot(rows);
    const aoa: (string | number)[][] = [
      ["Asset Name", ...pivot.warehouses, "รวม"],
      ...pivot.assets.map((a) => [a, ...pivot.warehouses.map((w) => pivot.cells[a][w] || 0), pivot.rowTotals[a]]),
      ["รวม", ...pivot.warehouses.map((w) => pivot.colTotals[w]), pivot.grandTotal],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), "ตารางไขว้");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const date = new Date().toISOString().slice(0, 10);
    const filename = `asset-stock-summary-${date}${status !== "ALL" ? `-${status}` : ""}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[ASSET SUMMARY EXPORT]", error);
    return NextResponse.json({ success: false, message: "Export ไม่สำเร็จ" }, { status: 500 });
  }
}
