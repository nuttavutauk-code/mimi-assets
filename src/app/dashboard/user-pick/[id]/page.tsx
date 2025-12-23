"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Camera, ArrowLeft, Search, Loader2, CheckCircle, XCircle } from "lucide-react";
import ImageUploadDialog from "@/components/ui/ImageUploadDialog";

interface BarcodeOption {
    barcode: string;
    assetName: string;
    size: string | null;
    label: string;
}

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
    documentType: string; // ✅ เพิ่มเพื่อเช็คว่าเป็น transfer หรือไม่
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

// ✅ Barcode Search Input Component - แยกออกมาเพื่อจัดการ state แต่ละ input แยกกัน
interface BarcodeSearchInputProps {
    taskId: number;
    assetName: string;
    value: string;
    onChange: (taskId: number, value: string) => void;
    selectedBarcodes: string[]; // ✅ Barcodes ที่ถูกเลือกไปแล้ว (ไม่รวมตัวเอง)
}

function BarcodeSearchInput({ taskId, assetName, value, onChange, selectedBarcodes }: BarcodeSearchInputProps) {
    const [inputValue, setInputValue] = useState(value);
    const [options, setOptions] = useState<BarcodeOption[]>([]);
    const [filteredOptions, setFilteredOptions] = useState<BarcodeOption[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Sync with parent value
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // ✅ Fetch all barcodes for this asset name (เรียกครั้งเดียวเมื่อ focus)
    const fetchAllBarcodes = useCallback(async () => {
        if (hasLoaded || !assetName) return;

        if (abortRef.current) {
            abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                assetName: assetName,
            });

            const res = await fetch(`/api/pick-asset/available-barcodes?${params}`, {
                signal: controller.signal,
            });

            const data = await res.json();

            if (data.success) {
                setOptions(data.assets || []);
                setFilteredOptions(data.assets || []);
                setHasLoaded(true);
            }
        } catch (err) {
            if ((err as any)?.name !== "AbortError") {
                console.error("Error fetching barcodes:", err);
            }
        } finally {
            setLoading(false);
        }
    }, [assetName, hasLoaded]);

    // ✅ Filter options based on input AND exclude already selected barcodes
    useEffect(() => {
        let filtered = options;
        
        // ✅ Filter out barcodes ที่ถูกเลือกไปแล้ว
        filtered = filtered.filter((opt) => !selectedBarcodes.includes(opt.barcode));
        
        // ✅ Filter by input text
        if (inputValue.trim()) {
            filtered = filtered.filter((opt) =>
                opt.barcode.toLowerCase().includes(inputValue.toLowerCase())
            );
        }
        
        setFilteredOptions(filtered);
    }, [inputValue, options, selectedBarcodes]);

    // ✅ Handle focus - load options
    const handleFocus = () => {
        fetchAllBarcodes();
        setShowDropdown(true);
    };

    // ✅ Handle blur - close dropdown (ไม่ save ทันที)
    const handleBlur = () => {
        // Delay to allow click on dropdown item
        setTimeout(() => {
            setShowDropdown(false);
            if (inputValue !== value) {
                onChange(taskId, inputValue);
                // ❌ ไม่ save ทันที - รอกดปุ่มบันทึก
            }
        }, 200);
    };

    // ✅ Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        setShowDropdown(true);
    };

    // ✅ Handle select from dropdown (ไม่ save ทันที)
    const handleSelect = (barcode: string) => {
        setInputValue(barcode);
        setShowDropdown(false);
        onChange(taskId, barcode);
        // ❌ ไม่ save ทันที - รอกดปุ่มบันทึก
    };

    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                    ref={inputRef}
                    placeholder="พิมพ์หรือเลือก Barcode..."
                    className="h-10 rounded-xl pl-9 pr-8"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
            </div>

            {/* Dropdown */}
            {showDropdown && (
                <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto"
                >
                    {loading ? (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                            กำลังโหลด...
                        </div>
                    ) : filteredOptions.length > 0 ? (
                        <>
                            <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-b sticky top-0">
                                พบ {filteredOptions.length} รายการสำหรับ "{assetName}"
                            </div>
                            {filteredOptions.map((opt) => (
                                <div
                                    key={opt.barcode}
                                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelect(opt.barcode);
                                    }}
                                >
                                    <div className="font-medium text-gray-900">{opt.barcode}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        Size: {opt.size || "ไม่มี Size"}
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : hasLoaded ? (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                            ไม่พบ Barcode สำหรับ "{assetName}"
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

export default function PickAssetDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const documentId = parseInt(params.id as string);
    const shopCode = searchParams.get("shopCode") || "";

    const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // ✅ Local state สำหรับ barcode
    const [localBarcodes, setLocalBarcodes] = useState<Record<number, string>>({});

    // ✅ Local state สำหรับ image URLs
    const [localImages, setLocalImages] = useState<Record<number, { barcode?: string; asset?: string }>>({});

    // ✅ Local state สำหรับ cancelled tasks
    const [cancelledTasks, setCancelledTasks] = useState<Record<number, boolean>>({});

    // ✅ Image upload dialog state
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [imageDialogTaskId, setImageDialogTaskId] = useState<number>(0);
    const [imageDialogType, setImageDialogType] = useState<"barcode" | "asset">("barcode");

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

                // Initialize local barcodes
                const initialBarcodes: Record<number, string> = {};
                const initialImages: Record<number, { barcode?: string; asset?: string }> = {};
                const initialCancelled: Record<number, boolean> = {};
                [...data.assets, ...data.securitySets].forEach((item: Asset) => {
                    initialBarcodes[item.id] = item.barcode || "";
                    initialImages[item.id] = {
                        barcode: item.barcodeImageUrl || undefined,
                        asset: item.assetImageUrl || undefined,
                    };
                    initialCancelled[item.id] = item.status === "cancelled";
                });
                setLocalBarcodes(initialBarcodes);
                setLocalImages(initialImages);
                setCancelledTasks(initialCancelled);
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

    // ✅ Handle barcode change
    const handleBarcodeChange = (taskId: number, value: string) => {
        setLocalBarcodes((prev) => ({
            ...prev,
            [taskId]: value,
        }));
    };

    const handleImageUpload = (taskId: number, type: "barcode" | "asset") => {
        setImageDialogTaskId(taskId);
        setImageDialogType(type);
        setImageDialogOpen(true);
    };

    // ✅ Handle image upload complete
    const handleImageUploadComplete = (imageUrl: string) => {
        setLocalImages((prev) => ({
            ...prev,
            [imageDialogTaskId]: {
                ...prev[imageDialogTaskId],
                [imageDialogType]: imageUrl,
            },
        }));
    };

    // ✅ Handle cancel task
    const handleCancelTask = async (taskId: number) => {
        if (!confirm("ยืนยันยกเลิกรายการนี้?")) return;

        try {
            const res = await fetch("/api/pick-asset/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taskId }),
            });

            const data = await res.json();

            if (data.success) {
                // อัปเดต local state
                setCancelledTasks((prev) => ({ ...prev, [taskId]: true }));
                setLocalBarcodes((prev) => ({ ...prev, [taskId]: "" }));
                setLocalImages((prev) => ({ ...prev, [taskId]: {} }));
                alert("ยกเลิกรายการสำเร็จ");
            } else {
                alert("เกิดข้อผิดพลาด: " + data.error);
            }
        } catch (error) {
            console.error("Error cancelling task:", error);
            alert("ไม่สามารถยกเลิกรายการได้");
        }
    };

    const handleComplete = async () => {
        if (!taskDetail) return;

        // ✅ รวม assets และ securitySets ที่ต้องกรอก Barcode
        // Security Type C ไม่ต้องกรอก Barcode
        // ✅ Filter ออกรายการที่ถูกยกเลิก (cancelled)
        const assetsNeedBarcode = taskDetail.assets.filter(
            (a) => !cancelledTasks[a.id] // ไม่รวมรายการที่ถูกยกเลิก
        );
        const securityNeedBarcode = taskDetail.securitySets.filter(
            (s) => !s.assetName.includes("Security Type C") && !cancelledTasks[s.id] // เฉพาะ CONTROLBOX ที่ไม่ถูกยกเลิก
        );

        // ✅ Debug log
        console.log("📋 All Security Sets:", taskDetail.securitySets.map(s => ({ id: s.id, name: s.assetName, status: s.status })));
        console.log("📋 Security Need Barcode:", securityNeedBarcode.map(s => ({ id: s.id, name: s.assetName })));
        console.log("📋 Local Barcodes:", localBarcodes);
        console.log("📋 Cancelled Tasks:", cancelledTasks);

        const allTasksNeedBarcode = [...assetsNeedBarcode, ...securityNeedBarcode];
        const incompleteTasks = allTasksNeedBarcode.filter((t) => !localBarcodes[t.id] || localBarcodes[t.id].trim() === "");

        console.log("📋 All Tasks Need Barcode:", allTasksNeedBarcode.map(t => ({ id: t.id, name: t.assetName })));
        console.log("📋 Incomplete Tasks:", incompleteTasks.map(t => ({ id: t.id, name: t.assetName, barcode: localBarcodes[t.id] })));

        if (incompleteTasks.length > 0) {
            alert(
                `กรุณากรอก Barcode ให้ครบทุกรายการ\nยังเหลืออีก ${incompleteTasks.length} รายการ:\n${incompleteTasks.map(t => `- ${t.assetName}`).join('\n')}`
            );
            return;
        }

        if (!confirm("คุณต้องการบันทึกและยืนยันการเบิกของใช่หรือไม่?")) {
            return;
        }

        try {
            setSaving(true);

            // ✅ บันทึก Barcode ทั้งหมดก่อน (ที่ยังไม่ได้ cancelled และมี barcode)
            const barcodesToSave = allTasksNeedBarcode
                .filter(t => !cancelledTasks[t.id]) // ✅ ไม่รวม cancelled tasks
                .filter(t => localBarcodes[t.id] && localBarcodes[t.id].trim() !== "")
                .map(t => ({ taskId: t.id, barcode: localBarcodes[t.id] }));

            console.log("📋 Saving barcodes:", barcodesToSave);

            // Save all barcodes และรอให้เสร็จทั้งหมด
            const saveResults = await Promise.all(
                barcodesToSave.map(async (item) => {
                    const res = await fetch("/api/pick-asset/update-barcode", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(item),
                    });
                    const data = await res.json();
                    console.log(`📋 Saved barcode ${item.barcode} for task ${item.taskId}:`, data);
                    return { ...item, success: data.success };
                })
            );

            // เช็คว่า save สำเร็จทั้งหมดหรือไม่
            const failedSaves = saveResults.filter(r => !r.success);
            if (failedSaves.length > 0) {
                alert(`เกิดข้อผิดพลาดในการบันทึก Barcode ${failedSaves.length} รายการ`);
                return;
            }

            console.log("✅ All barcodes saved successfully, now completing...");

            // ✅ จากนั้นค่อย complete (ส่ง shopCode ไปด้วยเพื่อ complete เฉพาะ Shop นี้)
            const res = await fetch("/api/pick-asset/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId, shopCode: shopCode || undefined }),
            });

            const data = await res.json();

            if (data.success) {
                const totalTransactions = (data.transactionsUpdated || 0) + (data.securityTypeCProcessed || 0);
                alert(
                    `✅ บันทึกสำเร็จ!\n` +
                    `- Complete ${data.tasksCompleted} tasks\n` +
                    `- อัปเดต/สร้าง ${totalTransactions} transactions`
                );
                router.push("/dashboard/user-pick");
            } else {
                alert("เกิดข้อผิดพลาด: " + data.message);
            }
        } catch (error) {
            console.error("Error completing tasks:", error);
            alert("ไม่สามารถบันทึกข้อมูลได้");
        } finally {
            setSaving(false);
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
                <h1 className="text-2xl font-semibold">Pick Asset - {taskDetail.docCode}</h1>
            </div>

            {/* Image Upload Dialog */}
            <ImageUploadDialog
                open={imageDialogOpen}
                onOpenChange={setImageDialogOpen}
                taskId={imageDialogTaskId}
                imageType={imageDialogType}
                currentImageUrl={localImages[imageDialogTaskId]?.[imageDialogType] || null}
                onUploadComplete={handleImageUploadComplete}
            />

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
                        <Input value={taskDetail?.docCode || ""} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600">ชื่อผู้เบิก</label>
                        <Input value={taskDetail?.requester?.name || ""} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600">บริษัท</label>
                        <Input value={taskDetail?.requester?.company || ""} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600">เบอร์โทรศัพท์</label>
                        <Input value={taskDetail?.requester?.phone || ""} readOnly className="bg-gray-50" />
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
                            <Input value={taskDetail?.shop?.code || ""} readOnly className="bg-gray-50" />
                        </div>
                        <div className="w-full md:flex-[2]">
                            <label className="text-sm text-gray-600">Shop Name</label>
                            <Input value={taskDetail?.shop?.name || ""} readOnly className="bg-gray-50" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm text-gray-600">วันที่เริ่มติดตั้ง</label>
                            <Input
                                value={
                                    taskDetail?.shop?.startInstallDate
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
                                    taskDetail?.shop?.endInstallDate
                                        ? new Date(taskDetail.shop.endInstallDate).toLocaleDateString("th-TH")
                                        : "-"
                                }
                                readOnly
                                className="bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">Q7B7</label>
                            <Input value={taskDetail?.shop?.q7b7 || "-"} readOnly className="bg-gray-50" />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">Shop Focus</label>
                            <Input value={taskDetail?.shop?.shopFocus || "-"} readOnly className="bg-gray-50" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Asset */}
            {taskDetail.assets.length > 0 && (
                <div className="glass-card p-5">
                    <h2 className="font-semibold mb-4">Asset ({taskDetail.assets.length} รายการ)</h2>
                    <div className="space-y-4">
                        {taskDetail.assets.map((asset, idx) => {
                            const isCancelled = cancelledTasks[asset.id];

                            return (
                                <div key={asset.id} className={`border rounded-xl p-6 space-y-4 ${isCancelled ? 'bg-gray-100 opacity-60' : 'bg-white'}`}>
                                    {/* แสดง Badge ยกเลิกแล้ว */}
                                    {isCancelled && (
                                        <div className="flex items-center gap-2 text-red-600 font-medium">
                                            <XCircle className="w-5 h-5" />
                                            <span>ยกเลิกรายการแล้ว</span>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">
                                                Barcode Asset No.{idx + 1}
                                            </label>
                                            {isCancelled ? (
                                                <Input value="-" readOnly className="bg-gray-200 text-gray-500" />
                                            ) : taskDetail.documentType === "transfer" ? (
                                                // ✅ Transfer: Barcode ถูกระบุมาแล้ว แสดงแบบ readonly
                                                <Input 
                                                    value={localBarcodes[asset.id] || asset.barcode || ""} 
                                                    readOnly 
                                                    className="bg-gray-50 font-mono" 
                                                />
                                            ) : (
                                                <BarcodeSearchInput
                                                    taskId={asset.id}
                                                    assetName={asset.assetName}
                                                    value={localBarcodes[asset.id] || ""}
                                                    onChange={handleBarcodeChange}
                                                    selectedBarcodes={
                                                        // ✅ รวม Barcodes ที่ถูกเลือกแล้วจาก Asset ที่มี assetName เดียวกัน (ไม่รวมตัวเอง)
                                                        taskDetail.assets
                                                            .filter(a => a.assetName === asset.assetName && a.id !== asset.id && !cancelledTasks[a.id])
                                                            .map(a => localBarcodes[a.id])
                                                            .filter(b => b && b.trim() !== "")
                                                    }
                                                />
                                            )}
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="text-sm font-medium mb-2 block">
                                                Asset Name <span className="text-red-500">*</span>
                                            </label>
                                            <Input value={asset.assetName || ""} readOnly className="bg-gray-50" />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium mb-2 block">
                                                Size
                                            </label>
                                            <Input value={asset.size || "-"} readOnly className="bg-gray-50" />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium mb-2 block">
                                                จำนวน
                                            </label>
                                            <Input
                                                type="number"
                                                value={asset.qty}
                                                readOnly
                                                className="text-center bg-gray-50"
                                            />
                                        </div>
                                    </div>

                                    {!isCancelled && (
                                        <div className="flex flex-wrap items-start gap-4">
                                            <div className="w-48">
                                                <label className="text-sm font-medium mb-2 block">
                                                    รูปถ่าย Barcode <span className="text-red-500">*</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-lg transition-colors ${localImages[asset.id]?.barcode
                                                        ? "border-green-500 bg-green-50 text-green-700"
                                                        : "border-gray-300 hover:bg-gray-50"
                                                        }`}
                                                    onClick={() => handleImageUpload(asset.id, "barcode")}
                                                >
                                                    {localImages[asset.id]?.barcode ? (
                                                        <CheckCircle className="w-4 h-4" />
                                                    ) : (
                                                        <Camera className="w-4 h-4" />
                                                    )}
                                                    <span className="text-sm">
                                                        {localImages[asset.id]?.barcode ? "มีรูปแล้ว" : "รูปถ่าย Barcode"}
                                                    </span>
                                                </button>
                                            </div>

                                            <div className="w-48">
                                                <label className="text-sm font-medium mb-2 block">
                                                    รูปถ่าย Asset <span className="text-red-500">*</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-lg transition-colors ${localImages[asset.id]?.asset
                                                        ? "border-green-500 bg-green-50 text-green-700"
                                                        : "border-gray-300 hover:bg-gray-50"
                                                        }`}
                                                    onClick={() => handleImageUpload(asset.id, "asset")}
                                                >
                                                    {localImages[asset.id]?.asset ? (
                                                        <CheckCircle className="w-4 h-4" />
                                                    ) : (
                                                        <Camera className="w-4 h-4" />
                                                    )}
                                                    <span className="text-sm">
                                                        {localImages[asset.id]?.asset ? "มีรูปแล้ว" : "รูปถ่าย Asset"}
                                                    </span>
                                                </button>
                                            </div>

                                            {/* Status indicator */}
                                            <div className="flex-1 flex items-end justify-end gap-3">
                                                {localBarcodes[asset.id] ? (
                                                    <span className="text-sm text-green-600 font-medium">✓ กรอกแล้ว</span>
                                                ) : (
                                                    <span className="text-sm text-orange-500 font-medium">⏳ รอกรอก Barcode</span>
                                                )}

                                                {/* ปุ่มยกเลิกรายการ */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleCancelTask(asset.id)}
                                                    className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                                                >
                                                    ยกเลิกรายการ
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Security Set */}
            {taskDetail.securitySets.length > 0 && (
                <div className="glass-card p-5">
                    <h2 className="font-semibold mb-4">Security Set ({taskDetail.securitySets.length} รายการ)</h2>
                    <div className="space-y-4">
                        {taskDetail.securitySets.map((security, idx) => {
                            // ✅ เช็คว่าเป็น Security Type C หรือไม่ (ไม่มี Barcode)
                            const isSecurityTypeC = security.assetName.includes("Security Type C");
                            const isCancelled = cancelledTasks[security.id];

                            return (
                                <div key={security.id} className={`border rounded-xl p-6 space-y-4 ${isCancelled ? 'bg-gray-100 opacity-60' : 'bg-white'}`}>
                                    {/* แสดง Badge ยกเลิกแล้ว */}
                                    {isCancelled && (
                                        <div className="flex items-center gap-2 text-red-600 font-medium">
                                            <XCircle className="w-5 h-5" />
                                            <span>ยกเลิกรายการแล้ว</span>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        {/* ✅ แสดง Barcode field เฉพาะ CONTROLBOX (ไม่ใช่ Security Type C) */}
                                        {!isSecurityTypeC && (
                                            <div>
                                                <label className="text-sm font-medium mb-2 block">
                                                    Barcode Security No.{idx + 1}
                                                </label>
                                                {isCancelled ? (
                                                    <Input value="-" readOnly className="bg-gray-200 text-gray-500" />
                                                ) : (
                                                    <BarcodeSearchInput
                                                        taskId={security.id}
                                                        assetName={security.assetName}
                                                        value={localBarcodes[security.id] || ""}
                                                        onChange={handleBarcodeChange}
                                                        selectedBarcodes={
                                                            // ✅ รวม Barcodes ที่ถูกเลือกแล้วจาก Security Set ที่มี assetName เดียวกัน (ไม่รวมตัวเอง)
                                                            taskDetail.securitySets
                                                                .filter(s => s.assetName === security.assetName && s.id !== security.id && !cancelledTasks[s.id])
                                                                .map(s => localBarcodes[s.id])
                                                                .filter(b => b && b.trim() !== "")
                                                        }
                                                    />
                                                )}
                                            </div>
                                        )}

                                        <div className={isSecurityTypeC ? "md:col-span-4" : "md:col-span-3"}>
                                            <label className="text-sm font-medium mb-2 block">
                                                Asset Name <span className="text-red-500">*</span>
                                            </label>
                                            <Input value={security.assetName || ""} readOnly className="bg-gray-50" />
                                        </div>
                                    </div>

                                    {!isCancelled && (
                                        <div className="flex flex-wrap items-start gap-4">
                                            <div className="w-16">
                                                <label className="text-sm font-medium mb-2 block">
                                                    จำนวน <span className="text-red-500">*</span>
                                                </label>
                                                <Input
                                                    type="number"
                                                    value={security.qty}
                                                    readOnly
                                                    className="text-center bg-gray-50"
                                                />
                                            </div>

                                            {/* ✅ แสดงปุ่มรูปถ่าย Barcode เฉพาะ CONTROLBOX */}
                                            {!isSecurityTypeC && (
                                                <div className="w-48">
                                                    <label className="text-sm font-medium mb-2 block">
                                                        รูปถ่าย Barcode <span className="text-red-500">*</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-lg transition-colors ${localImages[security.id]?.barcode
                                                            ? "border-green-500 bg-green-50 text-green-700"
                                                            : "border-gray-300 hover:bg-gray-50"
                                                            }`}
                                                        onClick={() => handleImageUpload(security.id, "barcode")}
                                                    >
                                                        {localImages[security.id]?.barcode ? (
                                                            <CheckCircle className="w-4 h-4" />
                                                        ) : (
                                                            <Camera className="w-4 h-4" />
                                                        )}
                                                        <span className="text-sm">
                                                            {localImages[security.id]?.barcode ? "มีรูปแล้ว" : "รูปถ่าย Barcode"}
                                                        </span>
                                                    </button>
                                                </div>
                                            )}

                                            <div className="w-48">
                                                <label className="text-sm font-medium mb-2 block">
                                                    รูปถ่าย Asset <span className="text-red-500">*</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-lg transition-colors ${localImages[security.id]?.asset
                                                        ? "border-green-500 bg-green-50 text-green-700"
                                                        : "border-gray-300 hover:bg-gray-50"
                                                        }`}
                                                    onClick={() => handleImageUpload(security.id, "asset")}
                                                >
                                                    {localImages[security.id]?.asset ? (
                                                        <CheckCircle className="w-4 h-4" />
                                                    ) : (
                                                        <Camera className="w-4 h-4" />
                                                    )}
                                                    <span className="text-sm">
                                                        {localImages[security.id]?.asset ? "มีรูปแล้ว" : "รูปถ่าย Asset"}
                                                    </span>
                                                </button>
                                            </div>

                                            {/* Status indicator */}
                                            <div className="flex-1 flex items-end justify-end gap-3">
                                                {isSecurityTypeC ? (
                                                    // ✅ Security Type C: ไม่ต้องเช็ค Barcode
                                                    <span className="text-sm text-green-600 font-medium">✓ ไม่ต้องระบุ Barcode</span>
                                                ) : localBarcodes[security.id] ? (
                                                    <span className="text-sm text-green-600 font-medium">✓ กรอกแล้ว</span>
                                                ) : (
                                                    <span className="text-sm text-orange-500 font-medium">⏳ รอกรอก Barcode</span>
                                                )}

                                                {/* ปุ่มยกเลิกรายการ */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleCancelTask(security.id)}
                                                    className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                                                >
                                                    ยกเลิกรายการ
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ปุ่มบันทึก */}
            <div className="flex justify-center pb-8">
                <Button
                    type="button"
                    className="px-12 py-3 bg-blue-900 hover:bg-blue-800 text-white text-lg rounded-xl"
                    onClick={handleComplete}
                    disabled={saving}
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            กำลังบันทึก...
                        </>
                    ) : (
                        "บันทึก"
                    )}
                </Button>
            </div>
        </div>
    );
}