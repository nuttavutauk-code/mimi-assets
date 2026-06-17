import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth-helpers";

type TemplateConfig = {
  filename: string;
  sheetName: string;
  sampleRow: Record<string, string>;
};

const TEMPLATES: Record<string, TemplateConfig> = {
  new: {
    filename: "Template_Import_Asset.xlsx",
    sheetName: "Assets",
    sampleRow: {
      BARCODE: "B00000001",
      "ASSET NAME": "Sample Asset Name",
      SIZE: "M",
      WAREHOUSE: "Vendor A",
      "START WARRANTY": "01-01-2025",
      "END WARRANTY": "31-12-2026",
      "CHEIL PO": "PO-12345",
    },
  },
  used: {
    filename: "Template_Import_Asset_USED.xlsx",
    sheetName: "Assets USED",
    sampleRow: {
      Barcode: "B00000001",
      "Asset Name": "Sample Asset Name",
      Size: "M",
      Grade: "B",
      "Warehouse In": "Vendor A",
      "From Vendor": "Vendor A",
      "MCS Code In": "MCS-001",
      "From Shop": "Shop A",
      "Remark In": "Imported from old stock",
      "Start Warranty": "01-01-2024",
      "End Warranty": "31-12-2025",
      "Cheil PO": "PO-12345",
      "In Stock Date": "01-01-2025",
    },
  },
  refurbished: {
    filename: "Template_Import_Asset_REFURBISHED.xlsx",
    sheetName: "Assets REFURBISHED",
    sampleRow: {
      Barcode: "B00000001",
      "Asset Name": "Sample Asset Name",
      Size: "M",
      Grade: "B",
      "Warehouse In": "Vendor A",
      "From Vendor": "Vendor A",
      "MCS Code In": "MCS-001",
      "From Shop": "Shop A",
      "Remark In": "Refurbished from repair",
      "Start Warranty": "01-01-2024",
      "End Warranty": "31-12-2025",
      "Cheil PO": "PO-12345",
      "In Stock Date": "01-01-2025",
    },
  },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { type } = await params;
    const config = TEMPLATES[type];

    if (!config) {
      return NextResponse.json(
        { error: `Unknown template type: ${type}` },
        { status: 400 }
      );
    }

    const worksheet = XLSX.utils.json_to_sheet([config.sampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName);

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${config.filename}"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("[ASSET_TEMPLATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    );
  }
}
