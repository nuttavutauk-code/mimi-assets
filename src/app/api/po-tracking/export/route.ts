import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { writeAuditLog, getSessionUser, AuditAction } from "@/lib/audit-log";
import { PO_COLUMNS } from "@/lib/po-tracking/constants";
import { buildSearchWhere } from "@/lib/po-tracking/search";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const q = new URL(req.url).searchParams.get("q");
    const rows = await prisma.poTrackingRow.findMany({
      where: buildSearchWhere(q),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const aoa: (string | number)[][] = [
      PO_COLUMNS.map((c) => c.header),
      ...rows.map((r) => PO_COLUMNS.map((c) => r[c.field] ?? "")),
    ];

    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet["!cols"] = PO_COLUMNS.map((c) => ({ wch: c.field === "assetType" ? 45 : Math.max(12, c.header.length + 2) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "PO Tracking");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    await writeAuditLog({
      ...getSessionUser(auth.session),
      action: AuditAction.PO_TRACKING_EXPORT,
      entity: "PoTrackingRow",
      detail: { rowCount: rows.length, q: q || null },
      req,
    });

    const date = new Date().toISOString().split("T")[0];
    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="PO_Cost_Tracking_${date}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("[PO_TRACKING_EXPORT_ERROR]", error);
    return NextResponse.json({ success: false, message: "Export ไม่สำเร็จ" }, { status: 500 });
  }
}
