"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadAsImage } from "@/lib/downloadDocument";

const mockDocument = {
    docCode: "DP25010701",
    fullName: "สมชาย ใจดี",
    company: "บริษัท ABC จำกัด",
    phone: "081-234-5678",
    note: "หมายเหตุทดสอบระบบ",
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(), // วันที่ admin อนุมัติ
    createdBy: { vendor: "SSG" },
    shops: [
        {
            shopCode: "MCS001",
            shopName: "ร้านทดสอบ สาขา 1",
            startInstallDate: "2025-01-15",
            endInstallDate: "2025-01-20",
            q7b7: "Q7",
            shopFocus: "Focus A",
            assets: [
                { name: "LED TV", size: '55"', grade: "A", kv: "KV001", qty: 2, withdrawFor: "WH Bangkok" },
                { name: "Digital Signage", size: '43"', grade: "AB", kv: "KV002", qty: 1, withdrawFor: "WH Chonburi" },
                { name: "Monitor Stand", size: "L", grade: "B", kv: "-", qty: 3, withdrawFor: "WH Bangkok" },
            ],
            securitySets: [
                { name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 2, withdrawFor: "WH Bangkok" },
                { name: "Security Type C Ver.7.1", qty: 5, withdrawFor: "WH Bangkok" },
                { name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
            ],
        },
    ],
};

const formatDate = (date?: string | Date): string => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
};

// ฟังก์ชันแสดงวันที่แบบ วัน/เดือน/ปี(พ.ศ.)
const formatDateThai = (date?: string | Date): string => {
    if (!date) return "____/____/____";
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear() + 543; // แปลงเป็น พ.ศ.
    return `${day}/${month}/${year}`;
};

const fontFamily = "'Noto Sans Thai', sans-serif";
const textOffset = "-7px";

// 🎨 Color Palette
const colors = {
    primary: "#1a365d",      // Navy blue
    secondary: "#2c5282",    // Medium blue
    accent: "#3182ce",       // Light blue
    headerBg: "#1a365d",     // Header background
    subHeaderBg: "#e2e8f0",  // Sub header background
    rowAlt: "#f7fafc",       // Alternating row
    border: "#cbd5e0",       // Border color
    text: "#1a202c",         // Text color
    white: "#ffffff",
    black: "#000000",
};

const Cell = ({
    children,
    width,
    center = false,
    bold = false,
    bgColor,
    isAlt = false,
}: {
    children?: React.ReactNode;
    width?: string;
    center?: boolean;
    bold?: boolean;
    bgColor?: string;
    isAlt?: boolean;
}) => (
    <td
        style={{
            width: width || "auto",
            border: `1px solid ${colors.border}`,
            height: "26px",
            padding: "0 8px",
            fontSize: "11px",
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

export default function PreviewDocumentPage() {
    const [downloading, setDownloading] = useState(false);
    const doc = mockDocument;
    const shop = doc.shops?.[0];
    const assets = shop?.assets || [];
    const securitySets = shop?.securitySets || [];

    const totalAssetRows = 15;
    const emptyAssetRows = Math.max(0, totalAssetRows - assets.length);

    const defaultSecuritySets = [
        { name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 0, withdrawFor: "" },
        { name: "Security Type C Ver.7.1", qty: 0, withdrawFor: "" },
        { name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
    ];

    const displaySecuritySets = securitySets.length > 0 ? securitySets : defaultSecuritySets;
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
        height: "28px",
        padding: "0 8px",
        fontSize: "11px",
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
        height: "32px",
        padding: "0 8px",
        fontSize: "13px",
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
                            padding: "35px 45px",
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
                            marginBottom: "20px",
                            paddingBottom: "15px",
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
                                    เอกสารเบิกสินทรัพย์เฉพาะร้านค้า
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
                                {/* ✅ SAMSUNG badge พื้นหลังดำ */}
                                <div style={{
                                    backgroundColor: colors.black,
                                    color: colors.white,
                                    padding: "8px 24px",
                                    fontWeight: 700,
                                    borderRadius: "4px",
                                    fontSize: "14px",
                                    display: "inline-block",
                                    letterSpacing: "1px",
                                    marginBottom: "6px",
                                }}>
                                    <span style={{ position: "relative", top: textOffset }}>SAMSUNG</span>
                                </div>
                                {/* ✅ Vendor Name ข้างล่าง ไม่มีพื้นหลัง */}
                                <div style={{
                                    fontSize: "18px",
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
                            gap: "15px",
                            marginBottom: "20px",
                        }}>
                            {/* ข้อมูลผู้เบิก */}
                            <div style={{
                                width: "200px",
                                backgroundColor: colors.rowAlt,
                                borderRadius: "8px",
                                padding: "12px 15px",
                                border: `1px solid ${colors.border}`,
                            }}>
                                <div style={{
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    color: colors.secondary,
                                    marginBottom: "8px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    position: "relative",
                                    top: "-5px",
                                }}>
                                    ข้อมูลผู้เบิก
                                </div>
                                <div style={{ fontSize: "12px", lineHeight: 1.7 }}>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>ชื่อ:</strong> {doc.fullName || "-"}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>บริษัท:</strong> {doc.company || "-"}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>เบอร์โทร:</strong> {doc.phone || "-"}</div>
                                </div>
                            </div>

                            {/* ข้อมูลร้านค้า - ✅ ขยายความกว้าง */}
                            <div style={{
                                flex: 1,
                                backgroundColor: colors.rowAlt,
                                borderRadius: "8px",
                                padding: "12px 15px",
                                border: `1px solid ${colors.border}`,
                            }}>
                                <div style={{
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    color: colors.secondary,
                                    marginBottom: "8px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    position: "relative",
                                    top: "-5px",
                                }}>
                                    ข้อมูลร้านค้า
                                </div>
                                <div style={{ fontSize: "12px", lineHeight: 1.7 }}>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>MCS Code:</strong> {shop?.shopCode || "-"}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>Shop:</strong> {shop?.shopName || "-"}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>Shop Focus:</strong> {shop?.shopFocus || "-"} | <strong>Q7B7:</strong> {shop?.q7b7 || "-"}</div>
                                </div>
                            </div>

                            {/* วันที่ - ✅ ลดความกว้าง */}
                            <div style={{
                                width: "150px",
                                backgroundColor: colors.rowAlt,
                                borderRadius: "8px",
                                padding: "12px 15px",
                                border: `1px solid ${colors.border}`,
                            }}>
                                <div style={{
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    color: colors.secondary,
                                    marginBottom: "8px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    position: "relative",
                                    top: "-5px",
                                }}>
                                    กำหนดการติดตั้ง
                                </div>
                                <div style={{ fontSize: "12px", lineHeight: 1.7 }}>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>เริ่ม:</strong> {formatDate(shop?.startInstallDate)}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>เสร็จ:</strong> {formatDate(shop?.endInstallDate)}</div>
                                </div>
                            </div>
                        </div>

                        {/* 🎨 Asset Table */}
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px", borderRadius: "8px", overflow: "hidden" }}>
                            <thead>
                                <tr>
                                    <th colSpan={5} style={headerStyle}>
                                        <span style={{ position: "relative", top: textOffset }}>📦 รายละเอียด Asset</span>
                                    </th>
                                </tr>
                                <tr>
                                    <th style={{ ...thStyle, width: "40px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                                    <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                                    <th style={{ ...thStyle, width: "55px" }}><span style={{ position: "relative", top: textOffset }}>KV</span></th>
                                    <th style={{ ...thStyle, width: "55px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                                    <th style={{ ...thStyle, width: "95px" }}><span style={{ position: "relative", top: textOffset }}>เบิกที่โกดัง</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {assets.map((asset, idx) => (
                                    <tr key={idx}>
                                        <Cell width="40px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                                        <Cell isAlt={idx % 2 === 1}>{asset.name}{asset.size ? ` (${asset.size})` : ""}{asset.grade ? ` [${asset.grade}]` : ""}</Cell>
                                        <Cell width="55px" center isAlt={idx % 2 === 1}>{asset.kv || "-"}</Cell>
                                        <Cell width="55px" center bold isAlt={idx % 2 === 1}>{asset.qty}</Cell>
                                        <Cell width="95px" center isAlt={idx % 2 === 1}>{asset.withdrawFor || "-"}</Cell>
                                    </tr>
                                ))}
                                {Array.from({ length: emptyAssetRows }).map((_, idx) => (
                                    <tr key={`empty-${idx}`}>
                                        <Cell width="40px" center isAlt={(assets.length + idx) % 2 === 1}>{assets.length + idx + 1}</Cell>
                                        <Cell isAlt={(assets.length + idx) % 2 === 1} />
                                        <Cell width="55px" center isAlt={(assets.length + idx) % 2 === 1} />
                                        <Cell width="55px" center isAlt={(assets.length + idx) % 2 === 1} />
                                        <Cell width="95px" center isAlt={(assets.length + idx) % 2 === 1} />
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 🎨 Security Set Table */}
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", borderRadius: "8px", overflow: "hidden" }}>
                            <thead>
                                <tr>
                                    <th colSpan={4} style={headerStyle}>
                                        <span style={{ position: "relative", top: textOffset }}>🔐 รายละเอียด Security Set</span>
                                    </th>
                                </tr>
                                <tr>
                                    <th style={{ ...thStyle, width: "40px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                                    <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                                    <th style={{ ...thStyle, width: "55px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                                    <th style={{ ...thStyle, width: "95px" }}><span style={{ position: "relative", top: textOffset }}>เบิกที่โกดัง</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {displaySecuritySets.map((security, idx) => (
                                    <tr key={idx}>
                                        <Cell width="40px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                                        <Cell isAlt={idx % 2 === 1}>{security.name}</Cell>
                                        <Cell width="55px" center bold isAlt={idx % 2 === 1}>{security.qty > 0 ? security.qty : ""}</Cell>
                                        <Cell width="95px" center isAlt={idx % 2 === 1}>{security.withdrawFor || ""}</Cell>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 🎨 Note Section */}
                        <div style={{
                            marginBottom: "25px",
                            padding: "12px 15px",
                            backgroundColor: "#fffbeb",
                            border: "1px solid #f59e0b",
                            borderRadius: "6px",
                            fontSize: "12px",
                        }}>
                            <span style={{ position: "relative", top: textOffset }}>
                                <strong style={{ color: "#b45309" }}>📝 หมายเหตุ:</strong> {doc.note || "-"}
                            </span>
                        </div>

                        {/* 🎨 Signature Section */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                            marginTop: "auto",
                            paddingTop: "20px",
                        }}>
                            <div style={{
                                width: "280px",
                                textAlign: "center",
                            }}>
                                {/* ✅ รูปลายเซ็น */}
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
                                    paddingTop: "10px",
                                    fontSize: "12px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    Approved by Cheil
                                </div>
                                <div style={{ fontSize: "10px", color: "#718096", marginTop: "5px" }}>
                                    วันที่: {formatDateThai(doc.approvedAt)}
                                </div>
                            </div>
                            <div style={{
                                width: "280px",
                                textAlign: "center",
                            }}>
                                {/* ✅ เพิ่มพื้นที่ว่างสำหรับลายเซ็นผู้รับ */}
                                <div style={{ height: "50px", marginBottom: "5px" }}></div>
                                <div style={{
                                    borderTop: `2px solid ${colors.primary}`,
                                    paddingTop: "10px",
                                    fontSize: "12px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    ลงชื่อผู้รับของ
                                </div>
                                <div style={{ fontSize: "10px", color: "#718096", marginTop: "5px" }}>
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