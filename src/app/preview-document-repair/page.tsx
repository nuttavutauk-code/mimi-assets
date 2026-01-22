"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadAsImage } from "@/lib/downloadDocument";

const mockDocument = {
    docCode: "RP25010701",
    fullName: "สมชาย ใจดี",
    company: "บริษัท ABC จำกัด",
    phone: "081-234-5678",
    note: "อุปกรณ์ชำรุดจากการใช้งาน ต้องการเปลี่ยนอะไหล่",
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    createdBy: { vendor: "SSG" },
    shops: [
        {
            startInstallDate: "2025-01-15", // วันที่ส่งซ่อม
            assets: [
                { barcode: "AST001", name: "Kiosk Y22 - Detachable Logo", size: '', grade: "C", qty: 1 },
                { barcode: "AST002", name: "Shelf Display B", size: '60x40cm', grade: "D", qty: 1 },
                { barcode: "AST003", name: "Counter Stand", size: "L", grade: "CD", qty: 1 },
            ],
        },
    ],
};

const formatDate = (date?: string | Date): string => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const formatDateThai = (date?: string | Date): string => {
    if (!date) return "____/____/____";
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear() + 543;
    return `${day}/${month}/${year}`;
};

const fontFamily = "'Noto Sans Thai', sans-serif";
const textOffset = "-7px";

const colors = {
    primary: "#1a365d",
    secondary: "#2c5282",
    accent: "#3182ce",
    headerBg: "#1a365d",
    subHeaderBg: "#e2e8f0",
    rowAlt: "#f7fafc",
    border: "#cbd5e0",
    text: "#1a202c",
    white: "#ffffff",
    black: "#000000",
    warningBg: "#fffbeb",
    warning: "#f59e0b",
    dangerBg: "#fef2f2",
    danger: "#ef4444",
};

const Cell = ({
    children,
    width,
    center = false,
    bold = false,
    bgColor,
    isAlt = false,
    hasImage = false,
}: {
    children?: React.ReactNode;
    width?: string;
    center?: boolean;
    bold?: boolean;
    bgColor?: string;
    isAlt?: boolean;
    hasImage?: boolean;
}) => (
    <td
        style={{
            width: width || "auto",
            border: `1px solid ${colors.border}`,
            height: hasImage ? "80px" : "28px",
            padding: "2px 6px",
            fontSize: "10px",
            fontWeight: bold ? 600 : 400,
            backgroundColor: bgColor || (isAlt ? colors.rowAlt : colors.white),
            color: colors.text,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textAlign: center ? "center" : "left",
            verticalAlign: "middle",
            fontFamily: fontFamily,
        }}
    >
        <span style={{ position: "relative", top: textOffset }}>{children || "\u00A0"}</span>
    </td>
);

export default function PreviewDocumentRepairPage() {
    const [downloading, setDownloading] = useState(false);

    const doc = mockDocument;
    const shop = doc.shops?.[0];
    const assets = shop?.assets || [];

    const totalAssetRows = 6;
    const emptyAssetRows = Math.max(0, totalAssetRows - assets.length);

    const vendorName = doc.createdBy?.vendor || "N/A";

    const handleDownload = async () => {
        setDownloading(true);
        try {
            await downloadAsImage("document-to-print", doc.docCode);
        } finally {
            setDownloading(false);
        }
    };

    const thStyle: React.CSSProperties = {
        border: `1px solid ${colors.border}`,
        height: "26px",
        padding: "0 6px",
        fontSize: "10px",
        fontWeight: 600,
        backgroundColor: colors.subHeaderBg,
        color: colors.text,
        textAlign: "center",
        verticalAlign: "middle",
        fontFamily: fontFamily,
    };

    const headerStyle: React.CSSProperties = {
        backgroundColor: colors.headerBg,
        color: colors.white,
        height: "28px",
        padding: "0 8px",
        fontSize: "11px",
        fontWeight: 600,
        textAlign: "center",
        verticalAlign: "middle",
        fontFamily: fontFamily,
        letterSpacing: "0.5px",
    };

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />

            <div style={{ backgroundColor: "#525659", minHeight: "100vh", padding: "20px", fontFamily: fontFamily }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px", gap: "10px" }}>
                    <Button onClick={handleDownload} disabled={downloading} className="bg-green-600 hover:bg-green-700">
                        {downloading ? "กำลังสร้างรูป..." : "ดาวน์โหลดรูปภาพ"}
                    </Button>
                </div>

                <div style={{ display: "flex", justifyContent: "center" }}>
                    <div
                        id="document-to-print"
                        style={{
                            width: "794px",
                            height: "1123px",
                            padding: "30px 40px",
                            backgroundColor: colors.white,
                            boxSizing: "border-box",
                            fontFamily: fontFamily,
                            fontSize: "12px",
                            color: colors.text,
                            overflow: "hidden",
                        }}
                    >
                        {/* 🎨 Header Section */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "15px",
                            paddingBottom: "10px",
                            borderBottom: `3px solid ${colors.primary}`,
                        }}>
                            {/* Left - Title */}
                            <div>
                                <h1 style={{
                                    fontSize: "22px",
                                    fontWeight: 700,
                                    color: colors.primary,
                                    margin: 0,
                                    marginBottom: "5px",
                                }}>
                                    🔧 เอกสารแจ้งซ่อม Asset
                                </h1>
                                <div style={{
                                    fontSize: "14px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    เลขที่: <span style={{ fontWeight: 700 }}>{doc.docCode}</span>
                                </div>
                            </div>

                            {/* Right - Samsung & Vendor */}
                            <div style={{ textAlign: "right" }}>
                                <div style={{
                                    backgroundColor: colors.black,
                                    color: colors.white,
                                    padding: "6px 20px",
                                    fontWeight: 700,
                                    borderRadius: "4px",
                                    fontSize: "13px",
                                    display: "inline-block",
                                    letterSpacing: "1px",
                                    marginBottom: "5px",
                                }}>
                                    <span style={{ position: "relative", top: textOffset }}>SAMSUNG</span>
                                </div>
                                <div style={{
                                    fontSize: "16px",
                                    fontWeight: 700,
                                    color: colors.primary,
                                }}>
                                    {vendorName}
                                </div>
                            </div>
                        </div>

                        {/* 🎨 Info Cards Section */}
                        <div style={{
                            display: "flex",
                            gap: "10px",
                            marginBottom: "15px",
                        }}>
                            {/* ข้อมูลผู้แจ้งซ่อม */}
                            <div style={{
                                flex: 1,
                                backgroundColor: colors.rowAlt,
                                borderRadius: "6px",
                                padding: "10px 15px",
                                border: `1px solid ${colors.border}`,
                            }}>
                                <div style={{
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    color: colors.secondary,
                                    marginBottom: "6px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    position: "relative",
                                    top: "-5px",
                                }}>
                                    ข้อมูลผู้แจ้งซ่อม
                                </div>
                                <div style={{ fontSize: "11px", lineHeight: 1.5 }}>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>ชื่อ:</strong> {doc.fullName || "-"}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>บริษัท:</strong> {doc.company || "-"}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>เบอร์โทร:</strong> {doc.phone || "-"}</div>
                                </div>
                            </div>

                            {/* วันที่ส่งซ่อม */}
                            <div style={{
                                width: "180px",
                                backgroundColor: colors.dangerBg,
                                borderRadius: "6px",
                                padding: "10px 15px",
                                border: `1px solid ${colors.danger}`,
                            }}>
                                <div style={{
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    color: "#dc2626",
                                    marginBottom: "6px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    position: "relative",
                                    top: "-5px",
                                }}>
                                    📅 วันที่ส่งซ่อม
                                </div>
                                <div style={{
                                    fontSize: "16px",
                                    fontWeight: 700,
                                    color: "#991b1b",
                                    position: "relative",
                                    top: "-5px",
                                }}>
                                    {formatDate(shop?.startInstallDate)}
                                </div>
                            </div>
                        </div>

                        {/* 🎨 Asset Table */}
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px", borderRadius: "8px", overflow: "hidden" }}>
                            <thead>
                                <tr>
                                    <th colSpan={6} style={headerStyle}>
                                        <span style={{ position: "relative", top: textOffset }}>🔧 รายการ Asset ที่แจ้งซ่อม</span>
                                    </th>
                                </tr>
                                <tr>
                                    <th style={{ ...thStyle, width: "35px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                                    <th style={{ ...thStyle, width: "100px" }}><span style={{ position: "relative", top: textOffset }}>Barcode</span></th>
                                    <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                                    <th style={{ ...thStyle, width: "80px" }}><span style={{ position: "relative", top: textOffset }}>Size</span></th>
                                    <th style={{ ...thStyle, width: "60px" }}><span style={{ position: "relative", top: textOffset }}>เกรด</span></th>
                                    <th style={{ ...thStyle, width: "60px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {assets.map((asset, idx) => (
                                    <tr key={idx}>
                                        <Cell width="35px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                                        <Cell width="100px" center isAlt={idx % 2 === 1}>{asset.barcode || "-"}</Cell>
                                        <Cell isAlt={idx % 2 === 1}>{asset.name}</Cell>
                                        <Cell width="80px" center isAlt={idx % 2 === 1}>{asset.size || "-"}</Cell>
                                        <Cell width="60px" center isAlt={idx % 2 === 1}>{asset.grade || "-"}</Cell>
                                        <Cell width="60px" center bold isAlt={idx % 2 === 1}>{asset.qty}</Cell>
                                    </tr>
                                ))}
                                {Array.from({ length: emptyAssetRows }).map((_, idx) => (
                                    <tr key={`empty-${idx}`}>
                                        <Cell width="35px" center isAlt={(assets.length + idx) % 2 === 1}>{assets.length + idx + 1}</Cell>
                                        <Cell width="100px" center isAlt={(assets.length + idx) % 2 === 1} />
                                        <Cell isAlt={(assets.length + idx) % 2 === 1} />
                                        <Cell width="80px" center isAlt={(assets.length + idx) % 2 === 1} />
                                        <Cell width="60px" center isAlt={(assets.length + idx) % 2 === 1} />
                                        <Cell width="60px" center isAlt={(assets.length + idx) % 2 === 1} />
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 🎨 Note Section */}
                        <div style={{
                            marginBottom: "20px",
                            padding: "10px 15px",
                            backgroundColor: colors.warningBg,
                            border: `1px solid ${colors.warning}`,
                            borderRadius: "6px",
                            fontSize: "11px",
                        }}>
                            <span style={{ position: "relative", top: textOffset }}>
                                <strong style={{ color: "#b45309" }}>📝 รายละเอียด/อาการเสีย:</strong> {doc.note || "-"}
                            </span>
                        </div>

                        {/* 🎨 Signature Section - 2 แถว */}
                        {/* แถวที่ 1: ผู้แจ้งซ่อม, ผู้รับเรื่อง */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-around",
                            alignItems: "flex-end",
                            marginBottom: "20px",
                        }}>
                            {/* ลงชื่อผู้แจ้งซ่อม */}
                            <div style={{
                                width: "220px",
                                textAlign: "center",
                            }}>
                                <div style={{ height: "50px", marginBottom: "5px" }}></div>
                                <div style={{
                                    borderTop: `2px solid ${colors.primary}`,
                                    paddingTop: "8px",
                                    fontSize: "11px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    ลงชื่อผู้แจ้งซ่อม
                                </div>
                                <div style={{ fontSize: "9px", color: "#718096", marginTop: "4px" }}>
                                    วันที่: ____/____/____
                                </div>
                            </div>

                            {/* ลงชื่อผู้รับเรื่อง */}
                            <div style={{
                                width: "220px",
                                textAlign: "center",
                            }}>
                                <div style={{ height: "50px", marginBottom: "5px" }}></div>
                                <div style={{
                                    borderTop: `2px solid ${colors.primary}`,
                                    paddingTop: "8px",
                                    fontSize: "11px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    ลงชื่อผู้รับเรื่อง
                                </div>
                                <div style={{ fontSize: "9px", color: "#718096", marginTop: "4px" }}>
                                    วันที่: ____/____/____
                                </div>
                            </div>
                        </div>

                        {/* แถวที่ 2: Approved by Cheil, ผู้ส่งมอบงาน */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-around",
                            alignItems: "flex-end",
                        }}>
                            {/* Approved by Cheil */}
                            <div style={{
                                width: "220px",
                                textAlign: "center",
                            }}>
                                <img
                                    src="/signature-cheil.png"
                                    alt="Signature"
                                    style={{
                                        height: "50px",
                                        marginBottom: "5px",
                                    }}
                                />
                                <div style={{
                                    borderTop: `2px solid ${colors.primary}`,
                                    paddingTop: "8px",
                                    fontSize: "11px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    Approved by Cheil
                                </div>
                                <div style={{ fontSize: "9px", color: "#718096", marginTop: "4px" }}>
                                    วันที่: {formatDateThai(doc.approvedAt)}
                                </div>
                            </div>

                            {/* ลงชื่อผู้ส่งมอบงาน (ซ่อมเสร็จ) */}
                            <div style={{
                                width: "220px",
                                textAlign: "center",
                            }}>
                                <div style={{ height: "50px", marginBottom: "5px" }}></div>
                                <div style={{
                                    borderTop: `2px solid ${colors.primary}`,
                                    paddingTop: "8px",
                                    fontSize: "11px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    ลงชื่อผู้ส่งมอบงาน (ซ่อมเสร็จ)
                                </div>
                                <div style={{ fontSize: "9px", color: "#718096", marginTop: "4px" }}>
                                    วันที่: ____/____/____
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}