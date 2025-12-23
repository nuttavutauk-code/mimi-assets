"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Package, Upload, Search, Loader2, ChevronLeft, ChevronRight, Download, Warehouse, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function AdminAssetManage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchAssets = async (searchValue = "", pageNum = 1) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/asset?search=${searchValue}&page=${pageNum}&limit=10`);
      const json = await res.json();
      if (res.ok) {
        setData(json.data);
        setTotalPages(json.totalPages);
      } else {
        toast.error(json.error || "โหลดข้อมูลไม่สำเร็จ");
      }
    } catch (err) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssets(search, page); }, [page]);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("excel", file);
      const res = await fetch("/api/asset/import", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || "นำเข้าสำเร็จ!");
        fetchAssets();
      } else {
        toast.error(json.error || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch("/api/asset/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Asset_List.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("ดาวน์โหลดสำเร็จ");
    } catch (err) {
      toast.error("ไม่สามารถดาวน์โหลดได้");
    }
  };

  const handleSearch = () => { setPage(1); fetchAssets(search, 1); };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-container orange !w-10 !h-10"><Package className="w-5 h-5" /></div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Asset Management</h1>
          </div>
          <p className="text-sm text-muted-foreground">จัดการข้อมูล Asset ในระบบ</p>
        </div>
        <div className="flex gap-2">
          <label className="gradient-button px-4 py-2.5 text-sm font-medium flex items-center gap-2 cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="hidden sm:inline">Import</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" disabled={uploading} />
          </label>
          <button onClick={handleExport} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="ค้นหา Barcode, Asset Name..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="pl-10 glass-input" />
          </div>
          <button onClick={handleSearch} className="gradient-button px-6 py-2.5 text-sm font-medium flex items-center justify-center gap-2"><Search className="w-4 h-4" />ค้นหา</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden hidden sm:block">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Package className="w-12 h-12 mx-auto mb-3 opacity-30" />ไม่พบ Asset</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="glass-table w-full">
                <thead><tr className="bg-black/2"><th>Barcode</th><th>Asset Name</th><th>Size</th><th>Warehouse</th><th>Start Warranty</th><th>End Warranty</th><th>Cheil PO</th></tr></thead>
                <tbody>
                  {data.map((item, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-sm">{item.barcode}</td>
                      <td className="font-medium">{item.assetName}</td>
                      <td><span className="px-2 py-1 rounded-md bg-orange-50 text-orange-600 text-xs font-medium">{item.size || "-"}</span></td>
                      <td><div className="flex items-center gap-1"><Warehouse className="w-3.5 h-3.5 text-muted-foreground" />{item.warehouse || "-"}</div></td>
                      <td><div className="flex items-center gap-1 text-muted-foreground"><Calendar className="w-3.5 h-3.5" />{item.startWarranty || "-"}</div></td>
                      <td><div className="flex items-center gap-1 text-muted-foreground"><Calendar className="w-3.5 h-3.5" />{item.endWarranty || "-"}</div></td>
                      <td>{item.cheilPO || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center p-4 border-t border-black/5">
              <span className="text-sm text-muted-foreground">หน้า {page}/{totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-3 text-sm font-medium">{page}</span>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="glass-card p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : data.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">ไม่พบ Asset</div>
        ) : (
          <>
            {data.map((item, idx) => (
              <div key={idx} className="glass-card p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-foreground">{item.assetName}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{item.barcode}</p>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-orange-50 text-orange-600 text-xs font-medium">{item.size || "-"}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Warehouse className="w-3 h-3" />{item.warehouse || "-"}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.endWarranty || "-"}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-center items-center gap-4 py-4">
              <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-4 py-2 rounded-lg bg-black/5 text-sm disabled:opacity-50">ก่อนหน้า</button>
              <span className="text-sm font-medium">{page}/{totalPages}</span>
              <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-lg bg-black/5 text-sm disabled:opacity-50">ถัดไป</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
