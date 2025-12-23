"use client";

import { useState, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, ImageIcon, Loader2, X, Check } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

interface ImageUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taskId: number;
    imageType: "barcode" | "asset";
    currentImageUrl?: string | null;
    onUploadComplete: (imageUrl: string) => void;
}

export default function ImageUploadDialog({
    open,
    onOpenChange,
    taskId,
    imageType,
    currentImageUrl,
    onUploadComplete,
}: ImageUploadDialogProps) {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    // Reset state when dialog opens/closes
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            setPreview(currentImageUrl || null);
            setSelectedFile(null);
        }
        onOpenChange(newOpen);
    };

    // Handle file selection (from camera or gallery)
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!validTypes.includes(file.type)) {
            toast.error("รองรับเฉพาะไฟล์ .jpg, .png, .gif, .webp");
            return;
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast.error("ไฟล์ใหญ่เกิน 10MB");
            return;
        }

        setSelectedFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onload = (event) => {
            setPreview(event.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Reset input value to allow selecting the same file again
        e.target.value = "";
    };

    // Upload file
    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error("กรุณาเลือกรูปภาพก่อน");
            return;
        }

        setUploading(true);

        try {
            // 1. Upload file to server
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("imageType", imageType);
            formData.append("taskId", taskId.toString());

            const uploadRes = await fetch("/api/upload/image", {
                method: "POST",
                body: formData,
            });

            const uploadData = await uploadRes.json();

            if (!uploadRes.ok || !uploadData.success) {
                throw new Error(uploadData.error || "อัปโหลดไม่สำเร็จ");
            }

            // 2. Update database with image URL
            const updateRes = await fetch(`/api/pick-asset/${taskId}/update-image`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageType,
                    imageUrl: uploadData.imageUrl,
                }),
            });

            const updateData = await updateRes.json();

            if (!updateRes.ok || !updateData.success) {
                throw new Error(updateData.error || "บันทึกไม่สำเร็จ");
            }

            toast.success("อัปโหลดรูปสำเร็จ");
            onUploadComplete(uploadData.imageUrl);
            handleOpenChange(false);
        } catch (error) {
            console.error("Upload error:", error);
            toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
        } finally {
            setUploading(false);
        }
    };

    // Clear selected image
    const handleClear = () => {
        setPreview(currentImageUrl || null);
        setSelectedFile(null);
    };

    const title = imageType === "barcode" ? "รูปถ่าย Barcode" : "รูปถ่าย Asset";

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Hidden file inputs */}
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                    />

                    {/* Preview area */}
                    <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                        {preview ? (
                            <>
                                <Image
                                    src={preview}
                                    alt="Preview"
                                    fill
                                    className="object-contain"
                                    unoptimized
                                />
                                {selectedFile && (
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="text-center text-gray-400">
                                <Camera className="w-12 h-12 mx-auto mb-2" />
                                <p className="text-sm">ยังไม่มีรูปภาพ</p>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex items-center justify-center gap-2"
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={uploading}
                        >
                            <Camera className="w-4 h-4" />
                            ถ่ายรูป
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="flex items-center justify-center gap-2"
                            onClick={() => galleryInputRef.current?.click()}
                            disabled={uploading}
                        >
                            <ImageIcon className="w-4 h-4" />
                            เลือกจากคลัง
                        </Button>
                    </div>

                    {/* Upload button */}
                    {selectedFile && (
                        <Button
                            type="button"
                            className="w-full bg-blue-900 hover:bg-blue-800"
                            onClick={handleUpload}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    กำลังอัปโหลด...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 mr-2" />
                                    ยืนยันอัปโหลด
                                </>
                            )}
                        </Button>
                    )}

                    {/* Current image indicator */}
                    {currentImageUrl && !selectedFile && (
                        <p className="text-center text-sm text-green-600">
                            ✓ มีรูปภาพแล้ว (กดเลือกรูปใหม่เพื่อเปลี่ยน)
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}