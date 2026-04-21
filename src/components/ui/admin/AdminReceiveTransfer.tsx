"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { SimplePagination } from "@/components/ui/SimplePagination";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Search, Package, Loader2, Eye, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface ReceiveTask {
    id: number;
    documentId: number;
    docCode: string;
    fromWarehouse: string;
    toWarehouse: string;
    senderName: string;
    transferDate: string;
    status: string;
    totalItems: number;
    receivedItems: number;
    rejectedItems: number;
    createdAt: string;
}

export default function AdminReceiveTransfer() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [tasks, setTasks] = useState<ReceiveTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterStatus, setFilterStatus] = useState<string>("all");

    useEffect(() => {
        fetchReceiveTasks();
    }, [currentPage, filterStatus]);

    const fetchReceiveTasks = async () => {
        try {
            setLoading(true);
            // ✅ เรียก API แบบ admin (ดูทุกรายการ)
            const res = await fetch(`/api/receive-transfer/all-tasks?page=${currentPage}&status=${filterStatus}`);
            const data = await res.json();

            if (data.success) {
                setTasks(data.tasks);
                setTotalPages(data.totalPages);
            }
        } catch (error) {
            console.error("Error fetching receive tasks:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = tasks.filter(
        (item) =>
            item.docCode.toLowerCase().includes(search.toLowerCase()) ||
            item.fromWarehouse.toLowerCase().includes(search.toLowerCase()) ||
            item.toWarehouse.toLowerCase().includes(search.toLowerCase()) ||
            item.senderName.toLowerCase().includes(search.toLowerCase())
    );

    const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
        pending: { label: "รอตรวจสอบ", color: "bg-yellow-100 text-yellow-700", icon: Clock },
        received: { label: "รับครบแล้ว", color: "bg-green-100 text-green-700", icon: CheckCircle },
        received_with_rejected: { label: "รับแล้ว(มียกเลิก)", color: "bg-orange-100 text-orange-700", icon: AlertTriangle },
    };

    const handleViewTask = (documentId: number) => {
        router.push(`/dashboard/admin-receive-transfer/${documentId}`);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("th-TH", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground">รับของโอนย้าย (Admin View)</h1>
                <p className="text-sm text-muted-foreground mt-0.5">ดูรายการรับของโอนย้ายทั้งหมด (View Only)</p>
            </div>

            {/* Filter & Search */}
            <div className="glass-card p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                            placeholder="ค้นหาเลขที่เอกสาร, โกดัง, ผู้ส่ง..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 glass-input"
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={(value) => { setFilterStatus(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-full sm:w-48 glass-input">
                            <SelectValue placeholder="สถานะ" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">ทั้งหมด</SelectItem>
                            <SelectItem value="pending">รอตรวจสอบ</SelectItem>
                            <SelectItem value="received">รับครบแล้ว</SelectItem>
                            <SelectItem value="received_with_rejected">รับแล้ว(มียกเลิก)</SelectItem>
                        </SelectContent>
                    </Select>
                    <button onClick={fetchReceiveTasks} className="gradient-button px-6 py-2.5 text-sm font-medium flex items-center justify-center gap-2">
                        <Search className="w-4 h-4" />
                        ค้นหา
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-4">
                    <div className="flex items-center gap-2 text-yellow-600">
                        <Clock className="w-5 h-5" />
                        <span className="text-sm">รอตรวจสอบ</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">
                        {tasks.filter((t) => t.status === "pending").length}
                    </p>
                </div>
                <div className="glass-card p-4">
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm">รับครบแล้ว</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">
                        {tasks.filter((t) => t.status === "received").length}
                    </p>
                </div>
                <div className="glass-card p-4">
                    <div className="flex items-center gap-2 text-orange-600">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-sm">รับแล้ว(มียกเลิก)</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">
                        {tasks.filter((t) => t.status === "received_with_rejected").length}
                    </p>
                </div>
                <div className="glass-card p-4">
                    <div className="flex items-center gap-2 text-gray-600">
                        <Package className="w-5 h-5" />
                        <span className="text-sm">ทั้งหมด</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">{tasks.length}</p>
                </div>
            </div>

            {/* Table - Desktop */}
            <div className="glass-card overflow-hidden hidden sm:block">
                {loading ? (
                    <div className="p-12 text-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        กำลังโหลดข้อมูล...
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        ไม่พบรายการ
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="glass-table w-full">
                                <thead>
                                    <tr className="bg-black/2">
                                        <th>Document No.</th>
                                        <th>จากโกดัง</th>
                                        <th>ไปโกดัง</th>
                                        <th>ผู้ส่ง</th>
                                        <th>วันที่โอนย้าย</th>
                                        <th>Progress</th>
                                        <th>Status</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((item) => {
                                        const config = statusConfig[item.status] || {
                                            label: item.status,
                                            color: "bg-gray-100 text-gray-700",
                                            icon: Clock,
                                        };
                                        const StatusIcon = config.icon;
                                        const progress = item.totalItems > 0 ? Math.round((item.receivedItems / item.totalItems) * 100) : 0;

                                        return (
                                            <tr key={item.id}>
                                                <td className="font-medium text-primary">{item.docCode}</td>
                                                <td>{item.fromWarehouse}</td>
                                                <td>{item.toWarehouse}</td>
                                                <td>{item.senderName}</td>
                                                <td className="text-muted-foreground">{formatDate(item.transferDate)}</td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 h-2 bg-black/5 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            {item.receivedItems}/{item.totalItems}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {config.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="flex justify-center">
                                                        <button
                                                            onClick={() => handleViewTask(item.documentId)}
                                                            className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                                                            title="ดูรายละเอียด"
                                                        >
                                                            <Eye className="w-4 h-4" />
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
                            <span className="text-sm text-muted-foreground">
                                แสดง {filteredData.length} จาก {tasks.length} รายการ
                            </span>
                            <SimplePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                        </div>
                    </>
                )}
            </div>

            {/* Cards - Mobile */}
            <div className="sm:hidden space-y-3">
                {loading ? (
                    <div className="glass-card p-8 text-center text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        กำลังโหลด...
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="glass-card p-8 text-center text-muted-foreground">
                        <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        ไม่พบรายการ
                    </div>
                ) : (
                    <>
                        {filteredData.map((item) => {
                            const config = statusConfig[item.status] || {
                                label: item.status,
                                color: "bg-gray-100 text-gray-700",
                                icon: Clock,
                            };
                            const StatusIcon = config.icon;
                            const progress = item.totalItems > 0 ? Math.round((item.receivedItems / item.totalItems) * 100) : 0;

                            return (
                                <div key={item.id} className="glass-card p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="font-semibold text-foreground">{item.docCode}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{item.senderName}</p>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
                                            <StatusIcon className="w-3 h-3" />
                                            {config.label}
                                        </span>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">จาก</span>
                                            <span className="font-medium">{item.fromWarehouse}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">ไป</span>
                                            <span className="font-medium">{item.toWarehouse}</span>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-muted-foreground">Progress</span>
                                                <span className="font-medium">{item.receivedItems}/{item.totalItems}</span>
                                            </div>
                                            <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleViewTask(item.documentId)}
                                        className="w-full py-2.5 rounded-lg bg-blue-50 text-blue-600 font-medium text-sm flex items-center justify-center gap-2"
                                    >
                                        <Eye className="w-4 h-4" />
                                        ดูรายละเอียด
                                    </button>
                                </div>
                            );
                        })}

                        {/* Mobile Pagination */}
                        <div className="flex justify-center items-center py-4">
                            <SimplePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}