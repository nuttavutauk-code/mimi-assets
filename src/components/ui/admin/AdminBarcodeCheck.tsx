"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2, ScanBarcode, CheckCircle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SimplePagination } from "@/components/ui/SimplePagination";
import debounce from "lodash.debounce";

interface ReservedItem {
    id: number;
    barcode: string;
    assetName: string;
    warehouse: string;
    status: string;
    documentId: number;
    docCode: string;
    documentType: string;
    shopCode: string;
    shopName: string;
    requesterName: string;
    requesterCompany: string;
    createdAt: string;
}

const statusConfig: Record<string, { text: string; className: string }> = {
    picking: { text: "กำลังจอง", className: "status-badge reviewing" },
    pending: { text: "รอดำเนินการ", className: "status-badge pending" },
};

export default function AdminBarcodeCheck() {
    // Section A — single barcode search
    const [searchInput, setSearchInput] = useState("");
    const [searchResult, setSearchResult] = useState<ReservedItem[] | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);

    // Section B — full table
    const [tableData, setTableData] = useState<ReservedItem[]>([]);
    const [tableTotal, setTableTotal] = useState(0);
    const [tableTotalPages, setTableTotalPages] = useState(1);
    const [tablePage, setTablePage] = useState(1);
    const [tableStatus, setTableStatus] = useState("");
    const [tableSearch, setTableSearch] = useState("");
    const [tableLoading, setTableLoading] = useState(false);

    const fetchSingle = useCallback(async (barcode: string) => {
        if (!barcode.trim()) { setSearchResult(null); return; }
        setSearchLoading(true);
        try {
            const res = await fetch(`/api/pick-asset/reserved?barcode=${encodeURIComponent(barcode.trim())}&limit=5`);
            const json = await res.json();
            setSearchResult(json.items || []);
        } catch {
            setSearchResult([]);
        } finally {
            setSearchLoading(false);
        }
    }, []);

    const debouncedSingle = useRef(debounce((v: string) => fetchSingle(v), 300)).current;

    const handleSearchChange = (v: string) => {
        setSearchInput(v);
        debouncedSingle(v);
    };

    const fetchTable = useCallback(async () => {
        setTableLoading(true);
        try {
            const params = new URLSearchParams({ page: String(tablePage), limit: "10" });
            if (tableStatus) params.append("status", tableStatus);
            if (tableSearch.trim()) params.append("barcode", tableSearch.trim());
            const res = await fetch(`/api/pick-asset/reserved?${params.toString()}`);
            const json = await res.json();
            setTableData(json.items || []);
            setTableTotal(json.total || 0);
            setTableTotalPages(json.totalPages || 1);
        } catch {
            setTableData([]);
        } finally {
            setTableLoading(false);
        }
    }, [tablePage, tableStatus, tableSearch]);

    useEffect(() => { fetchTable(); }, [fetchTable]);

    const handleTableSearchChange = debounce((v: string) => {
        setTableSearch(v);
        setTablePage(1);
    }, 300);

    return (
        <div className="space-y-8 p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <ScanBarcode className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">ตรวจสอบ Barcode</h1>
            </div>

            {/* Section A — Search single barcode */}
            <div className="glass-card p-5 space-y-4">
                <h2 className="text-sm font-medium text-gray-700">ค้นหา Barcode เดี่ยว</h2>
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        value={searchInput}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="กรอก Barcode เพื่อตรวจสอบ..."
                        className="glass-input pl-9"
                    />
                    {searchLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                    )}
                </div>

                {searchResult !== null && !searchLoading && (
                    <div className="space-y-2">
                        {searchResult.length === 0 ? (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 max-w-md">
                                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                                <span className="text-sm text-green-700 font-medium">Barcode พร้อมใช้งาน (ไม่ถูกจอง)</span>
                            </div>
                        ) : (
                            searchResult.map((item) => (
                                <div key={item.id} className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2 max-w-xl">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                                        <span className="text-sm font-semibold text-red-700">Barcode กำลังถูกจอง</span>
                                        <span className={statusConfig[item.status]?.className || "status-badge"}>
                                            {statusConfig[item.status]?.text || item.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700 pl-6">
                                        <div><span className="text-gray-500">Barcode:</span> <span className="font-mono">{item.barcode}</span></div>
                                        <div><span className="text-gray-500">Asset:</span> {item.assetName}</div>
                                        <div><span className="text-gray-500">โกดัง:</span> {item.warehouse}</div>
                                        <div><span className="text-gray-500">เลขเอกสาร:</span>{" "}
                                            <a href={`/dashboard/admin-document/withdraw/${item.documentId}`} className="text-blue-600 hover:underline">
                                                {item.docCode}
                                            </a>
                                        </div>
                                        <div><span className="text-gray-500">Shop:</span> {item.shopCode} {item.shopName && `— ${item.shopName}`}</div>
                                        <div><span className="text-gray-500">ผู้ขอ:</span> {item.requesterName}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Section B — All reserved barcodes */}
            <div className="glass-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h2 className="text-sm font-medium text-gray-700 flex-1">
                        Barcodes ที่ถูกจองทั้งหมด
                        {!tableLoading && <span className="ml-2 text-gray-400">({tableTotal} รายการ)</span>}
                    </h2>
                    <div className="flex gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <Input
                                placeholder="ค้นหา Barcode..."
                                className="glass-input pl-8 h-9 text-sm w-48"
                                onChange={(e) => handleTableSearchChange(e.target.value)}
                            />
                        </div>
                        <Select value={tableStatus || "all"} onValueChange={(v) => { setTableStatus(v === "all" ? "" : v); setTablePage(1); }}>
                            <SelectTrigger className="glass-input h-9 text-sm w-36">
                                <SelectValue placeholder="ทุกสถานะ" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ทุกสถานะ</SelectItem>
                                <SelectItem value="picking">กำลังจอง</SelectItem>
                                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {tableLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                ) : tableData.length === 0 ? (
                    <div className="text-center py-10 text-sm text-gray-400">ไม่พบ Barcode ที่ถูกจอง</div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="overflow-x-auto hidden sm:block">
                            <table className="glass-table w-full">
                                <thead>
                                    <tr className="bg-black/2">
                                        <th className="text-left">Barcode</th>
                                        <th className="text-left">Asset Name</th>
                                        <th className="text-center">โกดัง</th>
                                        <th className="text-center">สถานะ</th>
                                        <th className="text-center">เลขเอกสาร</th>
                                        <th className="text-center">Shop Code</th>
                                        <th className="text-left">ผู้ขอ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.map((item) => {
                                        const s = statusConfig[item.status] || { text: item.status, className: "status-badge" };
                                        return (
                                            <tr key={item.id}>
                                                <td className="font-mono text-sm">{item.barcode}</td>
                                                <td className="text-sm">{item.assetName}</td>
                                                <td className="text-center text-sm">{item.warehouse}</td>
                                                <td className="text-center"><span className={s.className}>{s.text}</span></td>
                                                <td className="text-center">
                                                    <a href={`/dashboard/admin-document/withdraw/${item.documentId}`} className="text-blue-600 hover:underline text-sm">
                                                        {item.docCode}
                                                    </a>
                                                </td>
                                                <td className="text-center text-sm">{item.shopCode || "-"}</td>
                                                <td className="text-sm">{item.requesterName || "-"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="sm:hidden space-y-3">
                            {tableData.map((item) => {
                                const s = statusConfig[item.status] || { text: item.status, className: "status-badge" };
                                return (
                                    <div key={item.id} className="glass-card p-3 space-y-1 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono font-medium">{item.barcode}</span>
                                            <span className={s.className}>{s.text}</span>
                                        </div>
                                        <div className="text-gray-600">{item.assetName}</div>
                                        <div className="flex gap-4 text-gray-500 text-xs">
                                            <span>โกดัง: {item.warehouse}</span>
                                            <span>Shop: {item.shopCode || "-"}</span>
                                        </div>
                                        <div className="text-xs">
                                            เอกสาร:{" "}
                                            <a href={`/dashboard/admin-document/withdraw/${item.documentId}`} className="text-blue-600 hover:underline">
                                                {item.docCode}
                                            </a>
                                            {item.requesterName && ` · ${item.requesterName}`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-xs text-gray-400">
                                หน้า {tablePage} / {tableTotalPages} ({tableTotal} รายการ)
                            </span>
                            <SimplePagination
                                currentPage={tablePage}
                                totalPages={tableTotalPages}
                                onPageChange={setTablePage}
                                disabled={tableLoading}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
