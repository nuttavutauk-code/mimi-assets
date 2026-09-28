"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Pencil, Receipt, RefreshCw, Save, Search, Trash2, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SimplePagination } from "@/components/ui/SimplePagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PO_FIELDS, type PoRowField } from "@/lib/po-tracking/constants";
import PoRowsTable, { type EditableRow } from "./PoRowsTable";
import PoJobDialog from "./PoJobDialog";

type Row = EditableRow & { id: number; jobGroupId: string };

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

const normalizeForDiff = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

export default function AdminPoTracking() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ currentPage: 1, totalPages: 1, totalCount: 0, limit: 50 });
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "50" });
        if (appliedSearch) params.set("q", appliedSearch);
        const res = await fetch(`/api/po-tracking?${params}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          setPagination(json.pagination);
        } else toast.error(json.message || "โหลดข้อมูลไม่สำเร็จ");
      } catch {
        toast.error("โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [appliedSearch],
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleSearch = () => {
    setIsEditMode(false);
    setAppliedSearch(search.trim());
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = appliedSearch ? `?${new URLSearchParams({ q: appliedSearch })}` : "";
      const res = await fetch(`/api/po-tracking/export${params}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PO_Cost_Tracking_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  };

  const enterEditMode = () => {
    setEditedData(JSON.parse(JSON.stringify(data)));
    setIsEditMode(true);
  };

  const handleCellChange = (rowIndex: number, field: PoRowField, value: string) => {
    setEditedData((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [field]: value } : r)));
  };

  const handleSave = async () => {
    const updates = editedData
      .map((edited, i) => {
        const original = data[i];
        const changes: Record<string, unknown> = {};
        for (const f of PO_FIELDS) {
          if (normalizeForDiff(edited[f]) !== normalizeForDiff(original[f])) changes[f] = edited[f];
        }
        return Object.keys(changes).length ? { id: edited.id, ...changes } : null;
      })
      .filter(Boolean);

    if (updates.length === 0) {
      toast.info("ไม่มีข้อมูลที่เปลี่ยนแปลง");
      setIsEditMode(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/po-tracking/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "บันทึกไม่สำเร็จ");
        return;
      }
      toast.success(json.message);
      setIsEditMode(false);
      fetchData(pagination.currentPage);
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/po-tracking/${encodeURIComponent(deleteTarget.jobGroupId)}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "ลบไม่สำเร็จ");
        return;
      }
      toast.success(json.message);
      setDeleteTarget(null);
      fetchData(pagination.currentPage);
    } catch {
      toast.error("ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  const rows = isEditMode ? editedData : data;
  const isGroupStart = (i: number) => i === 0 || rows[i].jobGroupId !== rows[i - 1].jobGroupId;

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-container cyan !w-10 !h-10"><Receipt className="w-5 h-5" /></div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">PO Cost Tracking</h1>
          </div>
          <p className="text-sm text-muted-foreground">อัปโหลด Cheil PO + Samsung PO + ใบเสนอราคา ให้ AI ดึงข้อมูล แล้ว Export เป็น Excel</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isEditMode ? (
            <>
              <button onClick={() => setJobDialogOpen(true)} className="gradient-button px-4 py-2.5 text-sm font-medium flex items-center gap-2">
                <Upload className="w-4 h-4" />อัปโหลด Job
              </button>
              <button onClick={() => fetchData(pagination.currentPage)} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /><span className="hidden sm:inline">Refresh</span>
              </button>
              <button onClick={handleExport} disabled={exporting} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2 text-green-600 border-green-300 hover:bg-green-50">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="hidden sm:inline">Export Excel</span>
              </button>
              <button onClick={enterEditMode} disabled={data.length === 0} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 disabled:opacity-50">
                <Pencil className="w-4 h-4" /><span className="hidden sm:inline">แก้ไข</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditMode(false)} disabled={saving} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center gap-2 text-gray-600">
                <X className="w-4 h-4" />ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving} className="gradient-button px-4 py-2.5 text-sm font-medium flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกการแก้ไข
              </button>
            </>
          )}
        </div>
      </div>

      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="ค้นหา JOB NO. / CH PO / SS PO / VENDOR / ASSET TYPE"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="glass-input flex-1"
          disabled={isEditMode}
        />
        <button onClick={handleSearch} disabled={isEditMode} className="gradient-button px-5 py-2 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50">
          <Search className="w-4 h-4" />ค้นหา
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded-md bg-sky-100 text-sky-900">ดึงจากเอกสารโดย AI</span>
        <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-700">กรอกเอง</span>
        {isEditMode && <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 font-medium">โหมดแก้ไข — แก้ได้ทุกช่อง</span>}
        <span className="ml-auto text-muted-foreground">รวม {pagination.totalCount.toLocaleString()} แถว</span>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
            {appliedSearch ? "ไม่พบข้อมูลที่ค้นหา" : "ยังไม่มีข้อมูล — กด \"อัปโหลด Job\" เพื่อเริ่ม"}
          </div>
        ) : (
          <>
            <PoRowsTable
              rows={rows}
              editable={isEditMode}
              onCellChange={handleCellChange}
              isGroupStart={isGroupStart}
              renderRowActions={
                isEditMode
                  ? undefined
                  : (row, i) =>
                      isGroupStart(i) ? (
                        <button onClick={() => setDeleteTarget(row)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="ลบทั้ง job">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : null
              }
            />
            <div className="flex justify-between items-center p-4 border-t border-black/5 bg-white/50">
              <span className="text-sm text-muted-foreground">รวม {pagination.totalCount.toLocaleString()} แถว</span>
              <SimplePagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={(p) => p >= 1 && p <= pagination.totalPages && fetchData(p)}
                disabled={isEditMode}
              />
            </div>
          </>
        )}
      </div>

      <PoJobDialog open={jobDialogOpen} onOpenChange={setJobDialogOpen} onSaved={() => fetchData(1)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบทั้ง job?</AlertDialogTitle>
            <AlertDialogDescription>
              JOB NO. {deleteTarget?.jobNo ?? "-"} / CH PO {deleteTarget?.chPo ?? "-"} — จะลบทุกแถวที่มาจากการอัปโหลดชุดเดียวกัน (ย้อนกลับไม่ได้)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
