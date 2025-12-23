"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Store, Upload, Search, Loader2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";

export default function AdminShopManage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchShops = async (searchValue = "", pageNum = 1) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/shop?search=${searchValue}&page=${pageNum}&limit=10`);
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

  useEffect(() => { fetchShops(search, page); }, [page]);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("excel", file);
      const res = await fetch("/api/shop/import", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || "นำเข้าสำเร็จ!");
        fetchShops();
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

  const handleExportExcel = async () => {
    try {
      const res = await fetch("/api/shop/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Shop_List.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("ไม่สามารถดาวน์โหลดไฟล์ได้");
    }
  };

  const handleToggleStatus = async (mcsCode: string) => {
    setTogglingId(mcsCode);
    try {
      const res = await fetch("/api/shop/toggle-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mcsCode }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message);
        setData((prev) => prev.map((shop) => shop.mcsCode === mcsCode ? { ...shop, status: json.shop.status } : shop));
      } else {
        toast.error(json.error || "เปลี่ยนสถานะไม่สำเร็จ");
      }
    } catch (err) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setTogglingId(null);
    }
  };

  const handleSearch = () => { setPage(1); fetchShops(search, 1); };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-container green !w-10 !h-10"><Store className="w-5 h-5" /></div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Shop Management</h1>
          </div>
          <p className="text-sm text-muted-foreground">จัดการข้อมูลร้านค้าในระบบ</p>
        </div>
        <div className="flex gap-2">
          <label className="gradient-button px-5 py-2.5 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            UPDATE SHOP
            <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" disabled={uploading} />
          </label>
          <button onClick={handleExportExcel} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2">
            <Download className="w-4 h-4" />Export Excel
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="ค้นหา MCS Code, Shop Name..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="pl-10 glass-input" />
          </div>
          <button onClick={handleSearch} className="gradient-button px-6 py-2.5 text-sm font-medium flex items-center justify-center gap-2">
            <Search className="w-4 h-4" />ค้นหา
          </button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="glass-card overflow-hidden hidden sm:block">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Store className="w-12 h-12 mx-auto mb-3 opacity-30" />ไม่พบร้านค้า</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="glass-table w-full">
                <thead>
                  <tr className="bg-black/2">
                    <th>MCS CODE</th>
                    <th>SHOP NAME</th>
                    <th>REGION</th>
                    <th>STATE</th>
                    <th>SHOP TYPE</th>
                    <th>STATUS</th>
                    <th className="text-center">Toggle</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((shop, idx) => {
                    const isOpen = shop.status?.toUpperCase() === "OPEN";
                    const isToggling = togglingId === shop.mcsCode;
                    return (
                      <tr key={idx}>
                        <td className="font-medium text-primary">{shop.mcsCode}</td>
                        <td>{shop.shopName}</td>
                        <td>{shop.region || "-"}</td>
                        <td>{shop.state || "-"}</td>
                        <td><span className="px-2 py-1 rounded-md bg-purple-50 text-purple-600 text-xs font-medium">{shop.shopType || "-"}</span></td>
                        <td>
                          <span className={`status-badge ${isOpen ? "approved" : "rejected"}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />{shop.status || "-"}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleToggleStatus(shop.mcsCode)}
                              disabled={isToggling}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isOpen ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
                            >
                              {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : isOpen ? "ปิดร้าน" : "เปิดร้าน"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex justify-between items-center p-4 border-t border-black/5">
              <span className="text-sm text-muted-foreground">Showing page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-black/10 text-sm hover:bg-black/5 disabled:opacity-50">
                  ก่อนหน้า
                </button>
                <select
                  className="border border-black/10 rounded-lg text-sm px-2 py-1.5 bg-white"
                  value={page}
                  onChange={(e) => setPage(Number(e.target.value))}
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg border border-black/10 text-sm hover:bg-black/5 disabled:opacity-50">
                  ถัดไป
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="glass-card p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : data.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">ไม่พบร้านค้า</div>
        ) : (
          <>
            {data.map((shop, idx) => {
              const isOpen = shop.status?.toUpperCase() === "OPEN";
              const isToggling = togglingId === shop.mcsCode;
              return (
                <div key={idx} className="glass-card p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{shop.shopName}</p>
                      <p className="text-xs text-primary mt-0.5">{shop.mcsCode}</p>
                    </div>
                    <span className={`status-badge ${isOpen ? "approved" : "rejected"}`}>{shop.status || "-"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span>Region: {shop.region || "-"}</span>
                    <span>State: {shop.state || "-"}</span>
                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-600">{shop.shopType || "-"}</span>
                  </div>
                  <button
                    onClick={() => handleToggleStatus(shop.mcsCode)}
                    disabled={isToggling}
                    className={`w-full py-2.5 rounded-lg text-sm font-medium ${isOpen ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}
                  >
                    {isToggling ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isOpen ? "ปิดร้าน" : "เปิดร้าน"}
                  </button>
                </div>
              );
            })}
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