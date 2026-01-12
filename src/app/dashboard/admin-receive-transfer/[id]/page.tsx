"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Package, FileText, CheckCircle, XCircle, Image as ImageIcon } from "lucide-react";

interface TransferTask {
    id: number;
    barcode: string;
    assetName: string;
    size: string | null;
    qty: number;
    status: string;
    rejectReason: string | null;
    assetImageUrl: string | null;
}

interface TransferDocument {
    id: number;
    docCode: string;
    fromWarehouse: string;
    toWarehouse: string;
    senderName: string;
    senderPhone: string;
    transferDate: string;
    operationType: string;
    transferDocImage: string | null;
    status: string;
}

export default function AdminReceiveTransferDetailPage() {
    const params = useParams();
    const router = useRouter();
    const documentId = parseInt(params.id as string);

    const [document, setDocument] = useState<TransferDocument | null>(null);
    const [tasks, setTasks] = useState<TransferTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [documentId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/receive-transfer/${documentId}`);
            const data = await res.json();

            if (data.success) {
                setDocument(data.document);
                setTasks(data.tasks);
            } else {
                alert("เกิดข้อผิดพลาด: " + data.message);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            alert("ไม่สามารถโหลดข้อมูลได้");
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "received":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        รับแล้ว
                    </span>
                );
            case "rejected":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        ปฏิเสธ
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        รอรับของ
                    </span>
                );
        }
    };

    const getOperationType = () => {
        switch (document?.operationType) {
            case "TO_REPAIR":
                return "ส่งซ่อม";
            case "FROM_REPAIR":
                return "รับกลับจากซ่อม";
            case "TRANSFER":
            default:
                return "โอนย้าย";
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("th-TH", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                    <p className="mt-2 text-gray-500">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    if (!document) {
        return (
            <div className="p-6">
                <p className="text-center text-gray-500">ไม่พบข้อมูล</p>
            </div>
        );
    }

    const receivedCount = tasks.filter((t) => t.status === "received").length;
    const rejectedCount = tasks.filter((t) => t.status === "rejected").length;
    const pendingCount = tasks.filter((t) => t.status === "pending").length;

    return (
        <div className="p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">รับของโอนย้าย</h1>
                        <p className="text-sm text-muted-foreground">{document.docCode} (Admin View)</p>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{receivedCount}</p>
                    <p className="text-sm text-muted-foreground">รับแล้ว</p>
                </div>
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
                    <p className="text-sm text-muted-foreground">ปฏิเสธ</p>
                </div>
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                    <p className="text-sm text-muted-foreground">รอรับ</p>
                </div>
            </div>

            {/* Document Info */}
            <div className="glass-card p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-cyan-600" />
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
                        <span className="text-muted-foreground">ไปโกดัง:</span>
                        <p className="font-medium">{document.toWarehouse}</p>
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

            {/* Document Image */}
            {document.transferDocImage && (
                <div className="glass-card p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <ImageIcon className="w-5 h-5 text-purple-600" />
                        <h2 className="font-semibold">รูปเอกสารใบย้ายของ</h2>
                    </div>
                    <button
                        onClick={() => setPreviewImage(document.transferDocImage)}
                        className="w-32 h-32 border rounded-lg overflow-hidden hover:opacity-80 transition"
                    >
                        <img src={document.transferDocImage} alt="เอกสาร" className="w-full h-full object-cover" />
                    </button>
                </div>
            )}

            {/* Assets */}
            <div className="glass-card p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Package className="w-5 h-5 text-orange-600" />
                    <h2 className="font-semibold">รายการ Asset ({tasks.length} รายการ)</h2>
                </div>

                <div className="space-y-4">
                    {tasks.map((task, idx) => (
                        <div
                            key={task.id}
                            className={`border rounded-xl p-4 space-y-3 ${
                                task.status === "rejected" ? "bg-red-50 border-red-200" : 
                                task.status === "received" ? "bg-green-50 border-green-200" : "bg-white"
                            }`}
                        >
                            {/* Status Badge */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">รายการ #{idx + 1}</span>
                                {getStatusBadge(task.status)}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground">Barcode</label>
                                    <Input value={task.barcode} readOnly className="bg-gray-50 text-sm" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-muted-foreground">Asset Name</label>
                                    <Input value={task.assetName} readOnly className="bg-gray-50 text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">Size</label>
                                    <Input value={task.size || "-"} readOnly className="bg-gray-50 text-sm" />
                                </div>
                            </div>

                            {/* Reject Reason */}
                            {task.status === "rejected" && task.rejectReason && (
                                <div className="bg-red-100 rounded-lg p-3">
                                    <p className="text-xs text-red-600 font-medium">เหตุผลที่ปฏิเสธ:</p>
                                    <p className="text-sm text-red-800">{task.rejectReason}</p>
                                </div>
                            )}

                            {/* Asset Image */}
                            {task.assetImageUrl && (
                                <div>
                                    <label className="text-xs text-muted-foreground block mb-2">รูป Asset</label>
                                    <button
                                        onClick={() => setPreviewImage(task.assetImageUrl)}
                                        className="w-20 h-20 border rounded-lg overflow-hidden hover:opacity-80 transition"
                                    >
                                        <img src={task.assetImageUrl} alt="Asset" className="w-full h-full object-cover" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        />
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white"
                        >
                            <XCircle className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}

            {/* Back Button */}
            <div className="flex justify-center pb-8">
                <Button type="button" variant="outline" className="px-12 py-3" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    กลับ
                </Button>
            </div>
        </div>
    );
}