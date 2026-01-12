"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { BookOpenText, Upload, Search, Loader2, ChevronLeft, ChevronRight, ImageIcon, Warehouse, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import BulkImageUploader from "@/components/ui/BulkImageUploader";

export default function AdminLibrarySIS() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const fetchLibrarySIS = async (searchValue = "", pageNum = 1) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/library/sis?search=${searchValue}&page=${pageNum}&limit=10`);
      const json = await res.json();
      if (res.ok) { 
        setData(json.data); 
        setTotalPages(json.totalPages);
        if (json.lastUpdated) setLastUpdated(json.lastUpdated);
      }
      else { toast.error(json.error || "โหลดข้อมูลไม่สำเร็จ"); }
    } catch (err) { toast.error("เกิดข้อผิดพลาด"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLibrarySIS(search, page); }, [page]);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("excel", file);
      const res = await fetch("/api/library/sis/import", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) { toast.success(json.message || "นำเข้าสำเร็จ!"); fetchLibrarySIS(); }
      else { toast.error(json.error || "เกิดข้อผิดพลาด"); }
    } catch (err) { toast.error("เกิดข้อผิดพลาด"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleSearch = () => { setPage(1); fetchLibrarySIS(search, 1); };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-container green !w-10 !h-10"><BookOpenText className="w-5 h-5" /></div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Library SIS (Admin)</h1>
          </div>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3" /> Update {formatDate(lastUpdated)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <BulkImageUploader libraryType="sis" onUploadComplete={() => fetchLibrarySIS(search, page)} />
          <label className="gradient-button px-4 py-2.5 text-sm font-medium flex items-center gap-2 cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="hidden sm:inline">Import</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="ค้นหา Barcode, Asset Name, Warehouse..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="pl-10 glass-input" />
          </div>
          <button onClick={handleSearch} className="gradient-button px-6 py-2.5 text-sm font-medium flex items-center justify-center gap-2"><Search className="w-4 h-4" />ค้นหา</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden hidden sm:block">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><BookOpenText className="w-12 h-12 mx-auto mb-3 opacity-30" />ไม่พบข้อมูล</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="glass-table w-full">
                <thead><tr className="bg-black/2"><th>Barcode</th><th>Asset Name</th><th>Asset Type</th><th>Dimension</th><th>Warehouse</th><th>Image</th><th>Status</th><th>Digit</th><th>Remark</th></tr></thead>
                <tbody>
                  {data.map((item, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-sm">{item.barcode}</td>
                      <td className="font-medium">{item.assetName}</td>
                      <td><span className="px-2 py-1 rounded-md bg-green-50 text-green-600 text-xs font-medium">{item.assetType}</span></td>
                      <td>{item.dimension}</td>
                      <td><div className="flex items-center gap-1"><Warehouse className="w-3.5 h-3.5 text-muted-foreground" />{item.warehouse}</div></td>
                      <td>
                        {item.pictureUrl ? (
                          <div className="w-12 h-12 overflow-hidden rounded-lg cursor-pointer border border-black/5 hover:opacity-80 transition-opacity" onClick={() => setSelectedImage(item.pictureUrl)}>
                            <Image src={item.pictureUrl} alt={item.assetName || "image"} width={48} height={48} className="object-cover w-full h-full" unoptimized />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-black/5 rounded-lg flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground/50" /></div>
                        )}
                      </td>
                      <td><span className={`status-badge ${item.status === 'Active' ? 'approved' : 'pending'}`}>{item.status}</span></td>
                      <td className="font-mono text-sm">{item.digit || "-"}</td>
                      <td className="text-muted-foreground">{item.remark || "-"}</td>
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
          <div className="glass-card p-8 text-center text-muted-foreground">ไม่พบข้อมูล</div>
        ) : (
          <>
            {data.map((item, idx) => (
              <div key={idx} className="glass-card p-4">
                <div className="flex gap-3">
                  {item.pictureUrl ? (
                    <div className="w-16 h-16 flex-shrink-0 overflow-hidden rounded-lg cursor-pointer border border-black/5" onClick={() => setSelectedImage(item.pictureUrl)}>
                      <Image src={item.pictureUrl} alt={item.assetName || "image"} width={64} height={64} className="object-cover w-full h-full" unoptimized />
                    </div>
                  ) : (
                    <div className="w-16 h-16 flex-shrink-0 bg-black/5 rounded-lg flex items-center justify-center"><ImageIcon className="w-6 h-6 text-muted-foreground/50" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{item.assetName}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{item.barcode}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded bg-green-50 text-green-600 text-xs">{item.assetType}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Warehouse className="w-3 h-3" />{item.warehouse}</span>
                      {item.digit && <span className="text-xs font-mono text-muted-foreground">Digit: {item.digit}</span>}
                    </div>
                  </div>
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

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-white/95 backdrop-blur-xl border-0 rounded-2xl">
          <VisuallyHidden><DialogTitle>Image Preview</DialogTitle></VisuallyHidden>
          {selectedImage && <Image src={selectedImage} alt="preview" width={900} height={600} className="w-full h-auto rounded-xl object-contain" unoptimized />}
        </DialogContent>
      </Dialog>
    </div>
  );
}