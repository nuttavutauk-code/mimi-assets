"use client";

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, X, CheckCircle, XCircle, AlertCircle, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

interface UploadResult {
    filename: string;
    status: "success" | "not_found" | "error";
    message: string;
    matchedBy?: string;
    matchedValue?: string;
}

interface BulkImageUploaderProps {
    libraryType: "ses" | "sis";
    onUploadComplete?: () => void;
}

export default function BulkImageUploader({
    libraryType,
    onUploadComplete,
}: BulkImageUploaderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState<UploadResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    const validateFile = (file: File): boolean => {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            toast.error(`ไฟล์ ${file.name} ไม่รองรับนามสกุล ${ext}`);
            return false;
        }
        if (file.size > MAX_FILE_SIZE) {
            toast.error(`ไฟล์ ${file.name} ใหญ่เกิน 5MB`);
            return false;
        }
        return true;
    };

    const addFiles = useCallback((newFiles: File[]) => {
        const validFiles = newFiles.filter(validateFile);
        if (validFiles.length === 0) return;
        const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
        setFiles((prev) => [...prev, ...validFiles]);
        setPreviews((prev) => [...prev, ...newPreviews]);
    }, []);

    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            (file) => file.type.startsWith("image/")
        );
        addFiles(droppedFiles);
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            addFiles(Array.from(e.target.files));
        }
        e.target.value = "";
    };

    const removeFile = (index: number) => {
        URL.revokeObjectURL(previews[index]);
        setFiles((prev) => prev.filter((_, i) => i !== index));
        setPreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const clearAll = () => {
        previews.forEach((url) => URL.revokeObjectURL(url));
        setFiles([]);
        setPreviews([]);
        setResults([]);
        setShowResults(false);
    };

    const handleUpload = async () => {
        if (files.length === 0) {
            toast.error("กรุณาเลือกไฟล์ก่อน");
            return;
        }

        setUploading(true);
        setResults([]);
        setShowResults(false);

        try {
            const formData = new FormData();
            files.forEach((file) => {
                formData.append("images", file);
            });

            const res = await fetch(`/api/library/${libraryType}/upload-images`, {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
                setResults(data.results || []);
                setShowResults(true);
                if (onUploadComplete) {
                    onUploadComplete();
                }
            } else {
                toast.error(data.error || "เกิดข้อผิดพลาด");
            }
        } catch (err) {
            console.error(err);
            toast.error("เกิดข้อผิดพลาดในการอัปโหลด");
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        if (!uploading) {
            clearAll();
            setIsOpen(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "success":
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case "not_found":
                return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case "error":
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return null;
        }
    };

    return (
        <>
            <Button variant="outline" onClick={() => setIsOpen(true)}>
                <ImageIcon className="w-4 h-4 mr-2" />
                Upload Images
            </Button>

            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-3xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Upload className="w-5 h-5" />
                            Bulk Upload Images - Library {libraryType.toUpperCase()}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm">
                            <p className="font-medium mb-1">📌 วิธีการตั้งชื่อไฟล์:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                                <li>ตั้งชื่อไฟล์ตาม <strong>ASSET NAME</strong> ของสินค้า</li>
                                <li>ตัวอย่าง: <code className="bg-blue-100 px-1 rounded">Samsung TV 55.jpg</code> จะ match กับ ASSET NAME = Samsung TV 55</li>
                                <li>รองรับไฟล์: .jpg, .jpeg, .png, .gif, .webp (ไม่เกิน 5MB ต่อไฟล์)</li>
                            </ul>
                        </div>

                        {!showResults && (
                            <div
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                                {isDragActive ? (
                                    <p className="text-blue-600 font-medium">วางไฟล์ที่นี่...</p>
                                ) : (
                                    <>
                                        <p className="text-gray-600 font-medium">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก</p>
                                        <p className="text-gray-400 text-sm mt-1">สามารถเลือกหลายไฟล์พร้อมกันได้</p>
                                    </>
                                )}
                            </div>
                        )}

                        {files.length > 0 && !showResults && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <p className="text-sm font-medium">ไฟล์ที่เลือก ({files.length} ไฟล์)</p>
                                    <Button variant="ghost" size="sm" onClick={clearAll}>ล้างทั้งหมด</Button>
                                </div>
                                <ScrollArea className="h-[200px] border rounded-lg p-2">
                                    <div className="grid grid-cols-4 gap-2">
                                        {files.map((file, index) => (
                                            <div key={index} className="relative group border rounded-lg overflow-hidden">
                                                <Image
                                                    src={previews[index]}
                                                    alt={file.name}
                                                    width={100}
                                                    height={100}
                                                    className="w-full h-20 object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button onClick={() => removeFile(index)} className="p-1 bg-red-500 rounded-full text-white">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="text-xs p-1 truncate bg-gray-100">{file.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        )}

                        {showResults && results.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium">ผลการอัปโหลด:</p>
                                <ScrollArea className="h-[300px] border rounded-lg">
                                    <div className="divide-y">
                                        {results.map((result, index) => (
                                            <div
                                                key={index}
                                                className={`p-3 flex items-start gap-3 ${result.status === "success" ? "bg-green-50" :
                                                    result.status === "not_found" ? "bg-yellow-50" : "bg-red-50"
                                                    }`}
                                            >
                                                {getStatusIcon(result.status)}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">{result.filename}</p>
                                                    <p className="text-xs text-gray-600">
                                                        {result.message}
                                                        {result.matchedBy && (
                                                            <span className="ml-2 text-green-600">
                                                                (matched by {result.matchedBy}: {result.matchedValue})
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <div className="flex gap-4 text-sm">
                                    <span className="text-green-600">✓ สำเร็จ: {results.filter((r) => r.status === "success").length}</span>
                                    <span className="text-yellow-600">⚠ ไม่พบข้อมูล: {results.filter((r) => r.status === "not_found").length}</span>
                                    <span className="text-red-600">✗ ผิดพลาด: {results.filter((r) => r.status === "error").length}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        {showResults ? (
                            <Button onClick={handleClose}>ปิด</Button>
                        ) : (
                            <>
                                <Button variant="outline" onClick={handleClose} disabled={uploading}>ยกเลิก</Button>
                                <Button onClick={handleUpload} disabled={uploading || files.length === 0}>
                                    {uploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            กำลังอัปโหลด...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 mr-2" />
                                            อัปโหลด ({files.length} ไฟล์)
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}