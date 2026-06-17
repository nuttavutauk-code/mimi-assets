"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { SimplePagination } from "@/components/ui/SimplePagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, RefreshCw, Database, Filter, Pencil, Save, X, Download, Upload, FileDown } from "lucide-react";
import { toast } from "sonner";

interface TransactionData {
  id: number;
  docCode: string;
  barcode: string;
  assetName: string;
  warehouseIn: string;
  assetStatus: string;
  inStockDate: string;
  startWarranty: string;
  endWarranty: string;
  cheilPO: string;
  unitIn: number | string;
  fromVendor: string;
  mcsCodeIn: string;
  fromShop: string;
  outDate: string;
  unitOut: number | string;
  toVendor: string;
  status: string;
  shopType: string;
  mcsCodeOut: string;
  toShop: string;
  balance: number;
  size: string;
  grade: string;
  remarkIn: string;
  remarkOut: string;
  wkOut: string;
  wkIn: string;
  wkOutForRepair: string;
  wkInForRepair: string;
  newInStock: string;
  refurbishedInStock: string;
  borrow: string;
  return: string;
  repair: string;
  outToRentalWarehouse: string;
  inToRentalWarehouse: string;
  discarded: string;
  adjustError: string;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

const columnGroups = {
  asset: { color: "bg-amber-50", headerColor: "bg-amber-100 text-amber-800", columns: ["Barcode", "Asset Name", "Start Warranty", "End Warranty", "Cheil PO", "Size", "Grade"] },
  in: { color: "bg-blue-50", headerColor: "bg-blue-100 text-blue-800", columns: ["Warehouse", "In stock Date", "Unit In", "From Vendor", "MCS Code (In)", "From Shop", "Remark IN"] },
  out: { color: "bg-rose-50", headerColor: "bg-rose-100 text-rose-800", columns: ["Out Date", "Unit Out", "To Vendor", "Status", "Shop Type", "MCS Code (Out)", "To Shop", "Remark OUT"] },
  auto: { color: "bg-emerald-50", headerColor: "bg-emerald-100 text-emerald-800", columns: ["Asset Status", "Balance", "WK OUT", "WK IN", "WK OUT for Repair", "WK IN for Repair", "New In Stock", "Refurbished Instock", "Borrow", "Return", "Repair", "Out to Rental WH", "In to Rental WH", "Discarded", "Adjust Error"] }
};

const orderedColumns = [
  { name: "Barcode", group: "asset" }, { name: "Asset Name", group: "asset" }, { name: "Warehouse", group: "in" },
  { name: "Asset Status", group: "auto" }, { name: "In stock Date", group: "in" }, { name: "Start Warranty", group: "asset" },
  { name: "End Warranty", group: "asset" }, { name: "Cheil PO", group: "asset" }, { name: "Unit In", group: "in" },
  { name: "From Vendor", group: "in" }, { name: "MCS Code (In)", group: "in" }, { name: "From Shop", group: "in" },
  { name: "Out Date", group: "out" }, { name: "Unit Out", group: "out" }, { name: "To Vendor", group: "out" },
  { name: "Status", group: "out" }, { name: "Shop Type", group: "out" }, { name: "MCS Code (Out)", group: "out" }, { name: "To Shop", group: "out" },
  { name: "Balance", group: "auto" }, { name: "Size", group: "asset" }, { name: "Grade", group: "asset" },
  { name: "Remark IN", group: "in" }, { name: "Remark OUT", group: "out" }, { name: "WK OUT", group: "auto" },
  { name: "WK IN", group: "auto" }, { name: "WK OUT for Repair", group: "auto" }, { name: "WK IN for Repair", group: "auto" },
  { name: "New In Stock", group: "auto" }, { name: "Refurbished Instock", group: "auto" }, { name: "Borrow", group: "auto" },
  { name: "Return", group: "auto" }, { name: "Repair", group: "auto" }, { name: "Out to Rental WH", group: "auto" }, { name: "In to Rental WH", group: "auto" },
  { name: "Discarded", group: "auto" }, { name: "Adjust Error", group: "auto" },
];

// ✅ Map ชื่อคอลัมน์ทั้งหมด -> field name ใน API (สำหรับการแสดงผล)
const COLUMN_FIELD_MAP: Record<string, string> = {
  "Barcode": "barcode",
  "Asset Name": "assetName",
  "Warehouse": "warehouseIn",
  "Asset Status": "assetStatus",
  "In stock Date": "inStockDate",
  "Start Warranty": "startWarranty",
  "End Warranty": "endWarranty",
  "Cheil PO": "cheilPO",
  "Unit In": "unitIn",
  "From Vendor": "fromVendor",
  "MCS Code (In)": "mcsCodeIn",
  "From Shop": "fromShop",
  "Out Date": "outDate",
  "Unit Out": "unitOut",
  "To Vendor": "toVendor",
  "Status": "status",
  "Shop Type": "shopType",
  "MCS Code (Out)": "mcsCodeOut",
  "To Shop": "toShop",
  "Balance": "balance",
  "Size": "size",
  "Grade": "grade",
  "Remark IN": "remarkIn",
  "Remark OUT": "remarkOut",
  "WK OUT": "wkOut",
  "WK IN": "wkIn",
  "WK OUT for Repair": "wkOutForRepair",
  "WK IN for Repair": "wkInForRepair",
  "New In Stock": "newInStock",
  "Refurbished Instock": "refurbishedInStock",
  "Borrow": "borrow",
  "Return": "return",
  "Repair": "repair",
  "Out to Rental WH": "outToRentalWarehouse",
  "In to Rental WH": "inToRentalWarehouse",
  "Discarded": "discarded",
  "Adjust Error": "adjustError",
};

// ✅ คอลัมน์ที่สามารถแก้ไขได้ (map ชื่อคอลัมน์ -> field name)
const EDITABLE_COLUMNS: Record<string, string> = {
  "Asset Name": "assetName",
  "Size": "size",
  "Grade": "grade",
  "Start Warranty": "startWarranty",
  "End Warranty": "endWarranty",
  "Cheil PO": "cheilPO",
  "From Vendor": "fromVendor",
  "MCS Code (In)": "mcsCodeIn",
  "From Shop": "fromShop",
  "Remark IN": "remarkIn",
  "To Vendor": "toVendor",
  "Status": "status",
  "Shop Type": "shopType",
  "MCS Code (Out)": "mcsCodeOut",
  "To Shop": "toShop",
  "Remark OUT": "remarkOut",
  "WK OUT": "wkOut",
  "WK IN": "wkIn",
  "WK OUT for Repair": "wkOutForRepair",
  "WK IN for Repair": "wkInForRepair",
};

export default function AdminDatabase() {
  const [data, setData] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ currentPage: 1, totalPages: 1, totalCount: 0, limit: 50 });
  const [filters, setFilters] = useState({ barcode: "", assetName: "", mcsCode: "", shopName: "", noMcs: false });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  // ✅ Edit Mode States
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState<TransactionData[]>([]);
  const [saving, setSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // ✅ Export State
  const [exporting, setExporting] = useState(false);

  // ✅ Import State
  const [uploading, setUploading] = useState(false);

  // ✅ Import Function
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("excel", file);
      const res = await fetch("/api/database/import", { method: "POST", body: formData });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "นำเข้าสำเร็จ!");
        fetchData(1);
      } else {
        // แสดง errors รายละเอียด
        if (json.errors && json.errors.length > 0) {
          console.error("Import errors:", json.errors);
          const errorList = json.errors.slice(0, 5).join("\n");
          toast.error(`${json.message}\n\n${errorList}${json.errors.length > 5 ? `\n...และอีก ${json.errors.length - 5} รายการ` : ""}`, { duration: 10000 });
        } else {
          toast.error(json.message || "เกิดข้อผิดพลาด");
        }
      }
    } catch (err) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // ✅ Download Template Function
  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch("/api/database/template");
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Template_Import_Database.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("ดาวน์โหลด Template สำเร็จ");
    } catch (err) {
      toast.error("ไม่สามารถดาวน์โหลด Template ได้");
    }
  };

  // ✅ Export Function
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/database/export");
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Asset_Database_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export error:", error);
      alert("เกิดข้อผิดพลาดในการ Export");
    } finally {
      setExporting(false);
    }
  };

  const fetchData = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "50" });
      if (appliedFilters.barcode) params.append("barcode", appliedFilters.barcode);
      if (appliedFilters.assetName) params.append("assetName", appliedFilters.assetName);
      if (appliedFilters.mcsCode) params.append("mcsCode", appliedFilters.mcsCode);
      if (appliedFilters.shopName) params.append("shopName", appliedFilters.shopName);
      if (appliedFilters.noMcs) params.append("noMcs", "true");
      const res = await fetch(`/api/database?${params}`);
      const result = await res.json();
      if (result.success) { setData(result.data); setPagination(result.pagination); }
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  }, [appliedFilters]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleSearch = () => { setAppliedFilters(filters); setPagination((prev) => ({ ...prev, currentPage: 1 })); setShowFilters(false); setIsEditMode(false); };
  const handlePageChange = (newPage: number) => { if (newPage >= 1 && newPage <= pagination.totalPages) fetchData(newPage); };

  const getHeaderColor = (group: string) => columnGroups[group as keyof typeof columnGroups]?.headerColor || "bg-gray-100";
  const getCellColor = (group: string) => columnGroups[group as keyof typeof columnGroups]?.color || "";

  // ✅ เช็คว่าคอลัมน์นี้แก้ไขได้ไหม
  const isEditableColumn = (columnName: string) => columnName in EDITABLE_COLUMNS;

  // ✅ เข้า Edit Mode
  const handleEnterEditMode = () => {
    // ต้องมี filter อย่างน้อย 1 อย่าง
    if (!appliedFilters.barcode && !appliedFilters.assetName && !appliedFilters.mcsCode && !appliedFilters.shopName && !appliedFilters.noMcs) {
      alert("กรุณากรอก Filter อย่างน้อย 1 ช่อง ก่อนเข้าโหมดแก้ไข");
      return;
    }
    setEditedData(JSON.parse(JSON.stringify(data))); // Deep copy
    setIsEditMode(true);
  };

  // ✅ ยกเลิก Edit Mode
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedData([]);
  };

  // ✅ อัปเดตค่าใน editedData
  const handleCellChange = (rowIndex: number, fieldName: string, value: string) => {
    setEditedData((prev) => {
      const newData = [...prev];
      (newData[rowIndex] as any)[fieldName] = value;
      return newData;
    });
  };

  // ✅ บันทึกข้อมูล
  const handleSave = async () => {
    setSaving(true);
    try {
      // หา rows ที่มีการเปลี่ยนแปลง
      const updates = editedData
        .map((edited, index) => {
          const original = data[index];
          const changes: Record<string, any> = { id: edited.id };
          let hasChanges = false;

          for (const [colName, fieldName] of Object.entries(EDITABLE_COLUMNS)) {
            const originalValue = (original as any)[fieldName];
            const editedValue = (edited as any)[fieldName];
            if (originalValue !== editedValue) {
              changes[fieldName] = editedValue;
              hasChanges = true;
            }
          }

          return hasChanges ? changes : null;
        })
        .filter(Boolean);

      if (updates.length === 0) {
        alert("ไม่มีข้อมูลที่เปลี่ยนแปลง");
        setShowConfirmDialog(false);
        setSaving(false);
        return;
      }

      const res = await fetch("/api/database/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      const result = await res.json();

      if (result.success) {
        alert(`บันทึกสำเร็จ! อัปเดต ${result.updatedCount} รายการ`);
        setIsEditMode(false);
        setEditedData([]);
        fetchData(pagination.currentPage); // Refresh data
      } else {
        alert(`เกิดข้อผิดพลาด: ${result.message}`);
      }
    } catch (error) {
      console.error("Error saving:", error);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
      setShowConfirmDialog(false);
    }
  };

  // ✅ Render cell value (ปกติ หรือ Input ถ้าอยู่ใน Edit Mode)
  const renderCellValue = (item: TransactionData, columnName: string, rowIndex: number) => {
    const fieldName = EDITABLE_COLUMNS[columnName] ?? COLUMN_FIELD_MAP[columnName];
    const isEditable = isEditableColumn(columnName);
    const currentData = isEditMode ? editedData[rowIndex] : item;
    const value = (currentData as any)[fieldName] ?? "-";

    // ✅ ถ้าอยู่ใน Edit Mode และคอลัมน์แก้ไขได้
    if (isEditMode && isEditable) {
      const displayValue = value === "-" ? "" : value;
      return (
        <input
          type="text"
          value={displayValue}
          onChange={(e) => handleCellChange(rowIndex, fieldName, e.target.value)}
          className="w-full px-1 py-0.5 text-xs border border-red-300 rounded bg-white text-red-600 focus:outline-none focus:ring-1 focus:ring-red-400"
          style={{ minWidth: "60px" }}
        />
      );
    }

    // ✅ ถ้าอยู่ใน Edit Mode แต่คอลัมน์แก้ไขไม่ได้ (สีปกติ)
    if (isEditMode && !isEditable) {
      const map: Record<string, any> = {
        "Barcode": <span className="font-mono text-xs">{item.barcode}</span>,
        "Warehouse": item.warehouseIn,
        "Asset Status": item.assetStatus,
        "In stock Date": item.inStockDate,
        "Unit In": item.unitIn,
        "Out Date": item.outDate,
        "Unit Out": item.unitOut,
        "Balance": item.balance,
        "WK OUT": item.wkOut,
        "WK IN": item.wkIn,
        "WK OUT for Repair": item.wkOutForRepair,
        "WK IN for Repair": item.wkInForRepair,
        "New In Stock": item.newInStock,
        "Refurbished Instock": item.refurbishedInStock,
        "Borrow": item.borrow,
        "Return": item.return,
        "Repair": item.repair,
        "Out to Rental WH": item.outToRentalWarehouse,
        "In to Rental WH": item.inToRentalWarehouse,
        "Discarded": item.discarded,
        "Adjust Error": item.adjustError,
      };
      return map[columnName] ?? "-";
    }

    // ✅ โหมดปกติ (ไม่ใช่ Edit Mode)
    const map: Record<string, any> = {
      "Barcode": <span className="font-mono text-xs">{item.barcode}</span>, "Asset Name": item.assetName, "Size": item.size, "Grade": item.grade,
      "Start Warranty": item.startWarranty, "End Warranty": item.endWarranty, "Cheil PO": item.cheilPO, "Warehouse": item.warehouseIn,
      "In stock Date": item.inStockDate, "Unit In": item.unitIn, "From Vendor": item.fromVendor, "MCS Code (In)": item.mcsCodeIn, "From Shop": item.fromShop,
      "Remark IN": <span className="max-w-[100px] truncate block" title={item.remarkIn}>{item.remarkIn}</span>,
      "Out Date": item.outDate, "Unit Out": item.unitOut, "To Vendor": item.toVendor, "Status": item.status, "Shop Type": item.shopType, "MCS Code (Out)": item.mcsCodeOut, "To Shop": item.toShop,
      "Remark OUT": <span className="max-w-[100px] truncate block" title={item.remarkOut}>{item.remarkOut}</span>,
      "Asset Status": item.assetStatus, "Balance": item.balance, "WK OUT": item.wkOut, "WK IN": item.wkIn, "WK OUT for Repair": item.wkOutForRepair,
      "WK IN for Repair": item.wkInForRepair, "New In Stock": item.newInStock, "Refurbished Instock": item.refurbishedInStock,
      "Borrow": item.borrow, "Return": item.return, "Repair": item.repair, "Out to Rental WH": item.outToRentalWarehouse, "In to Rental WH": item.inToRentalWarehouse,
      "Discarded": item.discarded, "Adjust Error": item.adjustError,
    };
    return map[columnName] ?? "-";
  };

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-container cyan !w-10 !h-10"><Database className="w-5 h-5" /></div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Asset Database</h1>
          </div>
          <p className="text-sm text-muted-foreground">ประวัติการเคลื่อนไหว Asset ทั้งหมด</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className="sm:hidden glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2">
            <Filter className="w-4 h-4" />กรอง
          </button>
          {!isEditMode ? (
            <>
              <button onClick={() => fetchData(pagination.currentPage)} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /><span className="hidden sm:inline">Refresh</span>
              </button>
              <label className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2 cursor-pointer text-blue-600 border-blue-300 hover:bg-blue-50">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="hidden sm:inline">Import</span>
                <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" disabled={uploading} />
              </label>
              <button
                onClick={handleDownloadTemplate}
                title="ดาวน์โหลด Template Import"
                className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2 text-indigo-600 border-indigo-300 hover:bg-indigo-50"
              >
                <FileDown className="w-4 h-4" />
                <span className="hidden sm:inline">Template</span>
              </button>
              <button onClick={handleExport} disabled={exporting} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2 text-green-600 border-green-300 hover:bg-green-50">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="hidden sm:inline">Export</span>
              </button>
              <button onClick={handleEnterEditMode} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2 text-amber-600 border-amber-300 hover:bg-amber-50">
                <Pencil className="w-4 h-4" /><span className="hidden sm:inline">Edit</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={handleCancelEdit} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2 text-gray-600">
                <X className="w-4 h-4" />ยกเลิก
              </button>
              <button onClick={() => setShowConfirmDialog(true)} disabled={saving} className="gradient-button px-4 py-2.5 text-sm font-medium flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกข้อมูล
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters - Desktop */}
      <div className="glass-card p-4 sm:p-5 hidden sm:block">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <Input placeholder="Barcode" value={filters.barcode} onChange={(e) => setFilters({ ...filters, barcode: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="glass-input" disabled={isEditMode} />
          <Input placeholder="Asset Name" value={filters.assetName} onChange={(e) => setFilters({ ...filters, assetName: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="glass-input" disabled={isEditMode} />
          <Input placeholder="MCS Code" value={filters.mcsCode} onChange={(e) => setFilters({ ...filters, mcsCode: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="glass-input" disabled={isEditMode} />
          <Input placeholder="Shop Name" value={filters.shopName} onChange={(e) => setFilters({ ...filters, shopName: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="glass-input" disabled={isEditMode} />
          <button onClick={handleSearch} disabled={isEditMode} className="gradient-button py-2 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"><Search className="w-4 h-4" />ค้นหา</button>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="noMcs" checked={filters.noMcs} onCheckedChange={(checked) => setFilters({ ...filters, noMcs: !!checked })} disabled={isEditMode} />
          <label htmlFor="noMcs" className="text-sm text-muted-foreground cursor-pointer">แสดงเฉพาะที่ไม่มี MCS Code</label>
        </div>
      </div>

      {/* Filters - Mobile */}
      {showFilters && !isEditMode && (
        <div className="glass-card p-4 sm:hidden space-y-3">
          <Input placeholder="Barcode" value={filters.barcode} onChange={(e) => setFilters({ ...filters, barcode: e.target.value })} className="glass-input" />
          <Input placeholder="Asset Name" value={filters.assetName} onChange={(e) => setFilters({ ...filters, assetName: e.target.value })} className="glass-input" />
          <div className="flex items-center gap-2">
            <Checkbox id="noMcsMobile" checked={filters.noMcs} onCheckedChange={(checked) => setFilters({ ...filters, noMcs: !!checked })} />
            <label htmlFor="noMcsMobile" className="text-sm">ไม่มี MCS Code</label>
          </div>
          <button onClick={handleSearch} className="w-full gradient-button py-2.5 text-sm font-medium">ค้นหา</button>
        </div>
      )}

      {/* Legend + Edit Mode Indicator */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-800">🟨 Asset</span>
        <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-800">🟦 IN</span>
        <span className="px-2 py-1 rounded-md bg-rose-100 text-rose-800">🟥 OUT</span>
        <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800">🟩 Auto Logic</span>
        {isEditMode && (
          <span className="px-2 py-1 rounded-md bg-red-100 text-red-600 font-medium">✏️ โหมดแก้ไข (ตัวอักษรสีแดง = แก้ไขได้)</span>
        )}
        <span className="ml-auto text-muted-foreground">รวม {pagination.totalCount.toLocaleString()} รายการ</span>
      </div>

      {/* Scroll Hint - Mobile Only */}
      <div className="sm:hidden flex items-center justify-center gap-2 text-xs text-muted-foreground bg-blue-50 py-2 rounded-lg">
        <span>←</span>
        <span>เลื่อนตารางเพื่อดูข้อมูลเพิ่มเติม</span>
        <span>→</span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Database className="w-12 h-12 mx-auto mb-3 opacity-30" />ไม่พบข้อมูล</div>
        ) : (
          <>
            {/* ✅ Mobile-friendly: scroll แนวนอนได้ พร้อม scrollbar ที่มองเห็นได้ */}
            <div 
              className="overflow-auto max-h-[60vh]"
              style={{
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <table className="text-xs border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {orderedColumns.map((col, i) => {
                      const isEditable = isEditableColumn(col.name);
                      return (
                        <th 
                          key={i} 
                          className={`px-2 py-2 text-left whitespace-nowrap font-semibold border-b border-black/10 ${getHeaderColor(col.group)} ${isEditMode && isEditable ? "text-red-600" : ""}`}
                        >
                          {col.name}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(isEditMode ? editedData : data).map((item, idx) => (
                    <tr key={idx} className="hover:bg-black/2 transition-colors">
                      {orderedColumns.map((col, i) => {
                        const isEditable = isEditableColumn(col.name);
                        return (
                          <td 
                            key={i} 
                            className={`px-2 py-1.5 whitespace-nowrap border-b border-black/5 ${getCellColor(col.group)} ${isEditMode && isEditable && !isEditMode ? "text-red-600" : ""}`}
                          >
                            {renderCellValue(data[idx], col.name, idx)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center p-4 border-t border-black/5 bg-white/50">
              <span className="text-sm text-muted-foreground">รวม {pagination.totalCount.toLocaleString()} รายการ</span>
              <SimplePagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} onPageChange={handlePageChange} disabled={isEditMode} />
            </div>
          </>
        )}
      </div>

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">ยืนยันการบันทึก</h3>
            <p className="text-sm text-muted-foreground mb-4">
              คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลใช่หรือไม่?
            </p>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowConfirmDialog(false)} 
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}