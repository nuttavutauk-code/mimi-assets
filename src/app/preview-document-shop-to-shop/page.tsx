"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { downloadAsImage } from "@/lib/downloadDocument";

const mockDocument = {
    docCode: "S2S25010701",
    fullName: "สมชาย ใจดี",
    company: "บริษัท ABC จำกัด",
    phone: "081-234-5678",
    note: "ย้ายของจากร้านสาขา 1 ไปสาขา 2",
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    createdBy: { vendor: "SSG" },
    shops: [
        // Shop ต้นทาง (index 0)
        {
            shopCode: "MCS001",
            shopName: "ร้านต้นทาง สาขา 1",
            startInstallDate: "2025-01-15",
            endInstallDate: "2025-01-20",
            q7b7: "Q7",
            shopFocus: "Focus A",
            assets: [
                { barcode: "AST001", name: "Kiosk Y22 - Detachable Logo", size: '', grade: "A", qty: 1, withdrawFor: "WH Bangkok" },
                { barcode: "AST002", name: "Shelf Display B", size: '60x40cm', grade: "AB", qty: 1, withdrawFor: "WH Chonburi" },
                { barcode: "AST003", name: "Counter Stand", size: "L", grade: "B", qty: 1, withdrawFor: "WH Bangkok" },
            ],
            securitySets: [
                { name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 2, withdrawFor: "WH Bangkok" },
                { name: "Security Type C Ver.7.1", qty: 5, withdrawFor: "WH Bangkok" },
                { name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
            ],
        },
        // Shop ปลายทาง (index 1)
        {
            shopCode: "MCS002",
            shopName: "ร้านปลายทาง สาขา 2",
            q7b7: "B7",
            shopFocus: "Focus B",
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
    successBg: "#f0fdf4",
    success: "#22c55e",
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
            height: hasImage ? "70px" : "24px",
            padding: "2px 5px",
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

// Cell สำหรับรูปภาพ
const ImageCell = ({
    imageUrl,
    isAlt = false,
}: {
    imageUrl: string | null;
    isAlt?: boolean;
}) => (
    <td
        style={{
            width: "70px",
            border: `1px solid ${colors.border}`,
            height: "70px",
            padding: "3px",
            backgroundColor: isAlt ? colors.rowAlt : colors.white,
            textAlign: "center",
            verticalAlign: "middle",
        }}
    >
        {imageUrl ? (
            <img
                src={imageUrl}
                alt="Asset"
                style={{
                    maxHeight: "60px",
                    maxWidth: "60px",
                    objectFit: "contain"
                }}
            />
        ) : (
            <span style={{ fontSize: "8px", color: "#999" }}>-</span>
        )}
    </td>
);

export default function PreviewDocumentShopToShopPage() {
    const [downloading, setDownloading] = useState(false);
    const [assetImages, setAssetImages] = useState<Record<string, string | null>>({});
    const [loadingImages, setLoadingImages] = useState(true);

    const doc = mockDocument;
    const shopSource = doc.shops?.[0]; // ต้นทาง
    const shopDest = doc.shops?.[1]; // ปลายทาง
    const assets = shopSource?.assets || [];
    const securitySets = shopSource?.securitySets || [];

    const totalAssetRows = 4;
    const emptyAssetRows = Math.max(0, totalAssetRows - assets.length);

    const defaultSecuritySets = [
        { name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 0, withdrawFor: "" },
        { name: "Security Type C Ver.7.1", qty: 0, withdrawFor: "" },
        { name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
    ];

    const displaySecuritySets = securitySets.length > 0 ? securitySets : defaultSecuritySets;

    // Fetch รูปภาพจาก API
    useEffect(() => {
        const fetchImages = async () => {
            try {
                const assetNames = assets.map((a) => a.name);
                const res = await fetch("/api/library/get-image", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ assetNames }),
                });
                const data = await res.json();
                setAssetImages(data.images || {});
            } catch (err) {
                console.error("Failed to fetch images:", err);
            } finally {
                setLoadingImages(false);
            }
        };

        if (assets.length > 0) {
            fetchImages();
        } else {
            setLoadingImages(false);
        }
    }, []);

    const getAssetImage = (assetName: string): string | null => {
        return assetImages[assetName] || null;
    };

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
        height: "22px",
        padding: "0 4px",
        fontSize: "8px",
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
        height: "24px",
        padding: "0 8px",
        fontSize: "10px",
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
                            padding: "25px 35px",
                            backgroundColor: colors.white,
                            boxSizing: "border-box",
                            fontFamily: fontFamily,
                            fontSize: "11px",
                            color: colors.text,
                            overflow: "hidden",
                        }}
                    >
                        {/* 🎨 Header Section */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "8px",
                            paddingBottom: "6px",
                            borderBottom: `3px solid ${colors.primary}`,
                        }}>
                            {/* Left - Title */}
                            <div>
                                <h1 style={{
                                    fontSize: "18px",
                                    fontWeight: 700,
                                    color: colors.primary,
                                    margin: 0,
                                    marginBottom: "3px",
                                }}>
                                    เอกสารย้าย Asset ระหว่างร้าน (Shop To Shop)
                                </h1>
                                <div style={{
                                    fontSize: "12px",
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
                                    padding: "5px 18px",
                                    fontWeight: 700,
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    display: "inline-block",
                                    letterSpacing: "1px",
                                    marginBottom: "3px",
                                }}>
                                    <span style={{ position: "relative", top: textOffset }}>SAMSUNG</span>
                                </div>
                                <div style={{
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: colors.primary,
                                }}>
                                    {vendorName}
                                </div>
                            </div>
                        </div>

                        {/* 🎨 ข้อมูลผู้ย้าย */}
                        <div style={{
                            backgroundColor: colors.rowAlt,
                            borderRadius: "6px",
                            padding: "6px 10px",
                            border: `1px solid ${colors.border}`,
                            marginBottom: "6px",
                        }}>
                            <div style={{
                                fontSize: "8px",
                                fontWeight: 600,
                                color: colors.secondary,
                                marginBottom: "3px",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                position: "relative",
                                top: "-5px",
                            }}>
                                ข้อมูลผู้ย้าย
                            </div>
                            <div style={{ fontSize: "9px", display: "flex", gap: "20px" }}>
                                <div style={{ position: "relative", top: "-5px" }}><strong>ชื่อ:</strong> {doc.fullName || "-"}</div>
                                <div style={{ position: "relative", top: "-5px" }}><strong>บริษัท:</strong> {doc.company || "-"}</div>
                                <div style={{ position: "relative", top: "-5px" }}><strong>เบอร์โทร:</strong> {doc.phone || "-"}</div>
                            </div>
                        </div>

                        {/* 🎨 Shop Cards - ต้นทาง & ปลายทาง */}
                        <div style={{
                            display: "flex",
                            gap: "8px",
                            marginBottom: "6px",
                        }}>
                            {/* Shop ต้นทาง */}
                            <div style={{
                                flex: 1,
                                backgroundColor: colors.warningBg,
                                borderRadius: "6px",
                                padding: "6px 10px",
                                border: `1px solid ${colors.warning}`,
                            }}>
                                <div style={{
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    color: "#b45309",
                                    marginBottom: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "5px",
                                }}>
                                    <span style={{ position: "relative", top: textOffset }}>📤 ร้านต้นทาง (ย้ายออก)</span>
                                </div>
                                <div style={{ fontSize: "9px", lineHeight: 1.4 }}>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>MCS Code:</strong> {shopSource?.shopCode || "-"}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>Shop:</strong> {shopSource?.shopName || "-"}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>Shop Focus:</strong> {shopSource?.shopFocus || "-"} | <strong>Q7B7:</strong> {shopSource?.q7b7 || "-"}</div>
                                </div>
                            </div>

                            {/* Arrow */}
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                fontSize: "24px",
                                color: colors.primary,
                                fontWeight: "bold",
                            }}>
                                →
                            </div>

                            {/* Shop ปลายทาง */}
                            <div style={{
                                flex: 1,
                                backgroundColor: colors.successBg,
                                borderRadius: "6px",
                                padding: "6px 10px",
                                border: `1px solid ${colors.success}`,
                            }}>
                                <div style={{
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    color: "#166534",
                                    marginBottom: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "5px",
                                }}>
                                    <span style={{ position: "relative", top: textOffset }}>📥 ร้านปลายทาง (ย้ายเข้า)</span>
                                </div>
                                <div style={{ fontSize: "9px", lineHeight: 1.4 }}>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>MCS Code:</strong> {shopDest?.shopCode || "-"}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>Shop:</strong> {shopDest?.shopName || "-"}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>Shop Focus:</strong> {shopDest?.shopFocus || "-"} | <strong>Q7B7:</strong> {shopDest?.q7b7 || "-"}</div>
                                </div>
                            </div>

                            {/* วันที่ */}
                            <div style={{
                                width: "120px",
                                backgroundColor: colors.rowAlt,
                                borderRadius: "6px",
                                padding: "6px 10px",
                                border: `1px solid ${colors.border}`,
                            }}>
                                <div style={{
                                    fontSize: "8px",
                                    fontWeight: 600,
                                    color: colors.secondary,
                                    marginBottom: "3px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    position: "relative",
                                    top: "-5px",
                                }}>
                                    กำหนดการย้าย
                                </div>
                                <div style={{ fontSize: "9px", lineHeight: 1.4 }}>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>เริ่ม:</strong> {formatDate(shopSource?.startInstallDate)}</div>
                                    <div style={{ position: "relative", top: "-5px" }}><strong>เสร็จ:</strong> {formatDate(shopSource?.endInstallDate)}</div>
                                </div>
                            </div>
                        </div>

                        {/* 🎨 Asset Table */}
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "5px", borderRadius: "8px", overflow: "hidden" }}>
                            <thead>
                                <tr>
                                    <th colSpan={8} style={headerStyle}>
                                        <span style={{ position: "relative", top: textOffset }}>📦 รายละเอียด Asset ที่ย้าย</span>
                                    </th>
                                </tr>
                                <tr>
                                    <th style={{ ...thStyle, width: "25px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                                    <th style={{ ...thStyle, width: "70px" }}><span style={{ position: "relative", top: textOffset }}>Barcode</span></th>
                                    <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                                    <th style={{ ...thStyle, width: "70px" }}><span style={{ position: "relative", top: textOffset }}>รูปภาพ</span></th>
                                    <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>Size</span></th>
                                    <th style={{ ...thStyle, width: "35px" }}><span style={{ position: "relative", top: textOffset }}>เกรด</span></th>
                                    <th style={{ ...thStyle, width: "30px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                                    <th style={{ ...thStyle, width: "70px" }}><span style={{ position: "relative", top: textOffset }}>โกดัง</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {assets.map((asset, idx) => (
                                    <tr key={idx}>
                                        <Cell width="25px" center isAlt={idx % 2 === 1} hasImage>{idx + 1}</Cell>
                                        <Cell width="70px" center isAlt={idx % 2 === 1} hasImage>{asset.barcode || "-"}</Cell>
                                        <Cell isAlt={idx % 2 === 1} hasImage>{asset.name}</Cell>
                                        <ImageCell imageUrl={getAssetImage(asset.name)} isAlt={idx % 2 === 1} />
                                        <Cell width="50px" center isAlt={idx % 2 === 1} hasImage>{asset.size || "-"}</Cell>
                                        <Cell width="35px" center isAlt={idx % 2 === 1} hasImage>{asset.grade || "-"}</Cell>
                                        <Cell width="30px" center bold isAlt={idx % 2 === 1} hasImage>{asset.qty}</Cell>
                                        <Cell width="70px" center isAlt={idx % 2 === 1} hasImage>{asset.withdrawFor || "-"}</Cell>
                                    </tr>
                                ))}
                                {Array.from({ length: emptyAssetRows }).map((_, idx) => (
                                    <tr key={`empty-${idx}`}>
                                        <Cell width="25px" center isAlt={(assets.length + idx) % 2 === 1} hasImage>{assets.length + idx + 1}</Cell>
                                        <Cell width="70px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                        <Cell isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                        <ImageCell imageUrl={null} isAlt={(assets.length + idx) % 2 === 1} />
                                        <Cell width="50px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                        <Cell width="35px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                        <Cell width="30px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                        <Cell width="70px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 🎨 Security Set Table */}
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "5px", borderRadius: "8px", overflow: "hidden" }}>
                            <thead>
                                <tr>
                                    <th colSpan={4} style={headerStyle}>
                                        <span style={{ position: "relative", top: textOffset }}>🔐 รายละเอียด Security Set ที่ย้าย</span>
                                    </th>
                                </tr>
                                <tr>
                                    <th style={{ ...thStyle, width: "30px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                                    <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                                    <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                                    <th style={{ ...thStyle, width: "80px" }}><span style={{ position: "relative", top: textOffset }}>โกดัง</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {displaySecuritySets.map((security, idx) => (
                                    <tr key={idx}>
                                        <Cell width="30px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                                        <Cell isAlt={idx % 2 === 1}>{security.name}</Cell>
                                        <Cell width="50px" center bold isAlt={idx % 2 === 1}>{security.qty > 0 ? security.qty : ""}</Cell>
                                        <Cell width="80px" center isAlt={idx % 2 === 1}>{security.withdrawFor || ""}</Cell>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 🎨 Note Section */}
                        <div style={{
                            marginBottom: "8px",
                            padding: "5px 10px",
                            backgroundColor: colors.warningBg,
                            border: `1px solid ${colors.warning}`,
                            borderRadius: "6px",
                            fontSize: "9px",
                        }}>
                            <span style={{ position: "relative", top: textOffset }}>
                                <strong style={{ color: "#b45309" }}>📝 หมายเหตุ:</strong> {doc.note || "-"}
                            </span>
                        </div>

                        {/* 🎨 Signature Section - 2 แถว */}
                        {/* แถวที่ 1: ผู้ส่งของ, ผู้รับของ */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-around",
                            alignItems: "flex-end",
                            marginBottom: "15px",
                        }}>
                            {/* ลงชื่อผู้ส่งของร้านต้นทาง */}
                            <div style={{
                                width: "220px",
                                textAlign: "center",
                            }}>
                                <div style={{ height: "40px", marginBottom: "4px" }}></div>
                                <div style={{
                                    borderTop: `2px solid ${colors.primary}`,
                                    paddingTop: "6px",
                                    fontSize: "10px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    ลงชื่อผู้ส่งของ (ร้านต้นทาง)
                                </div>
                                <div style={{ fontSize: "8px", color: "#718096", marginTop: "3px" }}>
                                    วันที่: ____/____/____
                                </div>
                            </div>

                            {/* ลงชื่อผู้รับของร้านปลายทาง */}
                            <div style={{
                                width: "220px",
                                textAlign: "center",
                            }}>
                                <div style={{ height: "40px", marginBottom: "4px" }}></div>
                                <div style={{
                                    borderTop: `2px solid ${colors.primary}`,
                                    paddingTop: "6px",
                                    fontSize: "10px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    ลงชื่อผู้รับของ (ร้านปลายทาง)
                                </div>
                                <div style={{ fontSize: "8px", color: "#718096", marginTop: "3px" }}>
                                    วันที่: ____/____/____
                                </div>
                            </div>
                        </div>

                        {/* แถวที่ 2: Approved by Cheil, ผู้ขนส่ง */}
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
                                        height: "40px",
                                        marginBottom: "4px",
                                    }}
                                />
                                <div style={{
                                    borderTop: `2px solid ${colors.primary}`,
                                    paddingTop: "6px",
                                    fontSize: "10px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    Approved by Cheil
                                </div>
                                <div style={{ fontSize: "8px", color: "#718096", marginTop: "3px" }}>
                                    วันที่: {formatDateThai(doc.approvedAt)}
                                </div>
                            </div>

                            {/* ลงชื่อผู้ขนส่ง */}
                            <div style={{
                                width: "220px",
                                textAlign: "center",
                            }}>
                                <div style={{ height: "40px", marginBottom: "4px" }}></div>
                                <div style={{
                                    borderTop: `2px solid ${colors.primary}`,
                                    paddingTop: "6px",
                                    fontSize: "10px",
                                    color: colors.secondary,
                                    fontWeight: 500,
                                }}>
                                    ลงชื่อผู้ขนส่ง
                                </div>
                                <div style={{ fontSize: "8px", color: "#718096", marginTop: "3px" }}>
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