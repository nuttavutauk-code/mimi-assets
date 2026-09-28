import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { writeAuditLog, getSessionUser, AuditAction } from "@/lib/audit-log";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jobGroupId: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const { jobGroupId } = await params;
    const first = await prisma.poTrackingRow.findFirst({ where: { jobGroupId }, select: { jobNo: true, chPo: true } });
    const result = await prisma.poTrackingRow.deleteMany({ where: { jobGroupId } });
    if (result.count === 0) {
      return NextResponse.json({ success: false, message: "ไม่พบ job นี้" }, { status: 404 });
    }

    await writeAuditLog({
      ...getSessionUser(auth.session),
      action: AuditAction.PO_TRACKING_DELETE,
      entity: "PoTrackingRow",
      entityId: jobGroupId,
      detail: { jobNo: first?.jobNo ?? null, chPo: first?.chPo ?? null, rowCount: result.count },
      req,
    });

    return NextResponse.json({ success: true, count: result.count, message: `ลบ ${result.count} แถวแล้ว` });
  } catch (error) {
    console.error("[PO_TRACKING_DELETE_ERROR]", error);
    return NextResponse.json({ success: false, message: "ลบข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
