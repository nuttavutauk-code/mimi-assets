"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Wrench, CheckCircle, Clock, Eye, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SimplePagination } from "@/components/ui/SimplePagination";

interface RepairTask {
    id: number;
    documentId: number;
    docCode: string;
    barcode: string;
    assetName: string;
    size: string | null;
    grade: string | null;
    repairWarehouse: string;
    reporterName: string | null;
    reporterCompany: string | null;
    reporterPhone: string | null;
    status: string;
    repairStartDate: string | null;
    repairEndDate: string | null;
    createdAt: string;
    completedAt: string | null;
}

export default function AdminRepairAsset() {
    const [tasks, setTasks] = useState<RepairTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Modal state สำหรับดูรายละเอียด
    const [selectedTask, setSelectedTask] = useState<RepairTask | null>(null);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            // ✅ เรียก API แบบ admin (ดูทุกรายการทุกโกดัง)
            const res = await fetch(`/api/repair-asset/all-tasks?status=${filterStatus}`);
            const data = await res.json();

            if (data.success) {
                setTasks(data.tasks);
            } else {
                toast.error(data.message || "เกิดข้อผิดพลาด");
            }
        } catch (error) {
            console.error("Error fetching tasks:", error);
            toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [filterStatus]);

    const filteredTasks = tasks.filter(
        (task) =>
            task.docCode.toLowerCase().includes(search.toLowerCase()) ||
            task.barcode.toLowerCase().includes(search.toLowerCase()) ||
            task.assetName.toLowerCase().includes(search.toLowerCase()) ||
            task.repairWarehouse.toLowerCase().includes(search.toLowerCase()) ||
            (task.reporterName || "").toLowerCase().includes(search.toLowerCase())
    );

    const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
    const paginatedTasks = filteredTasks.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3" />
                        รอดำเนินการ
                    </span>
                );
            case "completed":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        ซ่อมเสร็จสิ้น
                    </span>
                );
            default:
                return <span>{status}</span>;
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                    <p className="mt-2 text-gray-500">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Wrench className="w-6 h-6" />
                        Repair Asset (Admin View)
                    </h1>
                    <p className="text-gray-600 mt-1">ดูรายการซ่อมทั้งหมด (View Only)</p>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => {
                            setFilterStatus(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">ทั้งหมด</option>
                        <option value="pending">รอดำเนินการ</option>
                        <option value="completed">ซ่อมเสร็จสิ้น</option>
                    </select>
                </div>
            </div>

            {/* Search */}
            <div className="glass-card p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        placeholder="ค้นหาเลขที่เอกสาร, Barcode, Asset Name, โกดัง, ผู้แจ้งซ่อม..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-yellow-600" />
                        <span className="text-sm text-yellow-800">รอดำเนินการ</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-900 mt-2">
                        {tasks.filter((t) => t.status === "pending").length}
                    </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-green-800">ซ่อมเสร็จสิ้น</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900 mt-2">
                        {tasks.filter((t) => t.status === "completed").length}
                    </p>
                </div>
            </div>

            {/* Table */}
            {paginatedTasks.length === 0 ? (
                <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
                    ไม่พบรายการซ่อม
                </div>
            ) : (
                <div className="bg-white rounded-lg border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px]">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        เลขที่เอกสาร
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Barcode
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Asset Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        โกดังซ่อม
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        ผู้แจ้งซ่อม
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        วันที่แจ้ง
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        วันที่ซ่อมเสร็จ
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        สถานะ
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                        ดูรายละเอียด
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {paginatedTasks.map((task) => (
                                    <tr key={task.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            {task.docCode}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {task.barcode}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            <div>{task.assetName}</div>
                                            {task.size && (
                                                <div className="text-xs text-gray-500">
                                                    Size: {task.size}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {task.repairWarehouse}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            <div>{task.reporterName || "-"}</div>
                                            <div className="text-xs text-gray-500">
                                                {task.reporterCompany || ""}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {format(new Date(task.createdAt), "dd/MM/yyyy", {
                                                locale: th,
                                            })}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {task.repairEndDate
                                                ? format(new Date(task.repairEndDate), "dd/MM/yyyy", { locale: th })
                                                : "-"}
                                        </td>
                                        <td className="px-4 py-3">{getStatusBadge(task.status)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setSelectedTask(task)}
                                                className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                                                title="ดูรายละเอียด"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center p-4 border-t">
                        <span className="text-sm text-gray-500">
                            แสดง {paginatedTasks.length} จาก {filteredTasks.length} รายการ
                        </span>
                        <SimplePagination currentPage={currentPage} totalPages={totalPages || 1} onPageChange={setCurrentPage} />
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
                            <h2 className="text-lg font-semibold">รายละเอียดการซ่อม</h2>
                            <button
                                onClick={() => setSelectedTask(null)}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-4 space-y-4">
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">เลขที่เอกสาร:</span>
                                    <span className="text-sm font-medium">{selectedTask.docCode}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Barcode:</span>
                                    <span className="text-sm font-medium">{selectedTask.barcode}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Asset Name:</span>
                                    <span className="text-sm font-medium">{selectedTask.assetName}</span>
                                </div>
                                {selectedTask.size && (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Size:</span>
                                        <span className="text-sm font-medium">{selectedTask.size}</span>
                                    </div>
                                )}
                                {selectedTask.grade && (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Grade:</span>
                                        <span className="text-sm font-medium">{selectedTask.grade}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">โกดังซ่อม:</span>
                                    <span className="text-sm font-medium">{selectedTask.repairWarehouse}</span>
                                </div>
                            </div>

                            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                                <h3 className="font-medium text-blue-800">ข้อมูลผู้แจ้งซ่อม</h3>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">ชื่อ:</span>
                                    <span className="text-sm font-medium">{selectedTask.reporterName || "-"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">บริษัท:</span>
                                    <span className="text-sm font-medium">{selectedTask.reporterCompany || "-"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">โทรศัพท์:</span>
                                    <span className="text-sm font-medium">{selectedTask.reporterPhone || "-"}</span>
                                </div>
                            </div>

                            <div className="bg-green-50 rounded-lg p-4 space-y-3">
                                <h3 className="font-medium text-green-800">วันที่</h3>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">วันที่แจ้งซ่อม:</span>
                                    <span className="text-sm font-medium">
                                        {format(new Date(selectedTask.createdAt), "dd/MM/yyyy HH:mm", { locale: th })}
                                    </span>
                                </div>
                                {selectedTask.repairStartDate && (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">วันที่เริ่มซ่อม:</span>
                                        <span className="text-sm font-medium">
                                            {format(new Date(selectedTask.repairStartDate), "dd/MM/yyyy", { locale: th })}
                                        </span>
                                    </div>
                                )}
                                {selectedTask.repairEndDate && (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">วันที่ซ่อมเสร็จ:</span>
                                        <span className="text-sm font-medium">
                                            {format(new Date(selectedTask.repairEndDate), "dd/MM/yyyy", { locale: th })}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-center">
                                {getStatusBadge(selectedTask.status)}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t bg-gray-50">
                            <button
                                onClick={() => setSelectedTask(null)}
                                className="w-full px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}