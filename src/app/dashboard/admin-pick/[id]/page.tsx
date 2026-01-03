"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Eye, CheckCircle, XCircle, Image as ImageIcon } from "lucide-react";

interface Asset {
    id: number;
    assetName: string;
    size: string | null;
    grade: string | null;
    qty: number;
    barcode: string | null;
    barcodeImageUrl: string | null;
    assetImageUrl: string | null;
    status: string;
}

interface TaskDetail {
    documentId: number;
    docCode: string;
    requester: {
        name: string;
        company: string;
        phone: string;
    };
    shop: {
        code: string;
        name: string;
        startInstallDate: string;
        endInstallDate: string;
        q7b7: string;
        shopFocus: string;
    };
    assets: Asset[];
    securitySets: Asset[];
    summary: {
        totalItems: number;
        completedItems: number;
        pendingItems: number;
    };
}

export default function AdminPickDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const documentId = parseInt(params.id as string);
    const shopCode = searchParams.get("shopCode") || "";

    const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        fetchTaskDetail();
    }, [documentId, shopCode]);

    const fetchTaskDetail = async () => {
        try {
            setLoading(true);
            const url = shopCode
                ? `/api/pick-asset/task/${documentId}?shopCode=${encodeURIComponent(shopCode)}`
                : `/api/pick-asset/task/${documentId}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                setTaskDetail(data);
            } else {
                alert("เกิดข้อผิดพลาด: " + data.message);
            }
        } catch (error) {
            console.error("Error fetching task detail:", error);
            alert("ไม่สามารถโหลดข้อมูลได้");
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        เสร็จสิ้น
                    </span>
                );
            case "cancelled":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        ยกเลิก
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        รอดำเนินการ
                    </span>
                );
        }
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

    if (!taskDetail) {
        return (
            <div className="p-6">
                <p className="text-center text-gray-500">ไม่พบข้อมูล</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-semibold">Pick Asset - {taskDetail.docCode}</h1>
                    <p className="text-sm text-muted-foreground">Admin View Only (ไม่สามารถแก้ไขได้)</p>
                </div>
            </div>

            {/* Progress */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-600">ความคืบหน้า</p>
                        <p className="text-2xl font-bold">
                            {taskDetail.summary.completedItems} / {taskDetail.summary.totalItems}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-600">สถานะ</p>
                        <p
                            className={`text-lg font-semibold ${taskDetail.summary.completedItems === taskDetail.summary.totalItems
                                ? "text-green-600"
                                : "text-yellow-600"
                                }`}
                        >
                            {taskDetail.summary.completedItems === taskDetail.summary.totalItems
                                ? "พร้อม Complete"
                                : "กำลังดำเนินการ"}
                        </p>
                    </div>
                </div>
            </div>

            {/* ข้อมูลผู้เบิก */}
            <div className="glass-card p-5">
                <h2 className="font-semibold mb-4">ข้อมูลผู้เบิก</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-sm text-gray-600">เอกสารเลขที่</label>
                        <Input value={taskDetail.docCode} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600">ชื่อผู้เบิก</label>
                        <Input value={taskDetail.requester.name} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600">บริษัท</label>
                        <Input value={taskDetail.requester.company} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600">เบอร์โทรศัพท์</label>
                        <Input value={taskDetail.requester.phone} readOnly className="bg-gray-50" />
                    </div>
                </div>
            </div>

            {/* ข้อมูล Shop */}
            <div className="glass-card p-5">
                <h2 className="font-semibold mb-4">ข้อมูล Shop</h2>
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
                        <div className="w-full md:flex-1">
                            <label className="text-sm text-gray-600">MCS Code</label>
                            <Input value={taskDetail.shop.code} readOnly className="bg-gray-50" />
                        </div>
                        <div className="w-full md:flex-[2]">
                            <label className="text-sm text-gray-600">Shop Name</label>
                            <Input value={taskDetail.shop.name} readOnly className="bg-gray-50" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm text-gray-600">วันที่เริ่มติดตั้ง</label>
                            <Input
                                value={
                                    taskDetail.shop.startInstallDate
                                        ? new Date(taskDetail.shop.startInstallDate).toLocaleDateString("th-TH")
                                        : "-"
                                }
                                readOnly
                                className="bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">วันที่ติดตั้งเสร็จ</label>
                            <Input
                                value={
                                    taskDetail.shop.endInstallDate
                                        ? new Date(taskDetail.shop.endInstallDate).toLocaleDateString("th-TH")
                                        : "-"
                                }
                                readOnly
                                className="bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">Q7B7</label>
                            <Input value={taskDetail.shop.q7b7 || "-"} readOnly className="bg-gray-50" />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">Shop Focus</label>
                            <Input value={taskDetail.shop.shopFocus || "-"} readOnly className="bg-gray-50" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Asset */}
            {taskDetail.assets.length > 0 && (
                <div className="glass-card p-5">
                    <h2 className="font-semibold mb-4">Asset ({taskDetail.assets.length} รายการ)</h2>
                    <div className="space-y-4">
                        {taskDetail.assets.map((asset, idx) => (
                            <div key={asset.id} className={`border rounded-xl p-6 space-y-4 ${asset.status === "cancelled" ? "bg-gray-100 opacity-60" : "bg-white"}`}>
                                {/* Status Badge */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Asset #{idx + 1}</span>
                                    {getStatusBadge(asset.status)}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Barcode</label>
                                        <Input value={asset.barcode || "-"} readOnly className="bg-gray-50" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-medium mb-2 block">Asset Name</label>
                                        <Input value={asset.assetName} readOnly className="bg-gray-50" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Size</label>
                                        <Input value={asset.size || "-"} readOnly className="bg-gray-50" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">จำนวน</label>
                                        <Input value={asset.qty} readOnly className="text-center bg-gray-50" />
                                    </div>
                                </div>

                                {/* Images */}
                                <div className="flex flex-wrap gap-4">
                                    {asset.barcodeImageUrl && (
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">รูป Barcode</label>
                                            <button
                                                onClick={() => setPreviewImage(asset.barcodeImageUrl)}
                                                className="w-24 h-24 border rounded-lg overflow-hidden hover:opacity-80 transition"
                                            >
                                                <img src={asset.barcodeImageUrl} alt="Barcode" className="w-full h-full object-cover" />
                                            </button>
                                        </div>
                                    )}
                                    {asset.assetImageUrl && (
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">รูป Asset</label>
                                            <button
                                                onClick={() => setPreviewImage(asset.assetImageUrl)}
                                                className="w-24 h-24 border rounded-lg overflow-hidden hover:opacity-80 transition"
                                            >
                                                <img src={asset.assetImageUrl} alt="Asset" className="w-full h-full object-cover" />
                                            </button>
                                        </div>
                                    )}
                                    {!asset.barcodeImageUrl && !asset.assetImageUrl && asset.status !== "cancelled" && (
                                        <div className="text-sm text-gray-400 flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4" />
                                            ยังไม่มีรูปภาพ
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Security Set */}
            {taskDetail.securitySets.length > 0 && (
                <div className="glass-card p-5">
                    <h2 className="font-semibold mb-4">Security Set ({taskDetail.securitySets.length} รายการ)</h2>
                    <div className="space-y-4">
                        {taskDetail.securitySets.map((security, idx) => {
                            const isSecurityTypeC = security.assetName.includes("Security Type C");

                            return (
                                <div key={security.id} className={`border rounded-xl p-6 space-y-4 ${security.status === "cancelled" ? "bg-gray-100 opacity-60" : "bg-white"}`}>
                                    {/* Status Badge */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Security #{idx + 1}</span>
                                        {getStatusBadge(security.status)}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        {!isSecurityTypeC && (
                                            <div>
                                                <label className="text-sm font-medium mb-2 block">Barcode</label>
                                                <Input value={security.barcode || "-"} readOnly className="bg-gray-50" />
                                            </div>
                                        )}
                                        <div className={isSecurityTypeC ? "md:col-span-4" : "md:col-span-2"}>
                                            <label className="text-sm font-medium mb-2 block">Asset Name</label>
                                            <Input value={security.assetName} readOnly className="bg-gray-50" />
                                        </div>
                                        {!isSecurityTypeC && (
                                            <div>
                                                <label className="text-sm font-medium mb-2 block">จำนวน</label>
                                                <Input value={security.qty} readOnly className="text-center bg-gray-50" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Images */}
                                    <div className="flex flex-wrap gap-4">
                                        {security.barcodeImageUrl && (
                                            <div>
                                                <label className="text-sm font-medium mb-2 block">รูป Barcode</label>
                                                <button
                                                    onClick={() => setPreviewImage(security.barcodeImageUrl)}
                                                    className="w-24 h-24 border rounded-lg overflow-hidden hover:opacity-80 transition"
                                                >
                                                    <img src={security.barcodeImageUrl} alt="Barcode" className="w-full h-full object-cover" />
                                                </button>
                                            </div>
                                        )}
                                        {security.assetImageUrl && (
                                            <div>
                                                <label className="text-sm font-medium mb-2 block">รูป Asset</label>
                                                <button
                                                    onClick={() => setPreviewImage(security.assetImageUrl)}
                                                    className="w-24 h-24 border rounded-lg overflow-hidden hover:opacity-80 transition"
                                                >
                                                    <img src={security.assetImageUrl} alt="Asset" className="w-full h-full object-cover" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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
                <Button
                    type="button"
                    variant="outline"
                    className="px-12 py-3"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    กลับ
                </Button>
            </div>
        </div>
    );
}