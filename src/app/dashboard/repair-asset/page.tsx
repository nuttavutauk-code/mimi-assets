"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Calendar, Wrench, CheckCircle, Clock, X } from "lucide-react";

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

type ModalType = "complete" | null;

export default function RepairAssetPage() {
    const [tasks, setTasks] = useState<RepairTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [warehouse, setWarehouse] = useState<string>("");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    // Modal state
    const [modalType, setModalType] = useState<ModalType>(null);
    const [selectedTask, setSelectedTask] = useState<RepairTask | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/repair-asset/tasks?status=${filterStatus}`);
            const data = await res.json();

            if (data.success) {
                setTasks(data.tasks);
                setWarehouse(data.warehouse || "");
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

    const openModal = (task: RepairTask, type: ModalType) => {
        setSelectedTask(task);
        setModalType(type);
        setSelectedDate(format(new Date(), "yyyy-MM-dd"));
    };

    const closeModal = () => {
        setModalType(null);
        setSelectedTask(null);
        setSelectedDate("");
    };

    const handleCompleteRepair = async () => {
        if (!selectedTask || !selectedDate) return;

        try {
            setSubmitting(true);
            const res = await fetch("/api/repair-asset/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    taskId: selectedTask.id,
                    repairEndDate: selectedDate,
                }),
            });

            const data = await res.json();

            if (data.success) {
                toast.success("ซ่อมเสร็จสิ้นสำเร็จ");
                closeModal();
                fetchTasks();
            } else {
                toast.error(data.message || "เกิดข้อผิดพลาด");
            }
        } catch (error) {
            console.error("Error completing repair:", error);
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setSubmitting(false);
        }
    };

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

    const getActionButton = (task: RepairTask) => {
        switch (task.status) {
            case "pending":
                return (
                    <button
                        onClick={() => openModal(task, "complete")}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                    >
                        ซ่อมเสร็จ
                    </button>
                );
            case "completed":
                return (
                    <span className="text-sm text-gray-500">-</span>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-lg">กำลังโหลดข้อมูล...</div>
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
                        Repair Asset
                    </h1>
                    <p className="text-gray-600 mt-1">
                        โกดัง: <span className="font-medium">{warehouse || "ไม่ระบุ"}</span>
                    </p>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">สถานะ:</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">ทั้งหมด</option>
                        <option value="pending">รอดำเนินการ</option>
                        <option value="completed">ซ่อมเสร็จสิ้น</option>
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            {tasks.length === 0 ? (
                <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
                    ไม่พบรายการซ่อม
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden lg:block bg-white rounded-lg border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
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
                                            ผู้แจ้งซ่อม
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            วันที่แจ้ง
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            สถานะ
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                            ดำเนินการ
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {tasks.map((task) => (
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
                                                <div>{task.reporterName}</div>
                                                <div className="text-xs text-gray-500">
                                                    {task.reporterCompany}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {format(new Date(task.createdAt), "dd/MM/yyyy", {
                                                    locale: th,
                                                })}
                                            </td>
                                            <td className="px-4 py-3">{getStatusBadge(task.status)}</td>
                                            <td className="px-4 py-3 text-center">
                                                {getActionButton(task)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-3">
                        {tasks.map((task) => (
                            <div key={task.id} className="bg-white rounded-lg border p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="text-xs text-gray-500">เลขที่เอกสาร</p>
                                        <p className="font-semibold text-primary">{task.docCode}</p>
                                    </div>
                                    {getStatusBadge(task.status)}
                                </div>

                                <div className="space-y-2 text-sm mb-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Barcode:</span>
                                        <span className="font-mono text-gray-900">{task.barcode}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Asset Name:</span>
                                        <span className="text-gray-900">{task.assetName}</span>
                                    </div>
                                    {task.size && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Size:</span>
                                            <span className="text-gray-900">{task.size}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">ผู้แจ้งซ่อม:</span>
                                        <span className="text-gray-900">{task.reporterName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">บริษัท:</span>
                                        <span className="text-gray-900">{task.reporterCompany}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">วันที่แจ้ง:</span>
                                        <span className="text-gray-900">
                                            {format(new Date(task.createdAt), "dd/MM/yyyy", { locale: th })}
                                        </span>
                                    </div>
                                </div>

                                {task.status === "pending" && (
                                    <button
                                        onClick={() => openModal(task, "complete")}
                                        className="w-full py-2.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                                    >
                                        ซ่อมเสร็จ
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Modal */}
            {modalType && selectedTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="text-lg font-semibold">ซ่อมเสร็จสิ้น</h2>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-4 space-y-4">
                            {/* Asset Info */}
                            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Barcode:</span>
                                    <span className="text-sm font-medium">
                                        {selectedTask.barcode}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-500">Asset Name:</span>
                                    <span className="text-sm font-medium">
                                        {selectedTask.assetName}
                                    </span>
                                </div>
                                {selectedTask.size && (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Size:</span>
                                        <span className="text-sm font-medium">
                                            {selectedTask.size}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Date Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Calendar className="w-4 h-4 inline mr-1" />
                                    วันที่ซ่อมเสร็จ
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                            <button
                                onClick={closeModal}
                                disabled={submitting}
                                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleCompleteRepair}
                                disabled={submitting || !selectedDate}
                                className="px-4 py-2 text-sm text-white rounded-md disabled:opacity-50 bg-green-600 hover:bg-green-700"
                            >
                                {submitting ? "กำลังดำเนินการ..." : "ยืนยันซ่อมเสร็จ"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}