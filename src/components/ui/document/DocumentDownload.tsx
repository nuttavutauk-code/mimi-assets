"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, X } from "lucide-react";
import DocumentTemplateSelector from "./DocumentTemplateSelector";
import { downloadAsImage } from "@/lib/downloadDocument";

interface DocumentData {
    docCode: string;
    fullName?: string;
    company?: string;
    phone?: string;
    note?: string;
    createdAt?: string | Date;
    documentType?: string;
    shops?: any[];
}

interface DocumentPreviewModalProps {
    document: DocumentData;
    vendorName?: string;
    isOpen: boolean;
    onClose: () => void;
}

export function DocumentPreviewModal({
    document: doc,
    vendorName = "SAMSUNG",
    isOpen,
    onClose,
}: DocumentPreviewModalProps) {
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const success = await downloadAsImage("document-to-print", `${doc.docCode}`);
            if (success) {
                // ดาวน์โหลดสำเร็จ
            } else {
                alert("ไม่สามารถสร้างรูปภาพได้");
            }
        } catch (error) {
            console.error("Download error:", error);
            alert("เกิดข้อผิดพลาดในการดาวน์โหลด");
        } finally {
            setDownloading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                padding: "20px",
                overflow: "auto",
                zIndex: 9999,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    position: "relative",
                    backgroundColor: "#525659",
                    padding: "20px",
                    borderRadius: "8px",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ปุ่มปิด + ดาวน์โหลด */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "10px",
                        marginBottom: "10px",
                    }}
                >
                    <Button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {downloading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                กำลังสร้างรูป...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                ดาวน์โหลดรูปภาพ
                            </>
                        )}
                    </Button>
                    <Button onClick={onClose} variant="outline" className="bg-white">
                        <X className="w-4 h-4 mr-2" />
                        ปิด
                    </Button>
                </div>

                {/* Template เอกสาร */}
                <DocumentTemplateSelector document={doc} />
            </div>
        </div>
    );
}

// ปุ่มสำหรับเปิด Preview + Download
interface DownloadDocumentButtonProps {
    document: DocumentData;
    vendorName?: string;
    buttonText?: string;
    className?: string;
}

export function DownloadDocumentButton({
    document: doc,
    vendorName = "SAMSUNG",
    buttonText = "ดาวน์โหลดเอกสาร",
    className = "",
}: DownloadDocumentButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Button onClick={() => setIsOpen(true)} className={className}>
                <Download className="w-4 h-4 mr-2" />
                {buttonText}
            </Button>

            <DocumentPreviewModal
                document={doc}
                vendorName={vendorName}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </>
    );
}

// Quick Download - ไม่ต้อง Preview (ซ่อน Template แล้วดาวน์โหลดเลย)
interface QuickDownloadButtonProps {
    document: DocumentData;
    vendorName?: string;
    buttonText?: string;
    className?: string;
}

export function QuickDownloadButton({
    document: doc,
    vendorName = "SAMSUNG",
    buttonText = "ดาวน์โหลดเอกสาร",
    className = "",
}: QuickDownloadButtonProps) {
    const [downloading, setDownloading] = useState(false);
    const [showHidden, setShowHidden] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        setShowHidden(true);

        // รอให้ Template render เสร็จ
        await new Promise((resolve) => setTimeout(resolve, 100));

        try {
            const success = await downloadAsImage("document-to-print", `${doc.docCode}`);
            if (!success) {
                alert("ไม่สามารถสร้างรูปภาพได้");
            }
        } catch (error) {
            console.error("Download error:", error);
            alert("เกิดข้อผิดพลาดในการดาวน์โหลด");
        } finally {
            setDownloading(false);
            setShowHidden(false);
        }
    };

    return (
        <>
            <Button onClick={handleDownload} disabled={downloading} className={className}>
                {downloading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        กำลังสร้างรูป...
                    </>
                ) : (
                    <>
                        <Download className="w-4 h-4 mr-2" />
                        {buttonText}
                    </>
                )}
            </Button>

            {/* Hidden Template สำหรับ Render */}
            {showHidden && (
                <div
                    style={{
                        position: "fixed",
                        left: "-9999px",
                        top: 0,
                    }}
                >
                    <DocumentTemplateSelector document={doc} />
                </div>
            )}
        </>
    );
}