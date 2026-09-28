import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { writeAuditLog, getSessionUser, AuditAction } from "@/lib/audit-log";
import { sanitizeRowInput } from "@/lib/po-tracking/constants";

const MAX_ROWS_PER_JOB = 200;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const rows: unknown = body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: "ไม่มีข้อมูลแถวที่จะบันทึก" }, { status: 400 });
    }
    if (rows.length > MAX_ROWS_PER_JOB) {
      return NextResponse.json({ success: false, message: `บันทึกได้สูงสุด ${MAX_ROWS_PER_JOB} แถวต่อ job` }, { status: 400 });
    }

    const user = getSessionUser(auth.session);
    const jobGroupId = randomUUID();
    const aiRaw = body?.aiRaw && typeof body.aiRaw === "object" ? body.aiRaw : undefined;

    const data = rows.map((r) => ({
      ...sanitizeRowInput((r ?? {}) as Record<string, unknown>),
      jobGroupId,
      aiRaw,
      createdById: user.userId,
    }));

    const result = await prisma.poTrackingRow.createMany({ data });

    await writeAuditLog({
      ...user,
      action: AuditAction.PO_TRACKING_CREATE,
      entity: "PoTrackingRow",
      entityId: jobGroupId,
      detail: { jobNo: data[0].jobNo ?? null, chPo: data[0].chPo ?? null, rowCount: result.count },
      req,
    });

    return NextResponse.json({ success: true, jobGroupId, count: result.count, message: `บันทึก ${result.count} แถวแล้ว` });
  } catch (error) {
    console.error("[PO_TRACKING_CREATE_ERROR]", error);
    return NextResponse.json({ success: false, message: "บันทึกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
