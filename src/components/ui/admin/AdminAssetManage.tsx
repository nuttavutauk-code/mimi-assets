"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { SimplePagination } from "@/components/ui/SimplePagination";
import { Package, Upload, Search, Loader2, Download, Warehouse, Calendar, Pencil, Check, X, PackagePlus } from "lucide-react";
import { toast } from "sonner";

type EditData = {
  barcode: string;
  assetName: string;
  size: string;
  warehouse: string;
  startWarranty: string;
  endWarranty: string;
  cheilPO: string;
};

export default function AdminAssetManage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingUsed, setUploadingUsed] = useState(false); // ✅ state สำหรับ Import Used
  const [uploadingRefurbished, setUploadingRefurbished] = useState(false); // ✅ state สำหรับ Import Refurbished
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<EditData>({ barcode: "", assetName: "", size: "", warehouse: "", startWarranty: "", endWarranty: "", cheilPO: "" });
  const [saving, setSaving] = useState(false);

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

  // ✅ Import Asset USED (ของเก่า)
  const handleImportUsed = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingUsed(true);
    try {
      const formData = new FormData();
      formData.append("excel", file);
      const res = await fetch("/api/asset/import-used", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || `นำเข้า Asset USED สำเร็จ ${json.imported || 0} รายการ!`);
        fetchAssets();
      } else {
        toast.error(json.error || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setUploadingUsed(false);
      e.target.value = "";
    }
  };

  // ✅ Import Asset REFURBISHED (ของซ่อมแล้ว)
  const handleImportRefurbished = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRefurbished(true);
    try {
      const formData = new FormData();
      formData.append("excel", file);
      const res = await fetch("/api/asset/import-refurbished", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || `นำเข้า Asset REFURBISHED สำเร็จ ${json.imported || 0} รายการ!`);
        fetchAssets();
      } else {
        toast.error(json.error || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setUploadingRefurbished(false);
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

  // ✅ Handle edit (เฉพาะ NO Barcode status)
  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditData({
      barcode: item.barcode || "",
      assetName: item.assetName || "",
      size: item.size || "",
      warehouse: item.warehouse || "",
      startWarranty: item.startWarranty || "",
      endWarranty: item.endWarranty || "",
      cheilPO: item.cheilPO || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({ barcode: "", assetName: "", size: "", warehouse: "", startWarranty: "", endWarranty: "", cheilPO: "" });
  };

  const handleSave = async (id: number) => {
    if (!editData.barcode.trim()) {
      toast.error("กรุณากรอก Barcode");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/asset/update-nobarcode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editData }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("อัปเดตข้อมูลสำเร็จ");
        setEditingId(null);
        setEditData({ barcode: "", assetName: "", size: "", warehouse: "", startWarranty: "", endWarranty: "", cheilPO: "" });
        fetchAssets(search, page);
      } else {
        toast.error(json.message || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Get status badge style
  const getStatusBadge = (status: string) => {
    if (status === "NO Barcode") {
      return "bg-orange-100 text-orange-700";
    }
    return "bg-green-100 text-green-700";
  };

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
        <div className="flex gap-2 flex-wrap">
          <label className="gradient-button px-4 py-2.5 text-sm font-medium flex items-center gap-2 cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="hidden sm:inline">Import</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" disabled={uploading} />
          </label>
          <label className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 cursor-pointer rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors">
            {uploadingUsed ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
            <span className="hidden sm:inline">Import USED</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleImportUsed} className="hidden" disabled={uploadingUsed} />
          </label>
          <label className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 cursor-pointer rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
            {uploadingRefurbished ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
            <span className="hidden sm:inline">Import REFURBISHED</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleImportRefurbished} className="hidden" disabled={uploadingRefurbished} />
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
                <thead><tr className="bg-black/2"><th>Barcode</th><th>Asset Name</th><th>Size</th><th>Warehouse</th><th>Start Warranty</th><th>End Warranty</th><th>Cheil PO</th><th>Status Asset</th><th></th></tr></thead>
                <tbody>
                  {data.map((item, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-sm">
                        {editingId === item.id ? (
                          <Input value={editData.barcode} onChange={(e) => setEditData({ ...editData, barcode: e.target.value })} className="glass-input h-8 text-sm w-32" />
                        ) : (
                          <span>{item.barcode}</span>
                        )}
                      </td>
                      <td className="font-medium">
                        {editingId === item.id ? (
                          <Input value={editData.assetName} onChange={(e) => setEditData({ ...editData, assetName: e.target.value })} className="glass-input h-8 text-sm w-32" />
                        ) : (
                          item.assetName
                        )}
                      </td>
                      <td>
                        {editingId === item.id ? (
                          <Input value={editData.size} onChange={(e) => setEditData({ ...editData, size: e.target.value })} className="glass-input h-8 text-sm w-20" />
                        ) : (
                          <span className="px-2 py-1 rounded-md bg-orange-50 text-orange-600 text-xs font-medium">{item.size || "-"}</span>
                        )}
                      </td>
                      <td>
                        {editingId === item.id ? (
                          <Input value={editData.warehouse} onChange={(e) => setEditData({ ...editData, warehouse: e.target.value })} className="glass-input h-8 text-sm w-24" />
                        ) : (
                          <div className="flex items-center gap-1"><Warehouse className="w-3.5 h-3.5 text-muted-foreground" />{item.warehouse || "-"}</div>
                        )}
                      </td>
                      <td>
                        {editingId === item.id ? (
                          <Input value={editData.startWarranty} onChange={(e) => setEditData({ ...editData, startWarranty: e.target.value })} className="glass-input h-8 text-sm w-24" />
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground"><Calendar className="w-3.5 h-3.5" />{item.startWarranty || "-"}</div>
                        )}
                      </td>
                      <td>
                        {editingId === item.id ? (
                          <Input value={editData.endWarranty} onChange={(e) => setEditData({ ...editData, endWarranty: e.target.value })} className="glass-input h-8 text-sm w-24" />
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground"><Calendar className="w-3.5 h-3.5" />{item.endWarranty || "-"}</div>
                        )}
                      </td>
                      <td>
                        {editingId === item.id ? (
                          <Input value={editData.cheilPO} onChange={(e) => setEditData({ ...editData, cheilPO: e.target.value })} className="glass-input h-8 text-sm w-24" />
                        ) : (
                          item.cheilPO || "-"
                        )}
                      </td>
                      <td><span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusBadge(item.statusAsset || "Ready")}`}>{item.statusAsset || "Ready"}</span></td>
                      <td>
                        {item.statusAsset === "NO Barcode" && (
                          editingId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleSave(item.id)} disabled={saving} className="p-1.5 rounded bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                              <button onClick={handleCancelEdit} disabled={saving} className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <button onClick={() => handleStartEdit(item)} className="p-1.5 rounded hover:bg-black/5"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center p-4 border-t border-black/5">
              <span className="text-sm text-muted-foreground">หน้า {page}/{totalPages}</span>
              <SimplePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
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
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-1 rounded-md bg-orange-50 text-orange-600 text-xs font-medium">{item.size || "-"}</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${getStatusBadge(item.statusAsset || "Ready")}`}>{item.statusAsset || "Ready"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Warehouse className="w-3 h-3" />{item.warehouse || "-"}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.endWarranty || "-"}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-center items-center py-4">
              <SimplePagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}