"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, ChevronDown, ChevronRight, Download, Loader2, Package, Search, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  NO_WAREHOUSE,
  buildPivot,
  filterSummaryRows,
  groupSummary,
  type Group,
  type StatusCounts,
  type SummaryRow,
} from "@/lib/assetSummaryPivot";

const STATUS_FILTERS = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "NEW", label: "NEW" },
  { value: "REFURBISHED", label: "REFURBISHED" },
  { value: "USED", label: "USED" },
] as const;

const fmt = (n: number) => n.toLocaleString("th-TH");

function StatusCells({ counts }: { counts: StatusCounts }) {
  return (
    <>
      <td className="!text-center text-green-700">{counts.NEW ? fmt(counts.NEW) : <span className="text-gray-300">–</span>}</td>
      <td className="!text-center text-blue-700">{counts.REFURBISHED ? fmt(counts.REFURBISHED) : <span className="text-gray-300">–</span>}</td>
      <td className="!text-center text-amber-700">{counts.USED ? fmt(counts.USED) : <span className="text-gray-300">–</span>}</td>
    </>
  );
}

function GroupTable({
  groups,
  keyLabel,
  detailLabel,
  countLabel,
  keyIcon,
}: {
  groups: Group[];
  keyLabel: string;
  detailLabel: string;
  countLabel: string;
  keyIcon: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (groups.length === 0) {
    return <div className="p-12 text-center text-muted-foreground">ไม่พบข้อมูล</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="glass-table w-full text-sm">
        <thead>
          <tr className="bg-black/2">
            <th className="w-8" />
            <th>{keyLabel}</th>
            <th className="!text-center">รวม</th>
            <th className="!text-center">NEW</th>
            <th className="!text-center">REFURBISHED</th>
            <th className="!text-center">USED</th>
            <th className="!text-center">{countLabel}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const open = expanded.has(g.key);
            return (
              <Fragment key={g.key}>
                <tr className="cursor-pointer hover:bg-black/2" onClick={() => toggle(g.key)}>
                  <td className="text-muted-foreground">{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                  <td className={`font-medium ${g.key === NO_WAREHOUSE ? "text-red-600" : ""}`}>
                    <span className="inline-flex items-center gap-2">{keyIcon}{g.key}</span>
                  </td>
                  <td className="!text-center font-semibold">{fmt(g.total)}</td>
                  <StatusCells counts={g.byStatus} />
                  <td className="!text-center text-muted-foreground">{fmt(g.details.length)}</td>
                </tr>
                {open && (
                  <tr>
                    <td />
                    <td colSpan={6} className="!p-0">
                      <div className="m-2 rounded-lg border border-black/5 bg-black/2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left px-3 py-2 font-medium">{detailLabel}</th>
                              <th className="!text-center px-3 py-2 font-medium">จำนวน</th>
                              <th className="!text-center px-3 py-2 font-medium">NEW</th>
                              <th className="!text-center px-3 py-2 font-medium">REFURBISHED</th>
                              <th className="!text-center px-3 py-2 font-medium">USED</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.details.map((d) => (
                              <tr key={d.key} className="border-t border-black/5">
                                <td className={`px-3 py-1.5 ${d.key === NO_WAREHOUSE ? "text-red-600" : ""}`}>{d.key}</td>
                                <td className="px-3 py-1.5 text-center font-medium">{fmt(d.total)}</td>
                                <td className="px-3 py-1.5 text-center text-green-700">{d.byStatus.NEW ? fmt(d.byStatus.NEW) : "–"}</td>
                                <td className="px-3 py-1.5 text-center text-blue-700">{d.byStatus.REFURBISHED ? fmt(d.byStatus.REFURBISHED) : "–"}</td>
                                <td className="px-3 py-1.5 text-center text-amber-700">{d.byStatus.USED ? fmt(d.byStatus.USED) : "–"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PivotTable({ rows }: { rows: SummaryRow[] }) {
  const pivot = useMemo(() => buildPivot(rows), [rows]);
  if (pivot.assets.length === 0) {
    return <div className="p-12 text-center text-muted-foreground">ไม่พบข้อมูล</div>;
  }
  return (
    <div className="overflow-auto max-h-[70vh]">
      <table className="text-xs border-separate border-spacing-0 min-w-full">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 bg-white border-b border-r border-black/10 px-3 py-2 text-left font-semibold min-w-[220px]">Asset Name</th>
            {pivot.warehouses.map((w) => (
              <th key={w} className={`sticky top-0 z-20 bg-white border-b border-black/10 px-3 py-2 text-right font-semibold whitespace-nowrap ${w === NO_WAREHOUSE ? "text-red-600" : ""}`}>{w}</th>
            ))}
            <th className="sticky top-0 z-20 bg-gray-50 border-b border-l border-black/10 px-3 py-2 text-right font-semibold">รวม</th>
          </tr>
        </thead>
        <tbody>
          {pivot.assets.map((a) => (
            <tr key={a} className="hover:bg-blue-50/40">
              <td className="sticky left-0 z-10 bg-white border-b border-r border-black/5 px-3 py-1.5 font-medium">{a}</td>
              {pivot.warehouses.map((w) => {
                const v = pivot.cells[a][w] || 0;
                return (
                  <td key={w} className={`border-b border-black/5 px-3 py-1.5 text-right ${v ? "" : "text-gray-300"}`}>{v ? fmt(v) : "–"}</td>
                );
              })}
              <td className="border-b border-l border-black/5 bg-gray-50 px-3 py-1.5 text-right font-semibold">{fmt(pivot.rowTotals[a])}</td>
            </tr>
          ))}
          <tr>
            <td className="sticky left-0 bottom-0 z-20 bg-gray-100 border-t border-r border-black/10 px-3 py-2 font-semibold">รวม</td>
            {pivot.warehouses.map((w) => (
              <td key={w} className="sticky bottom-0 z-10 bg-gray-100 border-t border-black/10 px-3 py-2 text-right font-semibold">{fmt(pivot.colTotals[w])}</td>
            ))}
            <td className="sticky bottom-0 z-10 bg-gray-200 border-t border-l border-black/10 px-3 py-2 text-right font-bold">{fmt(pivot.grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function AdminAssetSummary() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/asset-summary");
        const json = await res.json();
        if (res.ok && json.success) setRows(json.rows);
        else toast.error(json.message || "โหลดข้อมูลไม่สำเร็จ");
      } catch {
        toast.error("เกิดข้อผิดพลาด");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => filterSummaryRows(rows, status, search), [rows, status, search]);
  const byAsset = useMemo(() => groupSummary(filtered, "asset"), [filtered]);
  const byWarehouse = useMemo(() => groupSummary(filtered, "warehouse"), [filtered]);

  const totals = useMemo(() => {
    const t = { total: 0, NEW: 0, REFURBISHED: 0, USED: 0, noWarehouse: 0 };
    for (const r of filtered) {
      t.total += r.count;
      if (r.status !== "ไม่ระบุ") t[r.status] += r.count;
      if (r.warehouse === NO_WAREHOUSE) t.noWarehouse += r.count;
    }
    return t;
  }, [filtered]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ status, search });
      const res = await fetch(`/api/asset-summary/export?${params.toString()}`);
      if (!res.ok) {
        toast.error("Export ไม่สำเร็จ");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "asset-stock-summary.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Export ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  };

  const cards = [
    { label: "ของในโกดังทั้งหมด", value: totals.total, className: "text-foreground" },
    { label: "Asset Name", value: byAsset.length, className: "text-foreground" },
    { label: "โกดัง", value: byWarehouse.filter((g) => g.key !== NO_WAREHOUSE).length, className: "text-foreground" },
    { label: "NEW", value: totals.NEW, className: "text-green-700" },
    { label: "REFURBISHED", value: totals.REFURBISHED, className: "text-blue-700" },
    { label: "USED", value: totals.USED, className: "text-amber-700" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-container blue !w-10 !h-10"><BarChart3 className="w-5 h-5" /></div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">สรุปสต็อก Asset</h1>
          </div>
          <p className="text-sm text-muted-foreground">จำนวนของที่อยู่ในโกดัง (นับจาก Transaction ล่าสุดของแต่ละ Barcode ที่ Balance = 1)</p>
        </div>
        <button onClick={handleExport} disabled={exporting || loading} className="glass-button px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Export Excel
        </button>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="glass-card p-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`text-2xl font-semibold tabular-nums ${c.className}`}>{fmt(c.value)}</p>
              </div>
            ))}
          </div>

          {totals.noWarehouse > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              มีของ {fmt(totals.noWarehouse)} ชิ้นที่ไม่ระบุโกดัง (แสดงเป็น &quot;{NO_WAREHOUSE}&quot;) ควรตรวจสอบและแก้ไขในหน้า Database
            </div>
          )}

          {/* Filters */}
          <div className="glass-card p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="ค้นหา Asset Name หรือ โกดัง..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 glass-input" />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatus(f.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${status === f.value ? "bg-black text-white" : "bg-black/5 text-gray-700 hover:bg-black/10"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Views */}
          <Tabs defaultValue="asset">
            <TabsList className="w-full sm:w-fit">
              <TabsTrigger value="asset"><Package />ตาม Asset Name</TabsTrigger>
              <TabsTrigger value="warehouse"><Warehouse />ตามโกดัง</TabsTrigger>
              <TabsTrigger value="pivot"><Boxes />ตารางไขว้</TabsTrigger>
            </TabsList>
            <TabsContent value="asset" className="glass-card overflow-hidden">
              <GroupTable groups={byAsset} keyLabel="Asset Name" detailLabel="โกดัง" countLabel="จำนวนโกดัง" keyIcon={null} />
            </TabsContent>
            <TabsContent value="warehouse" className="glass-card overflow-hidden">
              <GroupTable groups={byWarehouse} keyLabel="โกดัง" detailLabel="Asset Name" countLabel="จำนวน Asset Name" keyIcon={<Warehouse className="w-4 h-4 text-muted-foreground" />} />
            </TabsContent>
            <TabsContent value="pivot" className="glass-card overflow-hidden">
              <PivotTable rows={filtered} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
