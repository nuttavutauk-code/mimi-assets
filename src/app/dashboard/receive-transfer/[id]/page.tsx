"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Package, ArrowLeft, CheckCircle, XCircle, Camera, FileText, Save, Clock, AlertTriangle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Task = {
    id: number;
    pickAssetTaskId: number;
    barcode: string;
    assetName: string;
    size: string | null;
    grade: string | null;
    status: "pending" | "received" | "rejected";
    rejectReason: string | null;
    assetImageUrl: string | null;
};

type DocumentInfo = {
    id: number;
    docCode: string;
    documentType: string;
    fromWarehouse: string;
    senderName: string;
    senderPhone: string;
    operation: string | null;
    otherDetail: string | null;
    transferDate: string;
    transferDocImageUrl: string | null;
};

const REJECT_REASONS = [
    "ของเสียหาย",
    "ของไม่ตรงกับรายการ",
    "Barcode ไม่ตรง",
    "อื่นๆ",
];

export default function ReceiveTransferDetailPage() {
    const params = useParams();
    const router = useRouter();
    const documentId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [document, setDocument] = useState<DocumentInfo | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [localStatus, setLocalStatus] = useState<Record<number, "pending" | "received" | "rejected">>({});
    const [localRejectReason, setLocalRejectReason] = useState<Record<number, string>>({});
    const [localAssetImages, setLocalAssetImages] = useState<Record<number, string>>({});
    const [transferDocImage, setTransferDocImage] = useState<string>("");

    // Popup state
    const [showRejectPopup, setShowRejectPopup] = useState(false);
    const [rejectingTaskId, setRejectingTaskId] = useState<number | null>(null);
    const [selectedRejectReason, setSelectedRejectReason] = useState("");
    const [otherRejectReason, setOtherRejectReason] = useState("");

    // Image preview state
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Image upload refs
    const docImageInputRef = useRef<HTMLInputElement>(null);
    const assetImageInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    useEffect(() => {
        fetchDetail();
    }, [documentId]);

    const fetchDetail = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/receive-transfer/${documentId}`);
            const data = await res.json();
            if (data.success) {
                setDocument(data.document);
                setTasks(data.tasks);
                setTransferDocImage(data.document.transferDocImageUrl || "");

                // Initialize local state
                const statusMap: Record<number, "pending" | "received" | "rejected"> = {};
                const rejectMap: Record<number, string> = {};
                const imageMap: Record<number, string> = {};
                data.tasks.forEach((t: Task) => {
                    statusMap[t.id] = t.status;
                    rejectMap[t.id] = t.rejectReason || "";
                    imageMap[t.id] = t.assetImageUrl || "";
                });
                setLocalStatus(statusMap);
                setLocalRejectReason(rejectMap);
                setLocalAssetImages(imageMap);
            }
        } catch (error) {
            console.error("Error fetching detail:", error);
            toast.error("ไม่สามารถโหลดข้อมูลได้");
        } finally {
            setLoading(false);
        }
    };

    const handleReceive = (taskId: number) => {
        setLocalStatus((prev) => ({ ...prev, [taskId]: "received" }));
        setLocalRejectReason((prev) => ({ ...prev, [taskId]: "" }));
    };

    const handleOpenRejectPopup = (taskId: number) => {
        setRejectingTaskId(taskId);
        setSelectedRejectReason("");
        setOtherRejectReason("");
        setShowRejectPopup(true);
    };

    const handleConfirmReject = () => {
        if (!rejectingTaskId) return;
        const reason = selectedRejectReason === "อื่นๆ" ? otherRejectReason : selectedRejectReason;
        if (!reason.trim()) {
            toast.error("กรุณาระบุเหตุผลที่ปฏิเสธ");
            return;
        }
        setLocalStatus((prev) => ({ ...prev, [rejectingTaskId]: "rejected" }));
        setLocalRejectReason((prev) => ({ ...prev, [rejectingTaskId]: reason }));
        setShowRejectPopup(false);
        setRejectingTaskId(null);
    };

    const handleImageUpload = async (file: File, type: "doc" | "asset", taskId?: number) => {
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/upload/image", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (data.success && data.url) {
                if (type === "doc") {
                    setTransferDocImage(data.url);
                    // Save immediately
                    await fetch(`/api/receive-transfer/${documentId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ transferDocImageUrl: data.url }),
                    });
                } else if (type === "asset" && taskId) {
                    setLocalAssetImages((prev) => ({ ...prev, [taskId]: data.url }));
                }
                toast.success("อัปโหลดรูปสำเร็จ");
            }
        } catch (error) {
            console.error("Error uploading image:", error);
            toast.error("อัปโหลดรูปไม่สำเร็จ");
        }
    };

    const handleSave = async () => {
        // เช็คว่าทุก task ถูกตัดสินใจแล้ว
        const pendingTasks = Object.entries(localStatus).filter(([_, status]) => status === "pending");
        if (pendingTasks.length > 0) {
            toast.error(`กรุณาตัดสินใจรับของหรือปฏิเสธให้ครบทุกรายการ (เหลือ ${pendingTasks.length} รายการ)`);
            return;
        }

        if (!confirm("ยืนยันการบันทึก? รายการที่รับของจะสร้าง Transaction ขาเข้า รายการที่ปฏิเสธจะถูกยกเลิก")) {
            return;
        }

        try {
            setSaving(true);

            const tasksData = tasks.map((t) => ({
                id: t.id,
                status: localStatus[t.id],
                rejectReason: localRejectReason[t.id] || null,
                assetImageUrl: localAssetImages[t.id] || null,
            }));

            const res = await fetch("/api/receive-transfer/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId: parseInt(documentId), tasks: tasksData }),
            });

            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                router.push("/dashboard/receive-transfer");
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error("Error saving:", error);
            toast.error("ไม่สามารถบันทึกได้");
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        return date.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const getOperationType = () => {
        if (!document) return "-";
        if (document.operation === "อื่นๆ" && document.otherDetail) {
            return document.otherDetail;
        }
        return document.operation || "-";
    };

    const allDecided = Object.values(localStatus).every((s) => s !== "pending");
    const isReadOnly = tasks.every((t) => t.status !== "pending");

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-muted-foreground">กำลังโหลด...</div>
            </div>
        );
    }

    if (!document) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-muted-foreground">ไม่พบข้อมูล</div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-black/5">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="icon-container blue !w-10 !h-10">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">รับของโอนย้าย</h1>
                        <p className="text-sm text-muted-foreground">{document.docCode}</p>
                    </div>
                </div>
            </div>

            {/* Document Info Card */}
            <div className="glass-card p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="icon-container cyan !w-8 !h-8">
                        <FileText className="w-4 h-4" />
                    </div>
                    <h2 className="font-semibold">ข้อมูลเอกสาร</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                        <span className="text-muted-foreground">เลขที่เอกสาร:</span>
                        <p className="font-medium">{document.docCode}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">จากโกดัง:</span>
                        <p className="font-medium">{document.fromWarehouse}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">ผู้ส่ง:</span>
                        <p className="font-medium">{document.senderName}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">เบอร์โทร:</span>
                        <p className="font-medium">{document.senderPhone}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">ประเภทการย้าย:</span>
                        <p className="font-medium">{getOperationType()}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground">วันที่โอนย้าย:</span>
                        <p className="font-medium">{formatDate(document.transferDate)}</p>
                    </div>
                </div>
            </div>

            {/* Document Image Card */}
            <div className="glass-card p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="icon-container purple !w-8 !h-8">
                        <Camera className="w-4 h-4" />
                    </div>
                    <h2 className="font-semibold">รูปเอกสารใบย้ายของ</h2>
                </div>
                <div className="flex items-center gap-4">
                    {transferDocImage ? (
                        <div className="relative">
                            <img 
                                src={transferDocImage} 
                                alt="เอกสาร" 
                                className="w-32 h-32 object-cover rounded-lg border cursor-pointer hover:scale-105 hover:shadow-lg transition-all" 
                                onClick={() => setPreviewImage(transferDocImage)}
                            />
                            {!isReadOnly && (
                                <button
                                    onClick={() => setTransferDocImage("")}
                                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => docImageInputRef.current?.click()}
                            disabled={isReadOnly}
                            className="w-32 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-black/5 disabled:opacity-50"
                        >
                            <Camera className="w-6 h-6" />
                            <span className="text-xs">ถ่ายรูป</span>
                        </button>
                    )}
                    <input
                        ref={docImageInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file, "doc");
                        }}
                    />
                </div>
            </div>

            {/* Assets Card */}
            <div className="glass-card p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="icon-container orange !w-8 !h-8">
                        <Package className="w-4 h-4" />
                    </div>
                    <h2 className="font-semibold">รายการ Asset</h2>
                    <span className="text-xs text-muted-foreground">({tasks.length} รายการ)</span>
                </div>

                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto rounded-xl border border-black/10 shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider rounded-tl-xl">#</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Asset Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Size</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Barcode</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">รูป Asset</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">สถานะ</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">เหตุผลที่ปฏิเสธ</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider rounded-tr-xl">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {tasks.map((task, index) => {
                                const status = localStatus[task.id] || task.status;
                                const rejectReason = localRejectReason[task.id] || task.rejectReason || "";
                                const assetImage = localAssetImages[task.id] || task.assetImageUrl || "";
                                const taskReadOnly = task.status !== "pending";
                                const isLast = index === tasks.length - 1;

                                return (
                                    <tr key={task.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                                        <td className={`px-4 py-4 text-gray-500 ${isLast ? 'rounded-bl-xl' : ''}`}>{index + 1}</td>
                                        <td className="px-4 py-4 font-medium text-gray-900">{task.assetName}</td>
                                        <td className="px-4 py-4 text-gray-600">{task.size || "-"}</td>
                                        <td className="px-4 py-4">
                                            <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-1 rounded-lg">{task.barcode}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-center">
                                                {assetImage ? (
                                                    <img 
                                                        src={assetImage} 
                                                        alt="Asset" 
                                                        className="w-12 h-12 object-cover rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer hover:scale-110 hover:shadow-lg transition-all" 
                                                        onClick={() => setPreviewImage(assetImage)}
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => assetImageInputRefs.current[task.id]?.click()}
                                                        disabled={taskReadOnly}
                                                        className="w-12 h-12 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-primary hover:text-primary transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-gray-300 disabled:hover:text-gray-400"
                                                    >
                                                        <Camera className="w-5 h-5" />
                                                    </button>
                                                )}
                                                <input
                                                    ref={(el) => { assetImageInputRefs.current[task.id] = el; }}
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleImageUpload(file, "asset", task.id);
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {status === "pending" && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 shadow-sm">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    รอตรวจสอบ
                                                </span>
                                            )}
                                            {status === "received" && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 shadow-sm">
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    รับแล้ว
                                                </span>
                                            )}
                                            {status === "rejected" && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 shadow-sm">
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    ปฏิเสธ
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-red-600 text-sm">{rejectReason || "-"}</td>
                                        <td className={`px-4 py-4 ${isLast ? 'rounded-br-xl' : ''}`}>
                                            {!taskReadOnly && status === "pending" && (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleReceive(task.id)}
                                                        className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600 hover:bg-emerald-200 hover:scale-105 transition-all shadow-sm"
                                                        title="รับของ"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenRejectPopup(task.id)}
                                                        className="p-2.5 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 hover:scale-105 transition-all shadow-sm"
                                                        title="ปฏิเสธ"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                            {!taskReadOnly && status !== "pending" && (
                                                <button
                                                    onClick={() => setLocalStatus((prev) => ({ ...prev, [task.id]: "pending" }))}
                                                    className="text-xs font-medium text-primary hover:underline"
                                                >
                                                    เปลี่ยน
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-3">
                    {tasks.map((task, index) => {
                        const status = localStatus[task.id] || task.status;
                        const rejectReason = localRejectReason[task.id] || task.rejectReason || "";
                        const assetImage = localAssetImages[task.id] || task.assetImageUrl || "";
                        const taskReadOnly = task.status !== "pending";

                        return (
                            <div key={task.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <p className="text-xs text-muted-foreground">#{index + 1}</p>
                                        <p className="font-semibold text-gray-900">{task.assetName}</p>
                                        <p className="text-sm text-muted-foreground">{task.size || "-"}</p>
                                    </div>
                                    <div>
                                        {status === "pending" && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                                <Clock className="w-3 h-3" />
                                                รอตรวจสอบ
                                            </span>
                                        )}
                                        {status === "received" && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                                <CheckCircle className="w-3 h-3" />
                                                รับแล้ว
                                            </span>
                                        )}
                                        {status === "rejected" && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                <XCircle className="w-3 h-3" />
                                                ปฏิเสธ
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex-shrink-0">
                                        {assetImage ? (
                                            <img 
                                                src={assetImage} 
                                                alt="Asset" 
                                                className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer" 
                                                onClick={() => setPreviewImage(assetImage)}
                                            />
                                        ) : (
                                            <button
                                                onClick={() => assetImageInputRefs.current[task.id]?.click()}
                                                disabled={taskReadOnly}
                                                className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 disabled:opacity-50"
                                            >
                                                <Camera className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-muted-foreground">Barcode</p>
                                        <p className="font-mono text-sm bg-primary/10 text-primary px-2 py-1 rounded-lg inline-block">{task.barcode}</p>
                                    </div>
                                </div>

                                {rejectReason && (
                                    <div className="mb-3 p-2 bg-red-50 rounded-lg">
                                        <p className="text-xs text-red-600">เหตุผลที่ปฏิเสธ: {rejectReason}</p>
                                    </div>
                                )}

                                {!taskReadOnly && status === "pending" && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleReceive(task.id)}
                                            className="flex-1 py-2 rounded-xl bg-emerald-100 text-emerald-600 hover:bg-emerald-200 text-sm font-medium flex items-center justify-center gap-1"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            รับของ
                                        </button>
                                        <button
                                            onClick={() => handleOpenRejectPopup(task.id)}
                                            className="flex-1 py-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 text-sm font-medium flex items-center justify-center gap-1"
                                        >
                                            <XCircle className="w-4 h-4" />
                                            ปฏิเสธ
                                        </button>
                                    </div>
                                )}
                                {!taskReadOnly && status !== "pending" && (
                                    <button
                                        onClick={() => setLocalStatus((prev) => ({ ...prev, [task.id]: "pending" }))}
                                        className="w-full py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg"
                                    >
                                        เปลี่ยน
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Save Button */}
            {!isReadOnly && (
                <div className="flex justify-end gap-3">
                    <button onClick={() => router.back()} className="glass-button px-6 py-2">
                        ← กลับ
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!allDecided || saving}
                        className="gradient-button px-8 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? "กำลังบันทึก..." : "บันทึกการรับของ"}
                    </button>
                </div>
            )}

            {/* Reject Popup */}
            {showRejectPopup && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="icon-container red !w-8 !h-8">
                                <XCircle className="w-4 h-4" />
                            </div>
                            <h3 className="font-semibold">ปฏิเสธรับของ</h3>
                        </div>

                        {rejectingTaskId && (
                            <div className="mb-4 p-3 bg-black/5 rounded-lg">
                                <p className="text-sm">
                                    <span className="text-muted-foreground">Asset: </span>
                                    <span className="font-medium">{tasks.find((t) => t.id === rejectingTaskId)?.assetName}</span>
                                </p>
                                <p className="text-sm">
                                    <span className="text-muted-foreground">Barcode: </span>
                                    <span className="font-mono text-primary">{tasks.find((t) => t.id === rejectingTaskId)?.barcode}</span>
                                </p>
                            </div>
                        )}

                        <div className="space-y-3 mb-6">
                            <label className="block text-sm font-medium">เหตุผลที่ปฏิเสธ: <span className="text-red-500">*</span></label>
                            {REJECT_REASONS.map((reason) => (
                                <label key={reason} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="rejectReason"
                                        value={reason}
                                        checked={selectedRejectReason === reason}
                                        onChange={(e) => setSelectedRejectReason(e.target.value)}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm">{reason}</span>
                                </label>
                            ))}
                            {selectedRejectReason === "อื่นๆ" && (
                                <Input
                                    placeholder="ระบุเหตุผล..."
                                    value={otherRejectReason}
                                    onChange={(e) => setOtherRejectReason(e.target.value)}
                                    className="glass-input mt-2"
                                />
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRejectPopup(false)}
                                className="flex-1 glass-button py-2"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleConfirmReject}
                                className="flex-1 glass-button-primary py-2 bg-red-500 hover:bg-red-600"
                            >
                                ยืนยันปฏิเสธ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewImage && (
                <div 
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full">
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <img 
                            src={previewImage} 
                            alt="Preview" 
                            className="w-full h-full object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}