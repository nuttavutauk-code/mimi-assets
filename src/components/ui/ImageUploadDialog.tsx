// components/ui/ImageUploadDialog.tsx
// อัปเดต: เพิ่ม Auto Image Compression ก่อน Upload
"use client";

import { useState, useRef, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { compressImage } from "@/lib/image-compress"; // ✅ เพิ่ม import

interface ImageUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taskId: number;
    imageType: "barcode" | "asset";
    currentImageUrl: string | null;
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
    const [preview, setPreview] = useState<string | null>(currentImageUrl);
    const [uploading, setUploading] = useState(false);
    const [compressing, setCompressing] = useState(false); // ✅ เพิ่ม state สำหรับ compression
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // ✅ แสดง preview ก่อน compress
        const reader = new FileReader();
        reader.onload = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        // ✅ Compress และ Upload
        setCompressing(true);
        try {
            const compressedFile = await compressImage(file);
            setCompressing(false);
            
            // Upload
            await uploadFile(compressedFile);
        } catch (error) {
            console.error("Compression error:", error);
            setCompressing(false);
            // ถ้า compress ไม่ได้ ก็ upload ไฟล์เดิม
            await uploadFile(file);
        }
    };

    const uploadFile = async (file: File) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("taskId", taskId.toString());
            formData.append("imageType", imageType);

            const res = await fetch("/api/upload/image", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (data.success) {
                onUploadComplete(data.imageUrl);
                onOpenChange(false);
            } else {
                alert("อัปโหลดไม่สำเร็จ: " + data.error);
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("เกิดข้อผิดพลาดในการอัปโหลด");
        } finally {
            setUploading(false);
        }
    };

    const handleCameraClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {imageType === "barcode" ? "รูปถ่าย Barcode" : "รูปถ่าย Asset"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Preview */}
                    <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                        {preview ? (
                            <>
                                <img
                                    src={preview}
                                    alt="Preview"
                                    className="w-full h-full object-contain"
                                />
                                <button
                                    type="button"
                                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                    onClick={() => setPreview(null)}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <div className="text-center text-gray-400">
                                <Camera className="w-12 h-12 mx-auto mb-2" />
                                <p>ยังไม่มีรูปภาพ</p>
                            </div>
                        )}

                        {/* Loading overlay */}
                        {(compressing || uploading) && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <div className="text-center text-white">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                                    <p className="text-sm">
                                        {compressing ? "กำลังบีบอัดรูป..." : "กำลังอัปโหลด..."}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={handleCameraClick}
                            disabled={uploading || compressing}
                        >
                            <Camera className="w-4 h-4 mr-2" />
                            ถ่ายรูป
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                                if (fileInputRef.current) {
                                    fileInputRef.current.removeAttribute("capture");
                                    fileInputRef.current.click();
                                }
                            }}
                            disabled={uploading || compressing}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            เลือกไฟล์
                        </Button>
                    </div>

                    {/* Info text */}
                    <p className="text-xs text-gray-500 text-center">
                        รูปจะถูกบีบอัดอัตโนมัติเหลือ ~300-500 KB ก่อนอัปโหลด
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}