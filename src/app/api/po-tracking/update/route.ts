import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { writeAuditLog, getSessionUser, AuditAction } from "@/lib/audit-log";
import { sanitizeRowInput } from "@/lib/po-tracking/constants";

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const updates: unknown = body?.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ success: false, message: "ไม่มีข้อมูลที่เปลี่ยนแปลง" }, { status: 400 });
    }

    const valid = updates
      .map((u) => {
        const { id, ...fields } = (u ?? {}) as Record<string, unknown>;
        return { id: Number(id), data: sanitizeRowInput(fields) };
      })
      .filter((u) => Number.isInteger(u.id) && Object.keys(u.data).length > 0);

    if (valid.length === 0) {
      return NextResponse.json({ success: false, message: "ไม่มีข้อมูลที่เปลี่ยนแปลง" }, { status: 400 });
    }

    const results = await prisma.$transaction(
      valid.map((u) => prisma.poTrackingRow.update({ where: { id: u.id }, data: u.data })),
    );

    await writeAuditLog({
      ...getSessionUser(auth.session),
      action: AuditAction.PO_TRACKING_UPDATE,
      entity: "PoTrackingRow",
      detail: { changes: valid.map((u) => ({ id: u.id, fields: Object.keys(u.data) })) },
      req,
    });

    return NextResponse.json({ success: true, updatedCount: results.length, message: `อัปเดต ${results.length} แถวแล้ว` });
  } catch (error) {
    console.error("[PO_TRACKING_UPDATE_ERROR]", error);
    return NextResponse.json({ success: false, message: "บันทึกการแก้ไขไม่สำเร็จ" }, { status: 500 });
  }
}
