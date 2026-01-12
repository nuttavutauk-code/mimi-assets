"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadAsImage } from "@/lib/downloadDocument";

const mockDocument = {
    docCode: "RT25010701",
    fullName: "สมชาย ใจดี",
    company: "บริษัท ABC จำกัด",
    phone: "081-234-5678",
    createdBy: { vendor: "SSG" },
    approvedAt: new Date().toISOString(), // วันที่ admin อนุมัติ
    note: "",
    shops: [
        {
            shopCode: "MCS001",
            shopName: "ร้านทดสอบ สาขา 1",
            startInstallDate: "2025-01-15",
            endInstallDate: "2025-01-20",
            q7b7: "Q7",
            shopFocus: "Focus A",
            assets: [
                { barcode: "AST001", name: "LED TV 55\"", kv: "KV001", qty: 2, withdrawFor: "WH Bangkok" },
                { barcode: "AST002", name: "Digital Signage 43\"", kv: "KV002", qty: 1, withdrawFor: "WH Bangkok" },
            ],
            securitySets: [
                { name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 2, withdrawFor: "WH Bangkok" },
                { name: "Security Type C Ver.7.1", qty: 5, withdrawFor: "WH Bangkok" },
                { name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
            ],
        },
        {
            shopCode: "MCS002",
            shopName: "ร้านทดสอบ สาขา 2",
            startInstallDate: "2025-01-22",
            endInstallDate: "2025-01-25",
            q7b7: "B7",
            shopFocus: "Focus B",
            assets: [
                { barcode: "AST003", name: "Monitor Stand", kv: "-", qty: 3, withdrawFor: "WH Bangkok" },
            ],
            securitySets: [
                { name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 1, withdrawFor: "WH Bangkok" },
                { name: "Security Type C Ver.7.1", qty: 3, withdrawFor: "WH Bangkok" },
                { name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
            ],
        },
        {
            shopCode: "MCS003",
            shopName: "ร้านทดสอบ สาขา 3",
            startInstallDate: "2025-01-28",
            endInstallDate: "2025-01-30",
            q7b7: "Q7",
            shopFocus: "Focus C",
            assets: [
                { barcode: "AST004", name: "LED Display 65\"", kv: "KV003", qty: 1, withdrawFor: "WH Bangkok" },
            ],
            securitySets: [
                { name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 1, withdrawFor: "WH Bangkok" },
                { name: "Security Type C Ver.7.1", qty: 2, withdrawFor: "WH Bangkok" },
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

// 🎨 Color Palette (เหมือนกับฟอร์มใบเบิก Asset)
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
    warning: "#f59e0b",
    warningBg: "#fffbeb",
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
            height: "18px",
            padding: "0 4px",
            fontSize: "9px",
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

const ThCell = ({
    children,
    width,
    bgColor,
    color,
}: {
    children?: React.ReactNode;
    width?: string;
    bgColor?: string;
    color?: string;
}) => (
    <th
        style={{
            width: width || "auto",
            border: `1px solid ${colors.border}`,
            height: "18px",
            padding: "0 4px",
            fontSize: "9px",
            fontWeight: 600,
            backgroundColor: bgColor || colors.subHeaderBg,
            color: color || colors.text,
            textAlign: "center",
            verticalAlign: "middle",
            fontFamily: fontFamily,
        }}
    >
        <span style={{ position: "relative", top: textOffset }}>{children}</span>
    </th>
);

// Shop Section Component
const ShopSection = ({
    shop,
    shopIndex,
    totalAssetRows = 6,
}: {
    shop: typeof mockDocument.shops[0];
    shopIndex: number;
    totalAssetRows?: number;
}) => {
    const assets = shop.assets || [];
    const securitySets = shop.securitySets || [];
    const emptyAssetRows = Math.max(0, totalAssetRows - assets.length);

    const defaultSecuritySets = [
        { name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 0, withdrawFor: "" },
        { name: "Security Type C Ver.7.1", qty: 0, withdrawFor: "" },
        { name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
    ];

    const displaySecuritySets = securitySets.length > 0 ? securitySets : defaultSecuritySets;

    return (
        <div style={{ marginBottom: "8px" }}>
            {/* Shop Info Row */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "2px" }}>
                <thead>
                    <tr>
                        <ThCell width="30px" bgColor={colors.headerBg} color={colors.white}>No.</ThCell>
                        <ThCell width="80px" bgColor={colors.headerBg} color={colors.white}>MCS Code</ThCell>
                        <ThCell bgColor={colors.headerBg} color={colors.white}>Shop Name</ThCell>
                        <ThCell width="90px" bgColor={colors.warning} color={colors.black}>วันที่เริ่มติดตั้ง</ThCell>
                        <ThCell width="90px" bgColor={colors.warning} color={colors.black}>วันที่ติดตั้งเสร็จ</ThCell>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <Cell width="30px" center>{shopIndex + 1}</Cell>
                        <Cell width="80px" center>{shop.shopCode || "-"}</Cell>
                        <Cell>{shop.shopName || "-"}</Cell>
                        <Cell width="90px" center>{formatDate(shop.startInstallDate)}</Cell>
                        <Cell width="90px" center>{formatDate(shop.endInstallDate)}</Cell>
                    </tr>
                </tbody>
            </table>

            {/* Shop Focus & Q7B7 */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", marginBottom: "4px", paddingLeft: "4px" }}>
                <div><strong>Shop Focus:</strong> {shop.shopFocus || "-"}</div>
                <div><strong>Q7B7:</strong> {shop.q7b7 || "-"}</div>
            </div>

            {/* Asset Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px" }}>
                <thead>
                    <tr>
                        <ThCell width="30px" bgColor={colors.headerBg} color={colors.white}>No.</ThCell>
                        <ThCell width="80px" bgColor={colors.headerBg} color={colors.white}>Barcode</ThCell>
                        <ThCell bgColor={colors.headerBg} color={colors.white}>Asset Name</ThCell>
                        <ThCell width="50px" bgColor={colors.headerBg} color={colors.white}>KV</ThCell>
                        <ThCell width="45px" bgColor={colors.headerBg} color={colors.white}>จำนวน</ThCell>
                        <ThCell width="70px" bgColor={colors.headerBg} color={colors.white}>เบิกที่โกดัง</ThCell>
                    </tr>
                </thead>
                <tbody>
                    {assets.map((asset, idx) => (
                        <tr key={idx}>
                            <Cell width="30px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                            <Cell width="80px" center isAlt={idx % 2 === 1}>{asset.barcode || "-"}</Cell>
                            <Cell isAlt={idx % 2 === 1}>{asset.name}</Cell>
                            <Cell width="50px" center isAlt={idx % 2 === 1}>{asset.kv || "-"}</Cell>
                            <Cell width="45px" center bold isAlt={idx % 2 === 1}>{asset.qty}</Cell>
                            <Cell width="70px" center isAlt={idx % 2 === 1}>{asset.withdrawFor || "-"}</Cell>
                        </tr>
                    ))}
                    {Array.from({ length: emptyAssetRows }).map((_, idx) => (
                        <tr key={`empty-${idx}`}>
                            <Cell width="30px" center isAlt={(assets.length + idx) % 2 === 1}>{assets.length + idx + 1}</Cell>
                            <Cell width="80px" center isAlt={(assets.length + idx) % 2 === 1} />
                            <Cell isAlt={(assets.length + idx) % 2 === 1} />
                            <Cell width="50px" center isAlt={(assets.length + idx) % 2 === 1} />
                            <Cell width="45px" center isAlt={(assets.length + idx) % 2 === 1} />
                            <Cell width="70px" center isAlt={(assets.length + idx) % 2 === 1} />
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Security Set Table */}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        <ThCell width="30px" bgColor={colors.subHeaderBg}>No.</ThCell>
                        <ThCell width="80px" bgColor={colors.subHeaderBg}>-</ThCell>
                        <ThCell bgColor={colors.subHeaderBg}>Security Set</ThCell>
                        <ThCell width="45px" bgColor={colors.subHeaderBg}>จำนวน</ThCell>
                        <ThCell width="70px" bgColor={colors.subHeaderBg}>เบิกที่โกดัง</ThCell>
                    </tr>
                </thead>
                <tbody>
                    {displaySecuritySets.map((security, idx) => (
                        <tr key={idx}>
                            <Cell width="30px" center>{idx + 1}</Cell>
                            <Cell width="80px" center>-</Cell>
                            <Cell>{security.name}</Cell>
                            <Cell width="45px" center bold>{security.qty > 0 ? security.qty : ""}</Cell>
                            <Cell width="70px" center>{security.withdrawFor || ""}</Cell>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default function PreviewDocumentRoutingPage() {
    const [downloading, setDownloading] = useState(false);
    const doc = mockDocument;

    const handleDownload = async () => {
        setDownloading(true);
        try {
            await downloadAsImage("document-to-print", doc.docCode);
        } finally {
            setDownloading(false);
        }
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
                            padding: "25px 35px",
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
                            marginBottom: "10px",
                        }}>
                            {/* Left - Title */}
                            <div>
                                <h1 style={{
                                    fontSize: "18px",
                                    fontWeight: 700,
                                    color: colors.primary,
                                    margin: 0,
                                    marginBottom: "5px",
                                }}>
                                    เอกสารเบิกสินทรัพย์ สำหรับงานส่งของตามภูมิภาค (Routing)
                                </h1>
                                <div style={{
                                    fontSize: "13px",
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
                                    padding: "8px 20px",
                                    fontWeight: 700,
                                    borderRadius: "4px",
                                    fontSize: "13px",
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
                                    {doc.createdBy?.vendor || "VENDOR NAME"}
                                </div>
                            </div>
                        </div>

                        {/* 🎨 Info Section */}
                        <div style={{
                            display: "flex",
                            gap: "20px",
                            marginBottom: "12px",
                            fontSize: "11px",
                        }}>
                            <div><strong>ชื่อ:</strong> {doc.fullName || "-"}</div>
                            <div><strong>บริษัท:</strong> {doc.company || "-"}</div>
                            <div><strong>เบอร์โทร:</strong> {doc.phone || "-"}</div>
                        </div>

                        {/* 🎨 Shop Sections */}
                        {doc.shops.map((shop, idx) => (
                            <ShopSection key={idx} shop={shop} shopIndex={idx} totalAssetRows={6} />
                        ))}

                        {/* 🎨 Note Section */}
                        <div style={{
                            marginBottom: "15px",
                            padding: "10px 12px",
                            backgroundColor: colors.warningBg,
                            border: `1px solid ${colors.warning}`,
                            borderRadius: "6px",
                            fontSize: "11px",
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
                            paddingTop: "10px",
                        }}>
                            <div style={{
                                width: "250px",
                                textAlign: "center",
                            }}>
                                <img
                                    src="/signature-cheil.png"
                                    alt="Signature"
                                    style={{
                                        height: "40px",
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
                                <div style={{ fontSize: "9px", color: "#718096", marginTop: "3px" }}>
                                    วันที่: {formatDateThai(doc.approvedAt)}
                                </div>
                            </div>
                            <div style={{
                                width: "250px",
                                textAlign: "center",
                            }}>
                                <div style={{ height: "40px", marginBottom: "5px" }}></div>
                                <div style={{
                                    borderTop: `2px solid ${colors.primary}`,
                                    paddingTop: "8px",
                                    fontSize: "11px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    ลงชื่อผู้รับของ / วันที่
                                </div>
                                <div style={{ fontSize: "9px", color: "#718096", marginTop: "3px" }}>
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