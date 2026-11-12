// API ตั้งค่า Auto Barcode: GET (ทุกคนที่ login), POST/PUT/DELETE (Admin เท่านั้น)
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth-helpers";
import { AuditAction, getSessionUser, writeAuditLog } from "@/lib/audit-log";

type RuleInput = {
  assetName?: unknown;
  warehouse1?: unknown;
  warehouse2?: unknown;
  isSecuritySet?: unknown;
};

function parseInput(body: RuleInput) {
  const assetName = typeof body.assetName === "string" ? body.assetName.trim() : "";
  const warehouse1 = typeof body.warehouse1 === "string" ? body.warehouse1.trim() : "";
  const warehouse2Raw = typeof body.warehouse2 === "string" ? body.warehouse2.trim() : "";
  const warehouse2 = warehouse2Raw || null;
  const isSecuritySet = body.isSecuritySet === true;

  if (!assetName) return { error: "กรุณาระบุ Asset Name" } as const;
  if (!warehouse1) return { error: "กรุณาเลือกโกดังลำดับที่ 1" } as const;
  if (warehouse2 && warehouse2 === warehouse1) return { error: "โกดังลำดับที่ 1 และ 2 ต้องไม่ซ้ำกัน" } as const;

  return { data: { assetName, warehouse1, warehouse2, isSecuritySet } } as const;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const rules = await prisma.autoBarcodeRule.findMany({ orderBy: { assetName: "asc" } });
    return NextResponse.json({ success: true, rules });
  } catch (error) {
    console.error("[AUTO BARCODE RULE GET]", error);
    return NextResponse.json({ success: false, message: "โหลดข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const parsed = parseInput(await req.json());
    if ("error" in parsed) return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });

    const rule = await prisma.autoBarcodeRule.create({ data: parsed.data });
    await writeAuditLog({
      ...getSessionUser(auth.session),
      action: AuditAction.AUTO_BARCODE_RULE_CREATE,
      entity: "AutoBarcodeRule",
      entityId: String(rule.id),
      detail: parsed.data,
      req,
    });
    return NextResponse.json({ success: true, rule });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ success: false, message: "Asset Name นี้ตั้งค่าไว้แล้ว" }, { status: 409 });
    }
    console.error("[AUTO BARCODE RULE POST]", error);
    return NextResponse.json({ success: false, message: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "id ไม่ถูกต้อง" }, { status: 400 });
    }
    const parsed = parseInput(body);
    if ("error" in parsed) return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });

    const before = await prisma.autoBarcodeRule.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ success: false, message: "ไม่พบรายการ" }, { status: 404 });

    const rule = await prisma.autoBarcodeRule.update({ where: { id }, data: parsed.data });
    await writeAuditLog({
      ...getSessionUser(auth.session),
      action: AuditAction.AUTO_BARCODE_RULE_UPDATE,
      entity: "AutoBarcodeRule",
      entityId: String(id),
      detail: { before, after: parsed.data },
      req,
    });
    return NextResponse.json({ success: true, rule });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ success: false, message: "Asset Name นี้ตั้งค่าไว้แล้ว" }, { status: 409 });
    }
    console.error("[AUTO BARCODE RULE PUT]", error);
    return NextResponse.json({ success: false, message: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "id ไม่ถูกต้อง" }, { status: 400 });
    }
    const before = await prisma.autoBarcodeRule.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ success: false, message: "ไม่พบรายการ" }, { status: 404 });

    await prisma.autoBarcodeRule.delete({ where: { id } });
    await writeAuditLog({
      ...getSessionUser(auth.session),
      action: AuditAction.AUTO_BARCODE_RULE_DELETE,
      entity: "AutoBarcodeRule",
      entityId: String(id),
      detail: { before },
      req,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AUTO BARCODE RULE DELETE]", error);
    return NextResponse.json({ success: false, message: "ลบไม่สำเร็จ" }, { status: 500 });
  }
}
