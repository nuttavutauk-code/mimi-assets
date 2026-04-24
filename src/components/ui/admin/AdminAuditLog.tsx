"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, ChevronLeft, ChevronRight, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AuditLog {
  id: number;
  userId: number | null;
  username: string | null;
  userRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  DOCUMENT_CREATE: "สร้างเอกสาร",
  DOCUMENT_SUBMIT: "ส่งเอกสาร",
  DOCUMENT_UPDATE: "แก้ไขเอกสาร",
  DOCUMENT_DELETE: "ลบเอกสาร",
  DOCUMENT_APPROVE: "อนุมัติเอกสาร",
  DOCUMENT_REJECT: "ปฏิเสธเอกสาร",
  PICK_TASK_COMPLETE: "Pick Asset เสร็จ",
  PICK_TASK_CANCEL: "ยกเลิก Pick Task",
  PICK_TASK_BARCODE_UPDATE: "อัปเดต Barcode",
  REPAIR_TASK_COMPLETE: "ซ่อมเสร็จ",
  TRANSFER_RECEIVE_COMPLETE: "รับของโอนย้าย",
  TRANSFER_RECEIVE_REJECT: "ปฏิเสธรับของ",
  USER_CREATE: "สร้าง User",
  USER_UPDATE: "แก้ไข User",
  USER_DELETE: "ลบ User",
  USER_LOGIN: "เข้าสู่ระบบ",
  SHOP_CREATE: "สร้าง Shop",
  SHOP_UPDATE: "แก้ไข Shop",
  SHOP_DELETE: "ลบ Shop",
  SHOP_TOGGLE_STATUS: "เปิด/ปิด Shop",
  SHOP_IMPORT: "Import Shop",
  ASSET_IMPORT_NEW: "Import Asset ใหม่",
  ASSET_IMPORT_USED: "Import Asset มือสอง",
  ASSET_IMPORT_REFURBISHED: "Import Asset ซ่อมแล้ว",
  DATABASE_IMPORT: "Import Database",
  DATABASE_ROW_UPDATE: "แก้ไข Database",
  DATABASE_SECURITY_IMPORT: "Import Security DB",
  DATABASE_SECURITY_ROW_UPDATE: "แก้ไข Security DB",
};

const ACTION_COLORS: Record<string, string> = {
  DOCUMENT_APPROVE: "bg-green-100 text-green-800",
  DOCUMENT_REJECT: "bg-red-100 text-red-800",
  DOCUMENT_DELETE: "bg-red-100 text-red-800",
  USER_DELETE: "bg-red-100 text-red-800",
  USER_LOGIN: "bg-blue-100 text-blue-800",
  DATABASE_IMPORT: "bg-purple-100 text-purple-800",
  ASSET_IMPORT_NEW: "bg-purple-100 text-purple-800",
  ASSET_IMPORT_USED: "bg-purple-100 text-purple-800",
  ASSET_IMPORT_REFURBISHED: "bg-purple-100 text-purple-800",
  PICK_TASK_COMPLETE: "bg-emerald-100 text-emerald-800",
  REPAIR_TASK_COMPLETE: "bg-emerald-100 text-emerald-800",
  TRANSFER_RECEIVE_COMPLETE: "bg-emerald-100 text-emerald-800",
  SHOP_TOGGLE_STATUS: "bg-orange-100 text-orange-800",
};

const ENTITY_LABELS: Record<string, string> = {
  Document: "เอกสาร",
  Asset: "Asset",
  User: "User",
  Shop: "Shop",
  PickAssetTask: "Pick Task",
  RepairTask: "Repair Task",
  TransferReceiveTask: "Transfer Receive",
  AssetTransactionHistory: "Transaction History",
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);
const ALL_ENTITIES = Object.keys(ENTITY_LABELS);

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("th-TH", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function DetailBadges({ detail }: { detail: Record<string, unknown> | null }) {
  if (!detail) return null;
  const entries = Object.entries(detail).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
          <span className="font-medium">{k}:</span>
          <span>{String(v)}</span>
        </span>
      ))}
    </div>
  );
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterUsername, setFilterUsername] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const LIMIT = 50;

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(LIMIT),
        ...(filterAction && { action: filterAction }),
        ...(filterEntity && { entity: filterEntity }),
        ...(filterUsername && { username: filterUsername }),
        ...(filterDateFrom && { dateFrom: filterDateFrom }),
        ...(filterDateTo && { dateTo: filterDateTo }),
      });
      const res = await fetch(`/api/audit-log?${params}`);
      const data = await res.json();
      setLogs(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterEntity, filterUsername, filterDateFrom, filterDateTo]);

  useEffect(() => {
    setPage(1);
    fetchLogs(1);
  }, [fetchLogs]);

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchLogs(p);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="gradient-icon w-11 h-11">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
            <p className="text-sm text-muted-foreground">ประวัติการทำรายการทั้งหมดในระบบ</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(page)} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          รีเฟรช
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-sm border border-black/5 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหา Username..."
              value={filterUsername}
              onChange={(e) => setFilterUsername(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">ทุกประเภทการทำรายการ</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">ทุก Entity</option>
            {ALL_ENTITIES.map((e) => (
              <option key={e} value={e}>{ENTITY_LABELS[e] || e}</option>
            ))}
          </select>
          <Input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            placeholder="วันที่เริ่มต้น"
          />
          <Input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            placeholder="วันที่สิ้นสุด"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="text-sm text-muted-foreground">
        พบ <span className="font-semibold text-foreground">{total.toLocaleString()}</span> รายการ
      </div>

      {/* Table */}
      <div className="bg-white/80 backdrop-blur-sm border border-black/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-black/2">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">วันที่-เวลา</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">การทำรายการ</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">รายละเอียด</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/3">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    กำลังโหลด...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-black/2 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {log.username || <span className="text-muted-foreground italic">-</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.userRole ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${log.userRole === "ADMIN" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                          {log.userRole}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700"}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-muted-foreground">
                        {ENTITY_LABELS[log.entity] || log.entity}
                        {log.entityId && <span className="ml-1 font-mono text-foreground/70">#{log.entityId}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <DetailBadges detail={log.detail} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {log.ipAddress || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-black/5">
            <span className="text-sm text-muted-foreground">
              หน้า {page} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1 || loading}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages || loading}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
