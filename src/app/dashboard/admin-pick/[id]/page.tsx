"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Eye, CheckCircle, XCircle, Image as ImageIcon, Edit2, Search, X } from "lucide-react";
import { toast } from "sonner";
import debounce from "lodash.debounce";

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
    warehouse?: string | null;
}

interface TaskDetail {
    documentId: number;
    docCode: string;
    documentType: string;
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

interface BarcodeOption {
    barcode: string;
    assetName: string;
    size: string | null;
    label: string;
}

// ✅ Component สำหรับค้นหา Barcode ใน Modal
function BarcodeSearchModal({
    isOpen,
    onClose,
    asset,
    onSave,
}: {
    isOpen: boolean;
    onClose: () => void;
    asset: (Asset & { warehouse?: string | null }) | null;
    onSave: (pickTaskId: number, newBarcode: string) => Promise<void>;
}) {
    const [search, setSearch] = useState("");
    const [options, setOptions] = useState<BarcodeOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Reset state เมื่อเปิด Modal
    useEffect(() => {
        if (isOpen) {
            setSearch("");
            setOptions([]);
            setSelectedBarcode(null);
        }
    }, [isOpen]);

    // ค้นหา Barcode
    const fetchBarcodes = useCallback(async (searchTerm: string) => {
        if (!asset || !searchTerm || searchTerm.length < 2) {
            setOptions([]);
            return;
        }

        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                assetName: asset.assetName,
                search: searchTerm,
                excludeAssigned: "true",
                excludePickTaskId: String(asset.id),
            });
            if (asset.warehouse) params.append("warehouse", asset.warehouse);
            const res = await fetch(`/api/pick-asset/available-barcodes?${params}`, {
                signal: controller.signal,
            });
            const data = await res.json();

            if (data.success) {
                // กรอง Barcode เดิมออก
                const filtered = (data.assets || []).filter(
                    (opt: BarcodeOption) => opt.barcode !== asset.barcode
                );
                setOptions(filtered);
            }
        } catch (err) {
            if ((err as any)?.name !== "AbortError") {
                console.error("Error fetching barcodes:", err);
            }
        } finally {
            setLoading(false);
        }
    }, [asset]);

    const debouncedSearch = useMemo(() => debounce(fetchBarcodes, 300), [fetchBarcodes]);

    useEffect(() => {
        debouncedSearch(search);
        return () => debouncedSearch.cancel();
    }, [search, debouncedSearch]);

    const handleSave = async () => {
        if (!asset || !selectedBarcode) return;

        setSaving(true);
        try {
            await onSave(asset.id, selectedBarcode);
            onClose();
        } catch (err) {
            // Error handled in parent
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !asset) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-lg font-semibold">แก้ไข Barcode</h2>
                        <p className="text-sm text-gray-500">{asset.assetName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Barcode เดิม */}
                    <div>
                        <label className="text-sm font-medium text-gray-600">Barcode เดิม</label>
                        <Input value={asset.barcode || "-"} readOnly className="bg-gray-100 mt-1" />
                    </div>

                    {/* ค้นหา Barcode ใหม่ */}
                    <div>
                        <label className="text-sm font-medium text-gray-600">ค้นหา Barcode ใหม่</label>
                        <div className="relative mt-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร..."
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                            <span className="ml-2 text-sm text-gray-500">กำลังค้นหา...</span>
                        </div>
                    )}

                    {/* รายการ Barcode */}
                    {!loading && options.length > 0 && (
                        <div className="border rounded-lg max-h-60 overflow-y-auto">
                            {options.map((opt) => (
                                <button
                                    key={opt.barcode}
                                    onClick={() => setSelectedBarcode(opt.barcode)}
                                    className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-blue-50 transition ${
                                        selectedBarcode === opt.barcode ? "bg-blue-100" : ""
                                    }`}
                                >
                                    <div className="font-mono text-sm">{opt.barcode}</div>
                                    <div className="text-xs text-gray-500">
                                        {opt.assetName} {opt.size ? `(${opt.size})` : ""}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ไม่พบ Barcode */}
                    {!loading && search.length >= 2 && options.length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                            ไม่พบ Barcode ที่พร้อมใช้งาน
                        </div>
                    )}

                    {/* Barcode ที่เลือก */}
                    {selectedBarcode && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm text-green-700">Barcode ใหม่ที่เลือก:</p>
                            <p className="font-mono font-semibold text-green-800">{selectedBarcode}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        ยกเลิก
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!selectedBarcode || saving}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                กำลังบันทึก...
                            </>
                        ) : (
                            "บันทึกการแก้ไข"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
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

    // ✅ State สำหรับ Modal แก้ไข Barcode
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

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

    // ✅ ฟังก์ชันแก้ไข Barcode
    const handleEditBarcode = async (pickTaskId: number, newBarcode: string) => {
        try {
            const res = await fetch("/api/pick-asset/edit-barcode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pickTaskId, newBarcode }),
            });

            const data = await res.json();

            if (data.success) {
                toast.success(data.message);
                // รีโหลดข้อมูล
                fetchTaskDetail();
            } else {
                toast.error(data.message || "เกิดข้อผิดพลาด");
                throw new Error(data.message);
            }
        } catch (error) {
            console.error("Error editing barcode:", error);
            throw error;
        }
    };

    // ✅ เปิด Modal แก้ไข
    const openEditModal = (asset: Asset) => {
        setEditingAsset(asset);
        setEditModalOpen(true);
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
                    <p className="text-sm text-muted-foreground">Admin View (สามารถแก้ไข Barcode ได้)</p>
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

            {/* Document Info */}
            <div className="glass-card p-5">
                <h2 className="font-semibold mb-4">ข้อมูลเอกสาร</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-600">ผู้ขอเบิก</label>
                        <p className="mt-1">{taskDetail.requester.name || "-"}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">บริษัท</label>
                        <p className="mt-1">{taskDetail.requester.company || "-"}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">เบอร์โทร</label>
                        <p className="mt-1">{taskDetail.requester.phone || "-"}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">รหัสร้าน</label>
                        <p className="mt-1">{taskDetail.shop.code || "-"}</p>
                    </div>
                </div>
            </div>

            {/* Shop Info */}
            <div className="glass-card p-5">
                <h2 className="font-semibold mb-4">ข้อมูลร้านค้า</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-600">ชื่อร้าน</label>
                        <p className="mt-1">{taskDetail.shop.name || "-"}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">วันที่ติดตั้ง</label>
                        <p className="mt-1">{taskDetail.shop.startInstallDate || "-"}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600">วันสิ้นสุด</label>
                        <p className="mt-1">{taskDetail.shop.endInstallDate || "-"}</p>
                    </div>
                </div>
            </div>

            {/* Assets */}
            {taskDetail.assets.length > 0 && (
                <div className="glass-card p-5">
                    <h2 className="font-semibold mb-4">Asset ({taskDetail.assets.length} รายการ)</h2>
                    <div className="space-y-4">
                        {taskDetail.assets.map((asset, idx) => (
                            <div key={asset.id} className={`border rounded-xl p-6 space-y-4 ${asset.status === "cancelled" ? "bg-gray-100 opacity-60" : "bg-white"}`}>
                                {/* Status Badge + Edit Button */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Asset #{idx + 1}</span>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(asset.status)}
                                        {/* ✅ ปุ่มแก้ไข Barcode (status picking หรือ completed) */}
                                        {(asset.status === "completed" || asset.status === "picking") && asset.barcode && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openEditModal(asset)}
                                                className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                            >
                                                <Edit2 className="w-3 h-3 mr-1" />
                                                แก้ไข Barcode
                                            </Button>
                                        )}
                                    </div>
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
                                    {/* Status Badge + Edit Button */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Security #{idx + 1}</span>
                                        <div className="flex items-center gap-2">
                                            {getStatusBadge(security.status)}
                                            {/* ✅ ปุ่มแก้ไข Barcode (status picking/completed, มี barcode, ไม่ใช่ Type C) */}
                                            {(security.status === "completed" || security.status === "picking") && security.barcode && !isSecurityTypeC && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openEditModal(security)}
                                                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                                >
                                                    <Edit2 className="w-3 h-3 mr-1" />
                                                    แก้ไข Barcode
                                                </Button>
                                            )}
                                        </div>
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

            {/* ✅ Modal แก้ไข Barcode */}
            <BarcodeSearchModal
                isOpen={editModalOpen}
                onClose={() => {
                    setEditModalOpen(false);
                    setEditingAsset(null);
                }}
                asset={editingAsset}
                onSave={handleEditBarcode}
            />

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