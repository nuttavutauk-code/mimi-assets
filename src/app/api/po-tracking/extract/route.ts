import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { writeAuditLog, getSessionUser, AuditAction } from "@/lib/audit-log";
import { DOC_TYPES, DOC_TYPE_LABEL, MAX_FILES_PER_JOB, MAX_TOTAL_UPLOAD_BYTES } from "@/lib/po-tracking/constants";
import { extractDocuments, describeAnthropicError, type ExtractedDocument } from "@/lib/po-tracking/extract";
import { buildRows } from "@/lib/po-tracking/mapping";

export const dynamic = "force-dynamic";

// PDF ถูกอ่านเป็น Buffer ในหน่วยความจำเท่านั้น ไม่มีการเขียนลงดิสก์
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, message: "อ่านไฟล์ที่อัปโหลดไม่ได้ (ไฟล์อาจใหญ่เกิน 9MB)" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ success: false, message: "กรุณาเลือกไฟล์ PDF" }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_JOB) {
    return NextResponse.json({ success: false, message: `อัปโหลดได้สูงสุด ${MAX_FILES_PER_JOB} ไฟล์ต่อ job` }, { status: 400 });
  }
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  if (totalSize > MAX_TOTAL_UPLOAD_BYTES) {
    return NextResponse.json({ success: false, message: "ขนาดไฟล์รวมเกิน 9MB" }, { status: 400 });
  }

  const buffers: { name: string; data: Buffer }[] = [];
  for (const file of files) {
    const data = Buffer.from(await file.arrayBuffer());
    if (data.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json({ success: false, message: `ไฟล์ ${file.name} ไม่ใช่ PDF` }, { status: 400 });
    }
    buffers.push({ name: file.name, data });
  }

  const perFile: { name: string; docs: ExtractedDocument[] }[] = [];
  try {
    perFile.push(
      ...(await Promise.all(
        buffers.map(async ({ name, data }) => ({ name, docs: await extractDocuments(data, name) })),
      )),
    );
  } catch (error) {
    console.error("[PO_TRACKING_EXTRACT_ERROR]", error);
    const { message, status } = describeAnthropicError(error);
    return NextResponse.json({ success: false, message }, { status });
  }

  const extracted = perFile.flatMap(({ name, docs }) => docs.map((doc) => ({ name, doc })));
  const where = (e: { name: string; doc: ExtractedDocument }) =>
    perFile.find((f) => f.name === e.name)!.docs.length > 1 ? `${e.name} หน้า ${e.doc.pages}` : e.name;

  const fileSummaries = [
    ...extracted.map((e) => ({
      name: e.name,
      pages: e.doc.pages,
      documentType: e.doc.documentType,
      label: DOC_TYPE_LABEL[e.doc.documentType] ?? DOC_TYPE_LABEL.unknown,
      reason: e.doc.documentTypeReason,
    })),
    ...perFile
      .filter((f) => f.docs.length === 0)
      .map((f) => ({ name: f.name, pages: "", documentType: "unknown" as const, label: DOC_TYPE_LABEL.unknown, reason: "" })),
  ];

  const problems: string[] = [];
  const byType = {} as Record<(typeof DOC_TYPES)[number], ExtractedDocument>;
  for (const type of DOC_TYPES) {
    const matches = extracted.filter((e) => e.doc.documentType === type);
    if (matches.length === 0) problems.push(`ไม่พบ ${DOC_TYPE_LABEL[type]}`);
    else if (matches.length > 1) {
      problems.push(`พบ ${DOC_TYPE_LABEL[type]} ซ้ำ ${matches.length} ใบ (${matches.map(where).join(", ")})`);
    } else byType[type] = matches[0].doc;
  }

  if (problems.length > 0) {
    return NextResponse.json(
      { success: false, message: `เอกสารไม่ครบชุด: ${problems.join(" / ")}`, files: fileSummaries },
      { status: 400 },
    );
  }

  const { rows, warnings } = buildRows(byType.cheil_po, byType.samsung_po, byType.quotation);

  const user = getSessionUser(auth.session);
  await writeAuditLog({
    ...user,
    action: AuditAction.PO_TRACKING_EXTRACT,
    entity: "PoTrackingRow",
    detail: {
      files: fileSummaries.map((f) => `${f.name}${f.pages ? ` p.${f.pages}` : ""} → ${f.documentType}`),
      jobNo: rows[0]?.jobNo,
      rowCount: rows.length,
    },
    req,
  });

  return NextResponse.json({
    success: true,
    files: fileSummaries,
    rows,
    warnings,
    aiRaw: Object.fromEntries(perFile.map(({ name, docs }) => [name, docs])),
  });
}
