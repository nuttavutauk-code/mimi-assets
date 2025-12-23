"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, ChevronLeft, ChevronRight, RefreshCw, Shield, Filter } from "lucide-react";

interface SecuritySetData {
  id: number; docCode: string; barcode: string; assetName: string; startWarranty: string; endWarranty: string;
  cheilPO: string; size: string; grade: string; warehouseIn: string; inStockDate: string; unitIn: number | string;
  fromVendor: string; mcsCodeIn: string; fromShop: string; remarkIn: string; outDate: string; unitOut: number | string;
  toVendor: string; status: string; mcsCodeOut: string; toShop: string; remarkOut: string; assetStatus: string;
  balance: number; transactionCategory: string; wkOut: string; wkIn: string; wkOutForRepair: string; wkInForRepair: string;
  newInStock: string; refurbishedInStock: string; borrow: string; return: string; repair: string; outToRentalWarehouse: string;
  inToRentalWarehouse: string; discarded: string; adjustError: string;
}

interface Pagination { currentPage: number; totalPages: number; totalCount: number; limit: number; }

const columnGroups = {
  doc: { color: "bg-orange-50", headerColor: "bg-orange-100 text-orange-800", columns: ["เลขที่เอกสาร"] },
  asset: { color: "bg-amber-50", headerColor: "bg-amber-100 text-amber-800", columns: ["Barcode", "Asset Name", "Start Warranty", "End Warranty", "Cheil PO", "Size", "Grade"] },
  in: { color: "bg-blue-50", headerColor: "bg-blue-100 text-blue-800", columns: ["Warehouse", "In stock Date", "Unit In", "From Vendor", "MCS Code (In)", "From Shop", "Remark IN"] },
  out: { color: "bg-rose-50", headerColor: "bg-rose-100 text-rose-800", columns: ["Out Date", "Unit Out", "To Vendor", "Status", "MCS Code (Out)", "To Shop", "Remark OUT"] },
  auto: { color: "bg-emerald-50", headerColor: "bg-emerald-100 text-emerald-800", columns: ["Asset Status", "Balance", "Transaction Category", "WK OUT", "WK IN", "WK OUT for Repair", "WK IN for Repair", "New In Stock", "Refurbished Instock", "Borrow", "Return", "Repair", "Out to Rental WH", "In to Rental WH", "Discarded", "Adjust Error"] }
};

const orderedColumns = [
  { name: "เลขที่เอกสาร", group: "doc" }, { name: "Barcode", group: "asset" }, { name: "Asset Name", group: "asset" },
  { name: "Warehouse", group: "in" }, { name: "Asset Status", group: "auto" }, { name: "In stock Date", group: "in" },
  { name: "Start Warranty", group: "asset" }, { name: "End Warranty", group: "asset" }, { name: "Cheil PO", group: "asset" },
  { name: "Unit In", group: "in" }, { name: "From Vendor", group: "in" }, { name: "MCS Code (In)", group: "in" },
  { name: "From Shop", group: "in" }, { name: "Out Date", group: "out" }, { name: "Unit Out", group: "out" },
  { name: "To Vendor", group: "out" }, { name: "Status", group: "out" }, { name: "MCS Code (Out)", group: "out" },
  { name: "To Shop", group: "out" }, { name: "Balance", group: "auto" }, { name: "Size", group: "asset" },
  { name: "Grade", group: "asset" }, { name: "Remark IN", group: "in" }, { name: "Remark OUT", group: "out" },
  { name: "Transaction Category", group: "auto" }, { name: "WK OUT", group: "auto" }, { name: "WK IN", group: "auto" },
  { name: "WK OUT for Repair", group: "auto" }, { name: "WK IN for Repair", group: "auto" }, { name: "New In Stock", group: "auto" },
  { name: "Refurbished Instock", group: "auto" }, { name: "Borrow", group: "auto" }, { name: "Return", group: "auto" },
  { name: "Repair", group: "auto" }, { name: "Out to Rental WH", group: "auto" }, { name: "In to Rental WH", group: "auto" }, { name: "Discarded", group: "auto" },
  { name: "Adjust Error", group: "auto" },
];

export default function AdminDatabaseSecuritySet() {
  const [data, setData] = useState<SecuritySetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ currentPage: 1, totalPages: 1, totalCount: 0, limit: 50 });
  const [filters, setFilters] = useState({ docCode: "", barcode: "", assetName: "", mcsCode: "", shopName: "", noMcs: false });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const fetchData = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "50" });
      if (appliedFilters.docCode) params.append("docCode", appliedFilters.docCode);
      if (appliedFilters.barcode) params.append("barcode", appliedFilters.barcode);
      if (appliedFilters.assetName) params.append("assetName", appliedFilters.assetName);
      if (appliedFilters.mcsCode) params.append("mcsCode", appliedFilters.mcsCode);
      if (appliedFilters.shopName) params.append("shopName", appliedFilters.shopName);
      if (appliedFilters.noMcs) params.append("noMcs", "true");
      const res = await fetch(`/api/database-security-set?${params}`);
      const result = await res.json();
      if (result.success) { setData(result.data); setPagination(result.pagination); }
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  }, [appliedFilters]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleSearch = () => { setAppliedFilters(filters); setPagination((prev) => ({ ...prev, currentPage: 1 })); setShowFilters(false); };
  const handlePageChange = (newPage: number) => { if (newPage >= 1 && newPage <= pagination.totalPages) fetchData(newPage); };

  const getHeaderColor = (group: string) => columnGroups[group as keyof typeof columnGroups]?.headerColor || "bg-gray-100";
  const getCellColor = (group: string) => columnGroups[group as keyof typeof columnGroups]?.color || "";

  const renderCellValue = (item: SecuritySetData, columnName: string) => {
    const map: Record<string, any> = {
      "เลขที่เอกสาร": <span className="font-medium text-primary">{item.docCode}</span>,
      "Barcode": <span className="font-mono text-xs">{item.barcode}</span>, "Asset Name": item.assetName, "Size": item.size, "Grade": item.grade,
      "Start Warranty": item.startWarranty, "End Warranty": item.endWarranty, "Cheil PO": item.cheilPO, "Warehouse": item.warehouseIn,
      "In stock Date": item.inStockDate, "Unit In": item.unitIn, "From Vendor": item.fromVendor, "MCS Code (In)": item.mcsCodeIn, "From Shop": item.fromShop,
      "Remark IN": <span className="max-w-[100px] truncate block" title={item.remarkIn}>{item.remarkIn}</span>,
      "Out Date": item.outDate, "Unit Out": item.unitOut, "To Vendor": item.toVendor, "Status": item.status, "MCS Code (Out)": item.mcsCodeOut, "To Shop": item.toShop,
      "Remark OUT": <span className="max-w-[100px] truncate block" title={item.remarkOut}>{item.remarkOut}</span>,
      "Asset Status": item.assetStatus, "Balance": item.balance, "Transaction Category": item.transactionCategory,
      "WK OUT": item.wkOut, "WK IN": item.wkIn, "WK OUT for Repair": item.wkOutForRepair, "WK IN for Repair": item.wkInForRepair,
      "New In Stock": item.newInStock, "Refurbished Instock": item.refurbishedInStock, "Borrow": item.borrow, "Return": item.return,
      "Repair": item.repair, "Out to Rental WH": item.outToRentalWarehouse, "In to Rental WH": item.inToRentalWarehouse, "Discarded": item.discarded, "Adjust Error": item.adjustError,
    };
    return map[columnName] ?? "-";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-container purple !w-10 !h-10"><Shield className="w-5 h-5" /></div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Security Set Database</h1>
          </div>
          <p className="text-sm text-muted-foreground">ประวัติการเคลื่อนไหว Security Set</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className="sm:hidden glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2">
            <Filter className="w-4 h-4" />กรอง
          </button>
          <button onClick={() => fetchData(pagination.currentPage)} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />รีเฟรช
          </button>
        </div>
      </div>

      {/* Filters - Desktop */}
      <div className="glass-card p-4 sm:p-5 hidden sm:block">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          <Input placeholder="เลขที่เอกสาร" value={filters.docCode} onChange={(e) => setFilters({ ...filters, docCode: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="glass-input" />
          <Input placeholder="Barcode" value={filters.barcode} onChange={(e) => setFilters({ ...filters, barcode: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="glass-input" />
          <Input placeholder="Asset Name" value={filters.assetName} onChange={(e) => setFilters({ ...filters, assetName: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="glass-input" />
          <Input placeholder="MCS Code" value={filters.mcsCode} onChange={(e) => setFilters({ ...filters, mcsCode: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="glass-input" />
          <Input placeholder="Shop Name" value={filters.shopName} onChange={(e) => setFilters({ ...filters, shopName: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="glass-input" />
          <button onClick={handleSearch} className="gradient-button py-2 flex items-center justify-center gap-2 text-sm font-medium"><Search className="w-4 h-4" />ค้นหา</button>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="noMcs" checked={filters.noMcs} onCheckedChange={(checked) => setFilters({ ...filters, noMcs: !!checked })} />
          <label htmlFor="noMcs" className="text-sm text-muted-foreground cursor-pointer">แสดงเฉพาะที่ไม่มี MCS Code</label>
        </div>
      </div>

      {/* Filters - Mobile */}
      {showFilters && (
        <div className="glass-card p-4 sm:hidden space-y-3">
          <Input placeholder="เลขที่เอกสาร" value={filters.docCode} onChange={(e) => setFilters({ ...filters, docCode: e.target.value })} className="glass-input" />
          <Input placeholder="Barcode" value={filters.barcode} onChange={(e) => setFilters({ ...filters, barcode: e.target.value })} className="glass-input" />
          <div className="flex items-center gap-2">
            <Checkbox id="noMcsMobile" checked={filters.noMcs} onCheckedChange={(checked) => setFilters({ ...filters, noMcs: !!checked })} />
            <label htmlFor="noMcsMobile" className="text-sm">ไม่มี MCS Code</label>
          </div>
          <button onClick={handleSearch} className="w-full gradient-button py-2.5 text-sm font-medium">ค้นหา</button>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded-md bg-orange-100 text-orange-800">🟧 Doc</span>
        <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-800">🟨 Asset</span>
        <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-800">🟦 IN</span>
        <span className="px-2 py-1 rounded-md bg-rose-100 text-rose-800">🟥 OUT</span>
        <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800">🟩 Auto</span>
        <span className="ml-auto text-muted-foreground">รวม {pagination.totalCount.toLocaleString()} รายการ</span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />ไม่พบข้อมูล</div>
        ) : (
          <>
            <div className="overflow-x-auto overflow-y-auto max-h-[60vh]" style={{ maxWidth: 'calc(100vw - 260px - 48px)' }}>
              <table className="w-full text-xs border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {orderedColumns.map((col, i) => (
                      <th key={i} className={`px-2 py-2 text-left whitespace-nowrap font-semibold border-b border-black/10 ${getHeaderColor(col.group)}`}>
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, idx) => (
                    <tr key={idx} className="hover:bg-black/2 transition-colors">
                      {orderedColumns.map((col, i) => (
                        <td key={i} className={`px-2 py-1.5 whitespace-nowrap border-b border-black/5 ${getCellColor(col.group)}`}>
                          {renderCellValue(item, col.name)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center p-4 border-t border-black/5 bg-white/50">
              <span className="text-sm text-muted-foreground">หน้า {pagination.currentPage}/{pagination.totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={pagination.currentPage === 1} className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-3 text-sm font-medium">{pagination.currentPage}</span>
                <button onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages} className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}