import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const sampleRow: Record<string, string | number> = {
      "Barcode": "B00000001",
      "Asset Name": "Sample Asset Name",
      "Size": "M",
      "Grade": "A",
      "Start Warranty": "01/01/2025",
      "End Warranty": "31/12/2026",
      "Cheil PO": "PO-12345",
      "Warehouse": "Vendor A",
      "In stock Date": "01/01/2025",
      "Unit In": 1,
      "From Vendor": "Vendor A",
      "MCS Code (In)": "MCS-001",
      "From Shop": "Shop A",
      "Remark IN": "Imported from legacy",
      "Out Date": "",
      "Unit Out": "",
      "To Vendor": "",
      "Status": "",
      "Shop Type": "",
      "MCS Code (Out)": "",
      "To Shop": "",
      "Remark OUT": "",
      "Asset Status": "USED",
      "Balance": 1,
      "WK OUT": "",
      "WK IN": "",
      "WK OUT for Repair": "",
      "WK IN for Repair": "",
      "New In Stock": "",
      "Refurbished Instock": "",
      "Borrow": "",
      "Return": "",
      "Repair": "",
      "Out to Rental WH": "",
      "In to Rental WH": "",
      "Discarded": "",
      "Adjust Error": "",
    };

    const worksheet = XLSX.utils.json_to_sheet([sampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Database");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": 'attachment; filename="Template_Import_Database.xlsx"',
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("[DATABASE_TEMPLATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    );
  }
}
