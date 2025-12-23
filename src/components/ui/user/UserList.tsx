"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Trash2, Download, Loader2, Search, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { downloadAsImage } from "@/lib/downloadDocument";
import DocumentTemplateSelector from "@/components/ui/document/DocumentTemplateSelector";

export default function UserList() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [docCode, setDocCode] = useState("");
  const [vendor, setVendor] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [status, setStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [documentToDownload, setDocumentToDownload] = useState<any | null>(null);

  const getEditPath = (documentType: string, id: string) => {
    const pathMap: Record<string, string> = {
      withdraw: `/dashboard/user-document/withdraw/${id}`,
      routing2shops: `/dashboard/user-document/routing2shops/${id}`,
      routing3shops: `/dashboard/user-document/routing3shops/${id}`,
      routing4shops: `/dashboard/user-document/routing4shops/${id}`,
      other: `/dashboard/user-document/other/${id}`,
      transfer: `/dashboard/user-document/transfer/${id}`,
      borrowsecurity: `/dashboard/user-document/borrow-security/${id}`,
      borrow: `/dashboard/user-document/borrow/${id}`,
      return: `/dashboard/user-document/return-asset/${id}`,
      returnasset: `/dashboard/user-document/return-asset/${id}`,
      shoptoshop: `/dashboard/user-document/shop-to-shop/${id}`,
      "shop-to-shop": `/dashboard/user-document/shop-to-shop/${id}`,
      repair: `/dashboard/user-document/repair/${id}`,
    };
    return pathMap[documentType] || `/dashboard/user-document/edit/${id}`;
  };

  const fetchDocuments = async (pageNum = 1) => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
        docCode,
        vendor,
        documentType,
        status,
      });
      const res = await fetch(`/api/document/list?${query}`);
      const json = await res.json();
      if (json.success) {
        setData(json.documents);
        setTotalPages(json.totalPages || 1);
      } else throw new Error(json.message || "โหลดข้อมูลล้มเหลว");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments(page);
  }, [page]);

  const typeMap: Record<string, string> = {
    withdraw: "ใบเบิก Asset",
    routing2shops: "Routing 2 shops",
    routing3shops: "Routing 3 shops",
    routing4shops: "Routing 4 shops",
    other: "ใบเบิกของอื่นๆ",
    transfer: "ใบย้ายของ",
    borrowsecurity: "ใบยืม+Security",
    borrow: "ใบยืม",
    return: "เก็บ Asset กลับ",
    returnasset: "เก็บ Asset กลับ",
    shoptoshop: "Shop to Shop",
    "shop-to-shop": "Shop to Shop",
    repair: "ใบแจ้งซ่อม",
  };

  const statusConfig: Record<string, { text: string; className: string }> = {
    submitted: { text: "รออนุมัติ", className: "status-badge pending" },
    approved: { text: "อนุมัติแล้ว", className: "status-badge approved" },
    rejected: { text: "รอแก้ไข", className: "status-badge rejected" },
  };

  const handleDelete = async (id: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารนี้?")) return;
    try {
      const res = await fetch(`/api/document/delete/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("ลบเอกสารสำเร็จ");
        fetchDocuments(page);
      } else {
        toast.error(json.message || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      toast.error("ไม่สามารถเชื่อมต่อ API ได้");
    }
  };

  const handleDownload = async (item: any) => {
    setDownloadingId(item.id);
    try {
      const res = await fetch(`/api/document/${item.id}`);
      const json = await res.json();
      if (!json.success) {
        toast.error("ไม่สามารถโหลดข้อมูลเอกสารได้");
        return;
      }
      setDocumentToDownload(json.document);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const success = await downloadAsImage("document-to-print", item.docCode);
      if (success) {
        toast.success("ดาวน์โหลดเอกสารสำเร็จ");
      } else {
        toast.error("ไม่สามารถสร้างรูปภาพได้");
      }
    } catch (err) {
      toast.error("เกิดข้อผิดพลาดในการดาวน์โหลด");
    } finally {
      setDownloadingId(null);
      setDocumentToDownload(null);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchDocuments(1);
    setShowFilters(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">รายการเอกสาร</h1>
          <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">จัดการเอกสารทั้งหมดของคุณ</p>
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="sm:hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-black/5 text-sm font-medium">
          <Filter className="w-4 h-4" />
          กรอง
        </button>
      </div>

      {/* Filter - Desktop */}
      <div className="glass-card p-4 hidden sm:block">
        <div className="grid grid-cols-5 gap-3">
          <Input value={docCode} onChange={(e) => setDocCode(e.target.value)} placeholder="เลขที่เอกสาร" className="glass-input" />
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor" className="glass-input" />
          <Select onValueChange={setDocumentType}>
            <SelectTrigger className="glass-input"><SelectValue placeholder="ประเภท" /></SelectTrigger>
            <SelectContent>
              {Object.entries(typeMap).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select onValueChange={setStatus}>
            <SelectTrigger className="glass-input"><SelectValue placeholder="สถานะ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">รออนุมัติ</SelectItem>
              <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
              <SelectItem value="rejected">รอแก้ไข</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={handleSearch} className="gradient-button py-2 flex items-center justify-center gap-2 text-sm font-medium">
            <Search className="w-4 h-4" />ค้นหา
          </button>
        </div>
      </div>

      {/* Filter - Mobile */}
      {showFilters && (
        <div className="glass-card p-4 sm:hidden space-y-3">
          <Input value={docCode} onChange={(e) => setDocCode(e.target.value)} placeholder="เลขที่เอกสาร" className="glass-input" />
          <Select onValueChange={setStatus}>
            <SelectTrigger className="glass-input"><SelectValue placeholder="สถานะ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">รออนุมัติ</SelectItem>
              <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
              <SelectItem value="rejected">รอแก้ไข</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={handleSearch} className="w-full gradient-button py-2.5 text-sm font-medium">ค้นหา</button>
        </div>
      )}

      {/* Table - Desktop */}
      <div className="glass-card overflow-hidden hidden sm:block">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">{error}</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">ไม่มีข้อมูล</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="glass-table w-full">
                <thead><tr className="bg-black/2"><th>เลขเอกสาร</th><th>Vendor</th><th>วันที่</th><th>ประเภท</th><th>สถานะ</th><th>สถานะ Pick Asset</th><th className="text-center">จัดการ</th></tr></thead>
                <tbody>
                  {data.map((item, i) => {
                    const statusInfo = statusConfig[item.status] || { text: item.status, className: "status-badge" };
                    const pickStatusConfig: Record<string, { text: string; className: string }> = {
                      "-": { text: "-", className: "text-gray-400" },
                      "processing": { text: "อยู่ระหว่างดำเนินการ", className: "status-badge pending" },
                      "completed": { text: "เสร็จสิ้น", className: "status-badge approved" },
                    };
                    const pickStatus = pickStatusConfig[item.pickAssetStatus] || { text: "-", className: "text-gray-400" };
                    return (
                      <tr key={i}>
                        <td className="font-medium text-primary">{item.docCode}</td>
                        <td>{item.company || "-"}</td>
                        <td>{new Date(item.createdAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}</td>
                        <td>{typeMap[item.documentType] || item.documentType}</td>
                        <td><span className={statusInfo.className}><span className="w-1.5 h-1.5 rounded-full bg-current" />{statusInfo.text}</span></td>
                        <td><span className={pickStatus.className}>{pickStatus.text !== "-" && <span className="w-1.5 h-1.5 rounded-full bg-current" />}{pickStatus.text}</span></td>
                        <td>
                          <div className="flex justify-center gap-1">
                            {item.status === "approved" && (
                              <button onClick={() => handleDownload(item)} disabled={downloadingId === item.id} className="p-2 rounded-lg hover:bg-green-50 text-green-500">
                                {downloadingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                              </button>
                            )}
                            <button onClick={() => router.push(getEditPath(item.documentType, item.id))} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* Cards - Mobile */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : error ? (
          <div className="glass-card p-8 text-center text-red-500 text-sm">{error}</div>
        ) : data.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">ไม่มีข้อมูล</div>
        ) : (
          <>
            {data.map((item, i) => {
              const statusInfo = statusConfig[item.status] || { text: item.status, className: "status-badge" };
              return (
                <div key={i} className="glass-card p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{item.docCode}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{typeMap[item.documentType] || item.documentType}</p>
                    </div>
                    <span className={statusInfo.className}>{statusInfo.text}</span>
                  </div>
                  <div className="flex gap-2">
                    {item.status === "approved" && (
                      <button onClick={() => handleDownload(item)} disabled={downloadingId === item.id} className="flex-1 py-2.5 rounded-lg bg-green-50 text-green-600 font-medium text-sm flex items-center justify-center gap-1">
                        {downloadingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      </button>
                    )}
                    <button onClick={() => router.push(getEditPath(item.documentType, item.id))} className="flex-1 py-2.5 rounded-lg bg-blue-50 text-blue-600 font-medium text-sm flex items-center justify-center gap-1">
                      <Edit className="w-4 h-4" />แก้ไข
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="py-2.5 px-3 rounded-lg bg-red-50 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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

      {/* Hidden Template */}
      {documentToDownload && (
        <div style={{ position: "fixed", left: "-9999px", top: 0, backgroundColor: "#fff" }}>
          <DocumentTemplateSelector document={documentToDownload} />
        </div>
      )}
    </div>
  );
}