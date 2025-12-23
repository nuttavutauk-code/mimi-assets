"use client";

import { useState, useEffect } from "react";

interface DocumentTemplateSelectorProps {
    document: any;
}

// ============ Shared Utilities ============

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
    warning: "#f59e0b",
    warningBg: "#fffbeb",
    danger: "#ef4444",
    dangerBg: "#fef2f2",
    success: "#22c55e",
    successBg: "#f0fdf4",
};

// ============ Cell Component ============

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
            height: hasImage ? "90px" : "26px",
            padding: hasImage ? "4px" : "0 8px",
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

// ============ Image Cell Component ============

const ImageCell = ({
    imageUrl,
    isAlt = false,
}: {
    imageUrl: string | null;
    isAlt?: boolean;
}) => {
    // เพิ่ม cache-busting parameter เพื่อให้โหลดรูปใหม่ทุกครั้ง
    const getImageWithCacheBuster = (url: string | null) => {
        if (!url) return null;
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}t=${Date.now()}`;
    };

    return (
        <td
            style={{
                width: "85px",
                border: `1px solid ${colors.border}`,
                height: "90px",
                padding: "4px",
                backgroundColor: isAlt ? colors.rowAlt : colors.white,
                textAlign: "center",
                verticalAlign: "middle",
            }}
        >
            {imageUrl ? (
                <img
                    src={getImageWithCacheBuster(imageUrl) || imageUrl}
                    alt="Asset"
                    style={{ maxHeight: "80px", maxWidth: "75px", objectFit: "contain" }}
                />
            ) : (
                <span style={{ fontSize: "9px", color: "#999" }}>No Image</span>
            )}
        </td>
    );
};

// ============ Signature Component ============

const SignatureBlock = ({
    title,
    showImage = false,
    date,
    width = "200px",
}: {
    title: string;
    showImage?: boolean;
    date?: string;
    width?: string;
}) => (
    <div style={{ width, textAlign: "center" }}>
        {showImage ? (
            <img src="/signature-cheil.png" alt="Signature" style={{ height: "50px", marginBottom: "5px" }} />
        ) : (
            <div style={{ height: "50px", marginBottom: "5px" }}></div>
        )}
        <div style={{
            borderTop: `2px solid ${colors.primary}`,
            paddingTop: "10px",
            fontSize: "11px",
            color: colors.secondary,
            fontWeight: 500,
        }}>
            {title}
        </div>
        <div style={{ fontSize: "9px", color: "#718096", marginTop: "5px" }}>
            วันที่: {date || "____/____/____"}
        </div>
    </div>
);

// ============ Document Titles ============

const getDocumentTitle = (documentType: string): string => {
    const titleMap: Record<string, string> = {
        withdraw: "เอกสารเบิกสินทรัพย์เฉพาะร้านค้า",
        routing2shops: "เอกสาร Routing Asset ไป 2 ร้าน",
        routing3shops: "เอกสาร Routing Asset ไป 3 ร้าน",
        routing4shops: "เอกสาร Routing Asset ไป 4 ร้าน",
        other: "เอกสารเบิกของอื่นๆ",
        transfer: "เอกสารขอเคลื่อนย้ายทรัพย์สิน",
        borrowSecurity: "เอกสารยืมทรัพย์สิน งานอีเวนท์ / ร้านชั่วคราว",
        borrowsecurity: "เอกสารยืมทรัพย์สิน งานอีเวนท์ / ร้านชั่วคราว",
        borrow: "เอกสารยืมทรัพย์สิน งานอีเวนท์ / ร้านชั่วคราว",
        returnAsset: "เอกสารเก็บ Asset กลับ",
        returnasset: "เอกสารเก็บ Asset กลับ",
        return: "เอกสารเก็บ Asset กลับ",
        shopToShop: "เอกสารย้าย Asset ระหว่างร้าน (Shop To Shop)",
        shoptoship: "เอกสารย้าย Asset ระหว่างร้าน (Shop To Shop)",
        "shop-to-shop": "เอกสารย้าย Asset ระหว่างร้าน (Shop To Shop)",
        repair: "เอกสารแจ้งซ่อม Asset",
    };
    return titleMap[documentType] || "เอกสาร";
};

// ============ Main Component ============

export default function DocumentTemplateSelector({ document: doc }: DocumentTemplateSelectorProps) {
    const [isReady, setIsReady] = useState(false);
    const [assetImages, setAssetImages] = useState<Record<string, string | null>>({});

    const documentType = doc?.documentType || "withdraw";
    const shop = doc?.shops?.[0];
    const shops = doc?.shops || [];
    const assets = shop?.assets || [];
    const securitySets = shop?.securitySets || [];
    const vendorName = doc?.createdBy?.vendor || "N/A";

    // Fetch images for document types that need them
    useEffect(() => {
        const needsImages = ["other", "transfer", "borrowSecurity", "borrowsecurity", "borrow", "returnAsset", "returnasset", "return", "repair", "shopToShop", "shoptoship", "shop-to-shop"].includes(documentType);

        if (!needsImages || assets.length === 0) {
            setIsReady(true);
            return;
        }

        const fetchImages = async () => {
            try {
                const assetNames = assets.map((a: any) => a.name);
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
                setIsReady(true);
            }
        };

        fetchImages();
    }, [doc, documentType, assets]);

    // Default Security Sets
    const defaultSecuritySets = [
        { name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 0, withdrawFor: "" },
        { name: "Security Type C Ver.7.1", qty: 0, withdrawFor: "" },
        { name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
    ];

    const displaySecuritySets = securitySets.length > 0 ? securitySets : defaultSecuritySets;

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

    if (!isReady) {
        return null;
    }

    // ============ Render by Document Type ============

    // Common header
    const renderHeader = () => (
        <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "15px",
            paddingBottom: "12px",
            borderBottom: `3px solid ${colors.primary}`,
        }}>
            <div>
                <h1 style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: colors.primary,
                    margin: 0,
                    marginBottom: "5px",
                }}>
                    <span style={{ position: "relative", top: textOffset }}>{getDocumentTitle(documentType)}</span>
                </h1>
                <div style={{ fontSize: "12px", color: colors.secondary, fontWeight: 500 }}>
                    <span style={{ position: "relative", top: textOffset }}>เลขที่: <span style={{ fontWeight: 700 }}>{doc.docCode}</span></span>
                </div>
            </div>

            <div style={{ textAlign: "right" }}>
                <div style={{
                    backgroundColor: colors.black,
                    color: colors.white,
                    padding: "6px 20px",
                    fontWeight: 700,
                    borderRadius: "6px",
                    fontSize: "14px",
                    display: "inline-block",
                    letterSpacing: "1px",
                    marginBottom: "3px",
                }}>
                    <span style={{ position: "relative", top: textOffset }}>SAMSUNG</span>
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: colors.primary }}>
                    <span style={{ position: "relative", top: textOffset }}>{vendorName}</span>
                </div>
            </div>
        </div>
    );

    // Info cards for standard documents
    const renderInfoCards = () => (
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <div style={{
                width: "200px",
                backgroundColor: colors.rowAlt,
                borderRadius: "8px",
                padding: "10px 12px",
                border: `1px solid ${colors.border}`,
            }}>
                <div style={{ fontSize: "10px", fontWeight: 600, color: colors.secondary, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px", position: "relative", top: "-5px" }}>
                    {documentType === "returnAsset" ? "ข้อมูลผู้ส่งคืน" :
                        documentType === "shopToShop" ? "ข้อมูลผู้ย้าย" :
                            documentType === "repair" ? "ข้อมูลผู้แจ้งซ่อม" : "ข้อมูลผู้เบิก"}
                </div>
                <div style={{ fontSize: "11px", lineHeight: 1.6 }}>
                    <div style={{ position: "relative", top: "-5px" }}><strong>ชื่อ:</strong> {doc.fullName || "-"}</div>
                    <div style={{ position: "relative", top: "-5px" }}><strong>บริษัท:</strong> {doc.company || "-"}</div>
                    <div style={{ position: "relative", top: "-5px" }}><strong>เบอร์โทร:</strong> {doc.phone || "-"}</div>
                </div>
            </div>

            {documentType !== "repair" && (
                <div style={{
                    flex: 1,
                    backgroundColor: colors.rowAlt,
                    borderRadius: "8px",
                    padding: "10px 12px",
                    border: `1px solid ${colors.border}`,
                }}>
                    <div style={{ fontSize: "10px", fontWeight: 600, color: colors.secondary, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px", position: "relative", top: "-5px" }}>
                        ข้อมูลร้านค้า
                    </div>
                    <div style={{ fontSize: "11px", lineHeight: 1.6 }}>
                        <div style={{ position: "relative", top: "-5px" }}><strong>MCS Code:</strong> {shop?.shopCode || "-"}</div>
                        <div style={{ position: "relative", top: "-5px" }}><strong>Shop:</strong> {shop?.shopName || "-"}</div>
                        <div style={{ position: "relative", top: "-5px" }}><strong>Shop Focus:</strong> {shop?.shopFocus || "-"} | <strong>Q7B7:</strong> {shop?.q7b7 || "-"}</div>
                    </div>
                </div>
            )}

            <div style={{
                width: documentType === "repair" ? "180px" : "140px",
                backgroundColor: documentType === "repair" ? colors.dangerBg : colors.rowAlt,
                borderRadius: "8px",
                padding: "10px 12px",
                border: `1px solid ${documentType === "repair" ? colors.danger : colors.border}`,
            }}>
                <div style={{ fontSize: "10px", fontWeight: 600, color: documentType === "repair" ? colors.danger : colors.secondary, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px", position: "relative", top: "-5px" }}>
                    {documentType === "returnAsset" ? "กำหนดการเก็บกลับ" :
                        documentType === "repair" ? "📅 วันที่ส่งซ่อม" : "กำหนดการติดตั้ง"}
                </div>
                <div style={{ fontSize: "11px", lineHeight: 1.6 }}>
                    {documentType === "repair" ? (
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "#991b1b", position: "relative", top: "-5px" }}>
                            {formatDate(shop?.startInstallDate || doc.createdAt)}
                        </div>
                    ) : (
                        <>
                            <div style={{ position: "relative", top: "-5px" }}><strong>เริ่ม:</strong> {formatDate(shop?.startInstallDate)}</div>
                            <div style={{ position: "relative", top: "-5px" }}><strong>เสร็จ:</strong> {formatDate(shop?.endInstallDate)}</div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    // Note section
    const renderNote = () => (
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
    );

    // ============ WITHDRAW Template ============
    const renderWithdraw = () => {
        const totalRows = 15;
        const emptyRows = Math.max(0, totalRows - assets.length);

        return (
            <>
                {renderHeader()}
                {renderInfoCards()}

                {/* Asset Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                        <tr><th colSpan={5} style={headerStyle}><span style={{ position: "relative", top: textOffset }}>📦 รายละเอียด Asset</span></th></tr>
                        <tr>
                            <th style={{ ...thStyle, width: "35px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                            <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                            <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>KV</span></th>
                            <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                            <th style={{ ...thStyle, width: "85px" }}><span style={{ position: "relative", top: textOffset }}>เบิกที่โกดัง</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((asset: any, idx: number) => (
                            <tr key={idx}>
                                <Cell width="35px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                                <Cell isAlt={idx % 2 === 1}>{asset.name}{asset.size ? ` (${asset.size})` : ""}{asset.grade ? ` [${asset.grade}]` : ""}</Cell>
                                <Cell width="50px" center isAlt={idx % 2 === 1}>{asset.kv || "-"}</Cell>
                                <Cell width="50px" center bold isAlt={idx % 2 === 1}>{asset.qty}</Cell>
                                <Cell width="85px" center isAlt={idx % 2 === 1}>{asset.withdrawFor || "-"}</Cell>
                            </tr>
                        ))}
                        {Array.from({ length: emptyRows }).map((_, idx) => (
                            <tr key={`empty-${idx}`}>
                                <Cell width="35px" center isAlt={(assets.length + idx) % 2 === 1}>{assets.length + idx + 1}</Cell>
                                <Cell isAlt={(assets.length + idx) % 2 === 1} />
                                <Cell width="50px" center isAlt={(assets.length + idx) % 2 === 1} />
                                <Cell width="50px" center isAlt={(assets.length + idx) % 2 === 1} />
                                <Cell width="85px" center isAlt={(assets.length + idx) % 2 === 1} />
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Security Set Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                        <tr><th colSpan={4} style={headerStyle}><span style={{ position: "relative", top: textOffset }}>🔐 รายละเอียด Security Set</span></th></tr>
                        <tr>
                            <th style={{ ...thStyle, width: "35px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                            <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                            <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                            <th style={{ ...thStyle, width: "85px" }}><span style={{ position: "relative", top: textOffset }}>เบิกที่โกดัง</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displaySecuritySets.map((security: any, idx: number) => (
                            <tr key={idx}>
                                <Cell width="35px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                                <Cell isAlt={idx % 2 === 1}>{security.name}</Cell>
                                <Cell width="50px" center bold isAlt={idx % 2 === 1}>{security.qty > 0 ? security.qty : ""}</Cell>
                                <Cell width="85px" center isAlt={idx % 2 === 1}>{security.withdrawFor || ""}</Cell>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {renderNote()}

                {/* Signatures - 2 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto", paddingTop: "15px" }}>
                    <SignatureBlock title="Approved by Cheil" showImage={true} date={formatDateThai(doc.approvedAt)} width="280px" />
                    <SignatureBlock title="ลงชื่อผู้รับของ" width="280px" />
                </div>
            </>
        );
    };

    // ============ ROUTING Template (2/3/4 shops) ============
    const renderRouting = () => {
        const shopCount = documentType === "routing4shops" ? 4 : documentType === "routing3shops" ? 3 : 2;

        return (
            <>
                {renderHeader()}

                {/* Shop Tables */}
                {shops.slice(0, shopCount).map((shopItem: any, shopIdx: number) => {
                    const shopAssets = shopItem.assets || [];
                    const shopSecurity = shopItem.securitySets || defaultSecuritySets;
                    const totalRows = shopCount === 4 ? 3 : shopCount === 3 ? 4 : 6;
                    const emptyRows = Math.max(0, totalRows - shopAssets.length);

                    return (
                        <div key={shopIdx} style={{ marginBottom: "10px" }}>
                            {/* Shop Header */}
                            <div style={{
                                backgroundColor: colors.primary,
                                color: colors.white,
                                padding: "6px 12px",
                                borderRadius: "6px 6px 0 0",
                                fontSize: "11px",
                                fontWeight: 600,
                            }}>
                                <span style={{ position: "relative", top: textOffset }}>
                                    🏪 ร้านที่ {shopIdx + 1}: {shopItem.shopName || "-"} | MCS: {shopItem.shopCode || "-"} |
                                    วันติดตั้ง: {formatDate(shopItem.startInstallDate)} - {formatDate(shopItem.endInstallDate)}
                                </span>
                            </div>

                            {/* Asset Table */}
                            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "5px" }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...thStyle, width: "30px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                                        <th style={{ ...thStyle, width: "90px" }}><span style={{ position: "relative", top: textOffset }}>Barcode</span></th>
                                        <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                                        <th style={{ ...thStyle, width: "45px" }}><span style={{ position: "relative", top: textOffset }}>KV</span></th>
                                        <th style={{ ...thStyle, width: "40px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                                        <th style={{ ...thStyle, width: "75px" }}><span style={{ position: "relative", top: textOffset }}>โกดัง</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shopAssets.map((asset: any, idx: number) => (
                                        <tr key={idx}>
                                            <Cell width="30px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                                            <Cell width="90px" isAlt={idx % 2 === 1}>{asset.barcode || "-"}</Cell>
                                            <Cell isAlt={idx % 2 === 1}>{asset.name}</Cell>
                                            <Cell width="45px" center isAlt={idx % 2 === 1}>{asset.kv || "-"}</Cell>
                                            <Cell width="40px" center bold isAlt={idx % 2 === 1}>{asset.qty}</Cell>
                                            <Cell width="75px" center isAlt={idx % 2 === 1}>{asset.withdrawFor || "-"}</Cell>
                                        </tr>
                                    ))}
                                    {Array.from({ length: emptyRows }).map((_, idx) => (
                                        <tr key={`empty-${idx}`}>
                                            <Cell width="30px" center isAlt={(shopAssets.length + idx) % 2 === 1}>{shopAssets.length + idx + 1}</Cell>
                                            <Cell width="90px" isAlt={(shopAssets.length + idx) % 2 === 1} />
                                            <Cell isAlt={(shopAssets.length + idx) % 2 === 1} />
                                            <Cell width="45px" center isAlt={(shopAssets.length + idx) % 2 === 1} />
                                            <Cell width="40px" center isAlt={(shopAssets.length + idx) % 2 === 1} />
                                            <Cell width="75px" center isAlt={(shopAssets.length + idx) % 2 === 1} />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Security Table (compact) */}
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <tbody>
                                    {shopSecurity.slice(0, 3).map((sec: any, idx: number) => (
                                        <tr key={idx}>
                                            <Cell width="30px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                                            <Cell isAlt={idx % 2 === 1}>{sec.name}</Cell>
                                            <Cell width="40px" center bold isAlt={idx % 2 === 1}>{sec.qty > 0 ? sec.qty : ""}</Cell>
                                            <Cell width="75px" center isAlt={idx % 2 === 1}>{sec.withdrawFor || ""}</Cell>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })}

                {renderNote()}

                {/* Signatures - 3 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto", paddingTop: "10px" }}>
                    <SignatureBlock title="Approved by Cheil" showImage={true} date={formatDateThai(doc.approvedAt)} width="220px" />
                    <SignatureBlock title="ลงชื่อผู้ส่งของ" width="220px" />
                    <SignatureBlock title="ลงชื่อผู้รับของ" width="220px" />
                </div>
            </>
        );
    };

    // ============ OTHER Template (with images) ============
    const renderOther = () => {
        const totalRows = 4;
        const emptyRows = Math.max(0, totalRows - assets.length);

        return (
            <>
                {renderHeader()}
                {renderInfoCards()}

                {/* Asset Table with Images */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                        <tr><th colSpan={8} style={headerStyle}><span style={{ position: "relative", top: textOffset }}>📦 รายละเอียด Asset</span></th></tr>
                        <tr>
                            <th style={{ ...thStyle, width: "30px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                            <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                            <th style={{ ...thStyle, width: "85px" }}><span style={{ position: "relative", top: textOffset }}>รูปภาพ</span></th>
                            <th style={{ ...thStyle, width: "55px" }}><span style={{ position: "relative", top: textOffset }}>Size</span></th>
                            <th style={{ ...thStyle, width: "40px" }}><span style={{ position: "relative", top: textOffset }}>เกรด</span></th>
                            <th style={{ ...thStyle, width: "40px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                            <th style={{ ...thStyle, width: "75px" }}><span style={{ position: "relative", top: textOffset }}>โกดัง</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((asset: any, idx: number) => (
                            <tr key={idx}>
                                <Cell width="30px" center isAlt={idx % 2 === 1} hasImage>{idx + 1}</Cell>
                                <Cell isAlt={idx % 2 === 1} hasImage>{asset.name}</Cell>
                                <ImageCell imageUrl={assetImages[asset.name] || null} isAlt={idx % 2 === 1} />
                                <Cell width="55px" center isAlt={idx % 2 === 1} hasImage>{asset.size || "-"}</Cell>
                                <Cell width="40px" center isAlt={idx % 2 === 1} hasImage>{asset.grade || "-"}</Cell>
                                <Cell width="40px" center bold isAlt={idx % 2 === 1} hasImage>{asset.qty}</Cell>
                                <Cell width="75px" center isAlt={idx % 2 === 1} hasImage>{asset.withdrawFor || "-"}</Cell>
                            </tr>
                        ))}
                        {Array.from({ length: emptyRows }).map((_, idx) => (
                            <tr key={`empty-${idx}`}>
                                <Cell width="30px" center isAlt={(assets.length + idx) % 2 === 1} hasImage>{assets.length + idx + 1}</Cell>
                                <Cell isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <ImageCell imageUrl={null} isAlt={(assets.length + idx) % 2 === 1} />
                                <Cell width="55px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="40px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="40px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="75px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Security Set Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                        <tr><th colSpan={4} style={headerStyle}><span style={{ position: "relative", top: textOffset }}>🔐 รายละเอียด Security Set</span></th></tr>
                        <tr>
                            <th style={{ ...thStyle, width: "35px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                            <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                            <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                            <th style={{ ...thStyle, width: "85px" }}><span style={{ position: "relative", top: textOffset }}>เบิกที่โกดัง</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displaySecuritySets.map((security: any, idx: number) => (
                            <tr key={idx}>
                                <Cell width="35px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                                <Cell isAlt={idx % 2 === 1}>{security.name}</Cell>
                                <Cell width="50px" center bold isAlt={idx % 2 === 1}>{security.qty > 0 ? security.qty : ""}</Cell>
                                <Cell width="85px" center isAlt={idx % 2 === 1}>{security.withdrawFor || ""}</Cell>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {renderNote()}

                {/* Signatures - 3 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto", paddingTop: "15px" }}>
                    <SignatureBlock title="Approved by Cheil" showImage={true} date={formatDateThai(doc.approvedAt)} width="220px" />
                    <SignatureBlock title="ลงชื่อผู้ส่งของ" width="220px" />
                    <SignatureBlock title="ลงชื่อผู้รับของ" width="220px" />
                </div>
            </>
        );
    };

    // ============ TRANSFER Template (with checkboxes + images) ============
    const renderTransfer = () => {
        const totalRows = 4;
        const emptyRows = Math.max(0, totalRows - assets.length);
        const transferTypes = ["เปิดร้านใหม่", "ย้ายทรัพย์สิน", "ปรับลด", "อื่นๆ"];
        const selectedType = doc.transferType || "ย้ายทรัพย์สิน";

        return (
            <>
                {renderHeader()}

                {/* Transfer Type Checkboxes */}
                <div style={{ marginBottom: "12px", padding: "8px 12px", backgroundColor: colors.rowAlt, borderRadius: "6px", border: `1px solid ${colors.border}` }}>
                    <div style={{ display: "flex", gap: "25px", fontSize: "11px" }}>
                        {transferTypes.map((type) => (
                            <label key={type} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                                <div style={{
                                    width: "14px",
                                    height: "14px",
                                    border: `2px solid ${colors.primary}`,
                                    borderRadius: "3px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: selectedType === type ? colors.primary : colors.white,
                                }}>
                                    {selectedType === type && <span style={{ color: colors.white, fontSize: "10px", fontWeight: "bold", position: "relative", top: "-2px" }}>✓</span>}
                                </div>
                                <span style={{ position: "relative", top: "-3px" }}>{type}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {renderInfoCards()}

                {/* Asset Table with Images */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                        <tr><th colSpan={8} style={headerStyle}><span style={{ position: "relative", top: textOffset }}>📦 รายละเอียด Asset</span></th></tr>
                        <tr>
                            <th style={{ ...thStyle, width: "30px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                            <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                            <th style={{ ...thStyle, width: "85px" }}><span style={{ position: "relative", top: textOffset }}>รูปภาพ</span></th>
                            <th style={{ ...thStyle, width: "55px" }}><span style={{ position: "relative", top: textOffset }}>Size</span></th>
                            <th style={{ ...thStyle, width: "40px" }}><span style={{ position: "relative", top: textOffset }}>เกรด</span></th>
                            <th style={{ ...thStyle, width: "40px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                            <th style={{ ...thStyle, width: "75px" }}><span style={{ position: "relative", top: textOffset }}>โกดัง</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((asset: any, idx: number) => (
                            <tr key={idx}>
                                <Cell width="30px" center isAlt={idx % 2 === 1} hasImage>{idx + 1}</Cell>
                                <Cell isAlt={idx % 2 === 1} hasImage>{asset.name}</Cell>
                                <ImageCell imageUrl={assetImages[asset.name] || null} isAlt={idx % 2 === 1} />
                                <Cell width="55px" center isAlt={idx % 2 === 1} hasImage>{asset.size || "-"}</Cell>
                                <Cell width="40px" center isAlt={idx % 2 === 1} hasImage>{asset.grade || "-"}</Cell>
                                <Cell width="40px" center bold isAlt={idx % 2 === 1} hasImage>{asset.qty}</Cell>
                                <Cell width="75px" center isAlt={idx % 2 === 1} hasImage>{asset.withdrawFor || "-"}</Cell>
                            </tr>
                        ))}
                        {Array.from({ length: emptyRows }).map((_, idx) => (
                            <tr key={`empty-${idx}`}>
                                <Cell width="30px" center isAlt={(assets.length + idx) % 2 === 1} hasImage>{assets.length + idx + 1}</Cell>
                                <Cell isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <ImageCell imageUrl={null} isAlt={(assets.length + idx) % 2 === 1} />
                                <Cell width="55px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="40px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="40px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="75px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                            </tr>
                        ))}
                    </tbody>
                </table>

                {renderNote()}

                {/* Signatures - 3 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto", paddingTop: "15px" }}>
                    <SignatureBlock title="Approved by Cheil" showImage={true} date={formatDateThai(doc.approvedAt)} width="220px" />
                    <SignatureBlock title="ลงชื่อผู้ส่งของ" width="220px" />
                    <SignatureBlock title="ลงชื่อผู้รับของ" width="220px" />
                </div>
            </>
        );
    };

    // ============ BORROW Template (with/without Security, 5 signatures) ============
    const renderBorrow = () => {
        const hasSecurity = documentType === "borrowSecurity" || documentType === "borrowsecurity";
        // borrow = 5 แถว, borrowSecurity = 3 แถว
        const totalRows = hasSecurity ? 3 : 5;
        const emptyRows = Math.max(0, totalRows - assets.length);

        return (
            <>
                {renderHeader()}

                {renderInfoCards()}

                {/* Asset Table with Images */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                        <tr><th colSpan={6} style={headerStyle}><span style={{ position: "relative", top: textOffset }}>📦 รายละเอียด Asset</span></th></tr>
                        <tr>
                            <th style={{ ...thStyle, width: "35px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                            <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                            <th style={{ ...thStyle, width: "100px" }}><span style={{ position: "relative", top: textOffset }}>รูปภาพ</span></th>
                            <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>เกรด</span></th>
                            <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                            <th style={{ ...thStyle, width: "85px" }}><span style={{ position: "relative", top: textOffset }}>เบิกที่โกดัง</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((asset: any, idx: number) => (
                            <tr key={idx}>
                                <Cell width="35px" center isAlt={idx % 2 === 1} hasImage>{idx + 1}</Cell>
                                <td
                                    style={{
                                        border: `1px solid ${colors.border}`,
                                        height: "90px",
                                        padding: "4px 8px",
                                        fontSize: "11px",
                                        backgroundColor: idx % 2 === 1 ? colors.rowAlt : colors.white,
                                        color: colors.text,
                                        verticalAlign: "middle",
                                        fontFamily: fontFamily,
                                    }}
                                >
                                    <div style={{ position: "relative", top: textOffset }}>
                                        <div style={{ fontWeight: 500 }}>{asset.name}{asset.size ? ` (${asset.size})` : ""}</div>
                                        {asset.kv && <div style={{ fontSize: "10px", color: colors.secondary, marginTop: "2px" }}>KV: {asset.kv}</div>}
                                    </div>
                                </td>
                                <ImageCell imageUrl={assetImages[asset.name] || null} isAlt={idx % 2 === 1} />
                                <Cell width="50px" center isAlt={idx % 2 === 1} hasImage>{asset.grade || "-"}</Cell>
                                <Cell width="50px" center bold isAlt={idx % 2 === 1} hasImage>{asset.qty}</Cell>
                                <Cell width="85px" center isAlt={idx % 2 === 1} hasImage>{asset.withdrawFor || "-"}</Cell>
                            </tr>
                        ))}
                        {Array.from({ length: emptyRows }).map((_, idx) => (
                            <tr key={`empty-${idx}`}>
                                <Cell width="35px" center isAlt={(assets.length + idx) % 2 === 1} hasImage>{assets.length + idx + 1}</Cell>
                                <Cell isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <ImageCell imageUrl={null} isAlt={(assets.length + idx) % 2 === 1} />
                                <Cell width="50px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="50px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="85px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Security Table (only for borrowSecurity) */}
                {hasSecurity && (
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px", borderRadius: "8px", overflow: "hidden" }}>
                        <thead>
                            <tr><th colSpan={5} style={headerStyle}><span style={{ position: "relative", top: textOffset }}>🔐 รายละเอียด Security Set</span></th></tr>
                            <tr>
                                <th style={{ ...thStyle, width: "35px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                                <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                                <th style={{ ...thStyle, width: "80px" }}><span style={{ position: "relative", top: textOffset }}>รูปภาพ</span></th>
                                <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                                <th style={{ ...thStyle, width: "85px" }}><span style={{ position: "relative", top: textOffset }}>เบิกที่โกดัง</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* CONTROLBOX - แถวเดี่ยว */}
                            <tr>
                                <Cell width="35px" center>{1}</Cell>
                                <Cell>{displaySecuritySets[0]?.name || "CONTROLBOX 6 PORT (M-60000R) with power cable"}</Cell>
                                <td
                                    style={{
                                        width: "80px",
                                        border: `1px solid ${colors.border}`,
                                        height: "70px",
                                        padding: "4px",
                                        backgroundColor: colors.white,
                                        textAlign: "center",
                                        verticalAlign: "middle",
                                    }}
                                >
                                    <img
                                        src="/images/controlbox.png"
                                        alt="CONTROLBOX"
                                        style={{ maxHeight: "60px", maxWidth: "70px", objectFit: "contain" }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<span style="font-size: 9px; color: #999;">-</span>';
                                        }}
                                    />
                                </td>
                                <Cell width="50px" center bold>{displaySecuritySets[0]?.qty > 0 ? displaySecuritySets[0]?.qty : ""}</Cell>
                                <Cell width="85px" center>{displaySecuritySets[0]?.withdrawFor || ""}</Cell>
                            </tr>
                            {/* Security Type C Ver.7.1 - รวมรูปกับ 7.0 */}
                            <tr>
                                <Cell width="35px" center isAlt>{2}</Cell>
                                <Cell isAlt>{displaySecuritySets[1]?.name || "Security Type C Ver.7.1"}</Cell>
                                <td
                                    rowSpan={2}
                                    style={{
                                        width: "80px",
                                        border: `1px solid ${colors.border}`,
                                        height: "70px",
                                        padding: "4px",
                                        backgroundColor: colors.white,
                                        textAlign: "center",
                                        verticalAlign: "middle",
                                    }}
                                >
                                    <img
                                        src="/images/security-type-c.png"
                                        alt="Security Type C"
                                        style={{ maxHeight: "60px", maxWidth: "70px", objectFit: "contain" }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<span style="font-size: 9px; color: #999;">-</span>';
                                        }}
                                    />
                                </td>
                                <Cell width="50px" center bold isAlt>{displaySecuritySets[1]?.qty > 0 ? displaySecuritySets[1]?.qty : ""}</Cell>
                                <Cell width="85px" center isAlt>{displaySecuritySets[1]?.withdrawFor || ""}</Cell>
                            </tr>
                            {/* Security Type C Ver.7.0 */}
                            <tr>
                                <Cell width="35px" center>{3}</Cell>
                                <Cell>{displaySecuritySets[2]?.name || "Security Type C Ver.7.0"}</Cell>
                                {/* รูปภาพ rowSpan จากแถวบน */}
                                <Cell width="50px" center bold>{displaySecuritySets[2]?.qty > 0 ? displaySecuritySets[2]?.qty : ""}</Cell>
                                <Cell width="85px" center>{displaySecuritySets[2]?.withdrawFor || ""}</Cell>
                            </tr>
                        </tbody>
                    </table>
                )}

                {renderNote()}

                {/* Important Note Section */}
                <div style={{
                    marginBottom: "10px",
                    padding: "8px 10px",
                    backgroundColor: colors.dangerBg,
                    border: `1px solid ${colors.danger}`,
                    borderRadius: "6px",
                    fontSize: "10px",
                    lineHeight: 1.5,
                }}>
                    <span style={{ position: "relative", top: textOffset }}>
                        <strong style={{ color: "#dc2626" }}>⚠️ หมายเหตุ**:</strong>{" "}
                        <span style={{ color: "#991b1b" }}>
                            ทาง Vendor ผู้เบิกของจะต้องรักษาของในการเคลื่อนย้าย อย่างดี หากเกิดความเสียหายขึ้นทาง Vendor จะเป็นผู้ต้องรับผิดชอบ ในการซ่อมแซม หรือผลิตใหม่ตามแต่ TSE เห็นสมควรก่อนส่งของคืน Vendor จะต้องส่งรายงานสภาพความเสียหาย และแจ้งกำหนดการคืนสินค้าโดยติดต่อ นัท 062-949-5641 / 095-246-4455
                        </span>
                    </span>
                </div>

                {/* Signatures - 5 (2 rows) */}
                <div style={{ marginTop: "auto", paddingTop: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "15px" }}>
                        <SignatureBlock title="ลงชื่อเวนเดอร์ผู้รับของ / วันที่ยืม" width="220px" />
                        <SignatureBlock title="ลงชื่อเวนเดอร์ผู้คืนของ / วันที่คืน" width="220px" />
                        <SignatureBlock title="Approved by Cheil" showImage={true} date={formatDateThai(doc.approvedAt)} width="220px" />
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "flex-end", gap: "40px" }}>
                        <SignatureBlock title="ลงชื่อผู้รับของทีมซัมซุง / วันที่ยืม" width="220px" />
                        <SignatureBlock title="ลงชื่อผู้คืนของทีมซัมซุง / วันที่คืน" width="220px" />
                    </div>
                </div>
            </>
        );
    };

    // ============ RETURN Template (with barcode + conditions) ============
    const renderReturn = () => {
        const totalRows = 5;
        const emptyRows = Math.max(0, totalRows - assets.length);
        const returnConditions = [
            { value: "normal", label: "เก็บกลับปกติ" },
            { value: "from_borrow", label: "เก็บจากการยืม" },
        ];
        const selectedCondition = doc.returnCondition || "normal";

        return (
            <>
                {renderHeader()}
                {renderInfoCards()}

                {/* Return Condition Checkboxes */}
                <div style={{
                    display: "flex",
                    gap: "30px",
                    marginBottom: "8px",
                    padding: "8px 12px",
                    backgroundColor: colors.rowAlt,
                    borderRadius: "6px",
                    border: `1px solid ${colors.border}`,
                    alignItems: "center",
                }}>
                    <div style={{ fontSize: "10px", fontWeight: 600, color: colors.secondary, position: "relative", top: "-5px" }}>เงื่อนไขการเก็บกลับ:</div>
                    {returnConditions.map((condition) => (
                        <div key={condition.value} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                            <div style={{
                                width: "14px",
                                height: "14px",
                                border: `2px solid ${colors.primary}`,
                                borderRadius: "3px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: selectedCondition === condition.value ? colors.primary : colors.white,
                            }}>
                                {selectedCondition === condition.value && (
                                    <span style={{ color: colors.white, fontSize: "10px", fontWeight: "bold", position: "relative", top: "-5px" }}>✓</span>
                                )}
                            </div>
                            <span style={{ position: "relative", top: "-5px" }}>{condition.label}</span>
                        </div>
                    ))}
                </div>

                {/* Asset Table with Barcode + Images + โกดัง */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                        <tr><th colSpan={8} style={headerStyle}><span style={{ position: "relative", top: textOffset }}>📦 รายละเอียด Asset ที่เก็บกลับ</span></th></tr>
                        <tr>
                            <th style={{ ...thStyle, width: "30px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                            <th style={{ ...thStyle, width: "80px" }}><span style={{ position: "relative", top: textOffset }}>Barcode</span></th>
                            <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                            <th style={{ ...thStyle, width: "80px" }}><span style={{ position: "relative", top: textOffset }}>รูปภาพ</span></th>
                            <th style={{ ...thStyle, width: "60px" }}><span style={{ position: "relative", top: textOffset }}>Size</span></th>
                            <th style={{ ...thStyle, width: "40px" }}><span style={{ position: "relative", top: textOffset }}>เกรด</span></th>
                            <th style={{ ...thStyle, width: "35px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                            <th style={{ ...thStyle, width: "75px" }}><span style={{ position: "relative", top: textOffset }}>เก็บที่โกดัง</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((asset: any, idx: number) => (
                            <tr key={idx}>
                                <Cell width="30px" center isAlt={idx % 2 === 1} hasImage>{idx + 1}</Cell>
                                <Cell width="80px" center isAlt={idx % 2 === 1} hasImage>{asset.barcode || "-"}</Cell>
                                <Cell isAlt={idx % 2 === 1} hasImage>{asset.name}</Cell>
                                <ImageCell imageUrl={assetImages[asset.name] || null} isAlt={idx % 2 === 1} />
                                <Cell width="60px" center isAlt={idx % 2 === 1} hasImage>{asset.size || "-"}</Cell>
                                <Cell width="40px" center isAlt={idx % 2 === 1} hasImage>{asset.grade || "-"}</Cell>
                                <Cell width="35px" center bold isAlt={idx % 2 === 1} hasImage>{asset.qty}</Cell>
                                <Cell width="75px" center isAlt={idx % 2 === 1} hasImage>{vendorName || "-"}</Cell>
                            </tr>
                        ))}
                        {Array.from({ length: emptyRows }).map((_, idx) => (
                            <tr key={`empty-${idx}`}>
                                <Cell width="30px" center isAlt={(assets.length + idx) % 2 === 1} hasImage>{assets.length + idx + 1}</Cell>
                                <Cell width="80px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <ImageCell imageUrl={null} isAlt={(assets.length + idx) % 2 === 1} />
                                <Cell width="60px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="40px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="35px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="75px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Security Table with Barcode + โกดัง */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                        <tr><th colSpan={5} style={headerStyle}><span style={{ position: "relative", top: textOffset }}>🔐 รายละเอียด Security Set ที่เก็บกลับ</span></th></tr>
                        <tr>
                            <th style={{ ...thStyle, width: "30px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                            <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                            <th style={{ ...thStyle, width: "100px" }}><span style={{ position: "relative", top: textOffset }}>Barcode</span></th>
                            <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                            <th style={{ ...thStyle, width: "80px" }}><span style={{ position: "relative", top: textOffset }}>เก็บที่โกดัง</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displaySecuritySets.map((security: any, idx: number) => (
                            <tr key={idx}>
                                <Cell width="30px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                                <Cell isAlt={idx % 2 === 1}>{security.name}</Cell>
                                <Cell width="100px" center isAlt={idx % 2 === 1}>{security.barcode || "-"}</Cell>
                                <Cell width="50px" center bold isAlt={idx % 2 === 1}>{security.qty > 0 ? security.qty : ""}</Cell>
                                <Cell width="80px" center isAlt={idx % 2 === 1}>{security.qty > 0 ? vendorName : ""}</Cell>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {renderNote()}

                {/* Signatures - 3 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: "0px" }}>
                    <SignatureBlock title="Approved by Cheil" showImage={true} date={formatDateThai(doc.approvedAt)} width="220px" />
                    <SignatureBlock title="ลงชื่อผู้ส่งของ" width="220px" />
                    <SignatureBlock title="ลงชื่อผู้รับของ" width="220px" />
                </div>
            </>
        );
    };

    // ============ SHOP TO SHOP Template ============
    const renderShopToShop = () => {
        const shopSource = shops[0] || {};
        const shopDest = shops[1] || doc.destinationShop || {};
        const totalRows = 4;
        const emptyRows = Math.max(0, totalRows - assets.length);

        return (
            <>
                {/* Header */}
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "8px",
                    paddingBottom: "6px",
                    borderBottom: `3px solid ${colors.primary}`,
                }}>
                    <div>
                        <h1 style={{ fontSize: "18px", fontWeight: 700, color: colors.primary, margin: 0, marginBottom: "3px" }}>
                            <span style={{ position: "relative", top: textOffset }}>เอกสารย้าย Asset ระหว่างร้าน (Shop To Shop)</span>
                        </h1>
                        <div style={{ fontSize: "12px", color: colors.secondary, fontWeight: 500 }}>
                            <span style={{ position: "relative", top: textOffset }}>เลขที่: <span style={{ fontWeight: 700 }}>{doc.docCode}</span></span>
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ backgroundColor: colors.black, color: colors.white, padding: "5px 18px", fontWeight: 700, borderRadius: "4px", fontSize: "12px", display: "inline-block", letterSpacing: "1px", marginBottom: "3px" }}>
                            <span style={{ position: "relative", top: textOffset }}>SAMSUNG</span>
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: colors.primary }}>
                            <span style={{ position: "relative", top: textOffset }}>{vendorName}</span>
                        </div>
                    </div>
                </div>

                {/* ข้อมูลผู้ย้าย */}
                <div style={{
                    backgroundColor: colors.rowAlt,
                    borderRadius: "6px",
                    padding: "6px 10px",
                    border: `1px solid ${colors.border}`,
                    marginBottom: "6px",
                }}>
                    <div style={{ fontSize: "8px", fontWeight: 600, color: colors.secondary, marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.5px", position: "relative", top: "-5px" }}>
                        ข้อมูลผู้ย้าย
                    </div>
                    <div style={{ fontSize: "9px", display: "flex", gap: "20px" }}>
                        <div style={{ position: "relative", top: "-5px" }}><strong>ชื่อ:</strong> {doc.fullName || "-"}</div>
                        <div style={{ position: "relative", top: "-5px" }}><strong>บริษัท:</strong> {doc.company || "-"}</div>
                        <div style={{ position: "relative", top: "-5px" }}><strong>เบอร์โทร:</strong> {doc.phone || "-"}</div>
                    </div>
                </div>

                {/* Shop Cards - ต้นทาง & ปลายทาง */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                    {/* Shop ต้นทาง */}
                    <div style={{
                        flex: 1,
                        backgroundColor: colors.warningBg,
                        borderRadius: "6px",
                        padding: "6px 10px",
                        border: `1px solid ${colors.warning}`,
                    }}>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: "#b45309", marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                            <span style={{ position: "relative", top: textOffset }}>📤 ร้านต้นทาง (ย้ายออก)</span>
                        </div>
                        <div style={{ fontSize: "9px", lineHeight: 1.4 }}>
                            <div style={{ position: "relative", top: "-5px" }}><strong>MCS Code:</strong> {shopSource.shopCode || "-"}</div>
                            <div style={{ position: "relative", top: "-5px" }}><strong>Shop:</strong> {shopSource.shopName || "-"}</div>
                            <div style={{ position: "relative", top: "-5px" }}><strong>Shop Focus:</strong> {shopSource.shopFocus || "-"} | <strong>Q7B7:</strong> {shopSource.q7b7 || "-"}</div>
                        </div>
                    </div>

                    {/* Arrow */}
                    <div style={{ display: "flex", alignItems: "center", fontSize: "24px", color: colors.primary, fontWeight: "bold" }}>→</div>

                    {/* Shop ปลายทาง */}
                    <div style={{
                        flex: 1,
                        backgroundColor: colors.successBg,
                        borderRadius: "6px",
                        padding: "6px 10px",
                        border: `1px solid ${colors.success}`,
                    }}>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: "#166534", marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                            <span style={{ position: "relative", top: textOffset }}>📥 ร้านปลายทาง (ย้ายเข้า)</span>
                        </div>
                        <div style={{ fontSize: "9px", lineHeight: 1.4 }}>
                            <div style={{ position: "relative", top: "-5px" }}><strong>MCS Code:</strong> {shopDest.shopCode || "-"}</div>
                            <div style={{ position: "relative", top: "-5px" }}><strong>Shop:</strong> {shopDest.shopName || "-"}</div>
                            <div style={{ position: "relative", top: "-5px" }}><strong>Shop Focus:</strong> {shopDest.shopFocus || "-"} | <strong>Q7B7:</strong> {shopDest.q7b7 || "-"}</div>
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
                        <div style={{ fontSize: "8px", fontWeight: 600, color: colors.secondary, marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.5px", position: "relative", top: "-5px" }}>
                            กำหนดการย้าย
                        </div>
                        <div style={{ fontSize: "9px", lineHeight: 1.4 }}>
                            <div style={{ position: "relative", top: "-5px" }}><strong>เริ่ม:</strong> {formatDate(shopSource.startInstallDate)}</div>
                            <div style={{ position: "relative", top: "-5px" }}><strong>เสร็จ:</strong> {formatDate(shopSource.endInstallDate)}</div>
                        </div>
                    </div>
                </div>

                {/* Asset Table with Barcode + Images */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "5px", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                        <tr><th colSpan={8} style={{ ...headerStyle, height: "24px", fontSize: "10px" }}><span style={{ position: "relative", top: textOffset }}>📦 รายละเอียด Asset ที่ย้าย</span></th></tr>
                        <tr>
                            <th style={{ ...thStyle, width: "25px", height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                            <th style={{ ...thStyle, width: "70px", height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>Barcode</span></th>
                            <th style={{ ...thStyle, height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                            <th style={{ ...thStyle, width: "70px", height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>รูปภาพ</span></th>
                            <th style={{ ...thStyle, width: "50px", height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>Size</span></th>
                            <th style={{ ...thStyle, width: "35px", height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>เกรด</span></th>
                            <th style={{ ...thStyle, width: "30px", height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                            <th style={{ ...thStyle, width: "70px", height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>โกดัง</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((asset: any, idx: number) => (
                            <tr key={idx}>
                                <td style={{ width: "25px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: idx % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}><span style={{ position: "relative", top: textOffset }}>{idx + 1}</span></td>
                                <td style={{ width: "70px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: idx % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}><span style={{ position: "relative", top: textOffset }}>{asset.barcode || "-"}</span></td>
                                <td style={{ border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: idx % 2 === 1 ? colors.rowAlt : colors.white, verticalAlign: "middle" }}><span style={{ position: "relative", top: textOffset }}>{asset.name}</span></td>
                                <td style={{ width: "70px", border: `1px solid ${colors.border}`, height: "70px", padding: "3px", backgroundColor: idx % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}>
                                    {assetImages[asset.name] ? <img src={assetImages[asset.name]!} alt="Asset" style={{ maxHeight: "60px", maxWidth: "60px", objectFit: "contain" }} /> : <span style={{ fontSize: "8px", color: "#999" }}>-</span>}
                                </td>
                                <td style={{ width: "50px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: idx % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}><span style={{ position: "relative", top: textOffset }}>{asset.size || "-"}</span></td>
                                <td style={{ width: "35px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: idx % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}><span style={{ position: "relative", top: textOffset }}>{asset.grade || "-"}</span></td>
                                <td style={{ width: "30px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", fontWeight: 600, backgroundColor: idx % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}><span style={{ position: "relative", top: textOffset }}>{asset.qty}</span></td>
                                <td style={{ width: "70px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: idx % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}><span style={{ position: "relative", top: textOffset }}>{asset.withdrawFor || "-"}</span></td>
                            </tr>
                        ))}
                        {Array.from({ length: emptyRows }).map((_, idx) => (
                            <tr key={`empty-${idx}`}>
                                <td style={{ width: "25px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: (assets.length + idx) % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}><span style={{ position: "relative", top: textOffset }}>{assets.length + idx + 1}</span></td>
                                <td style={{ width: "70px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: (assets.length + idx) % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}></td>
                                <td style={{ border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: (assets.length + idx) % 2 === 1 ? colors.rowAlt : colors.white, verticalAlign: "middle" }}></td>
                                <td style={{ width: "70px", border: `1px solid ${colors.border}`, height: "70px", padding: "3px", backgroundColor: (assets.length + idx) % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}><span style={{ fontSize: "8px", color: "#999" }}>-</span></td>
                                <td style={{ width: "50px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: (assets.length + idx) % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}></td>
                                <td style={{ width: "35px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: (assets.length + idx) % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}></td>
                                <td style={{ width: "30px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: (assets.length + idx) % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}></td>
                                <td style={{ width: "70px", border: `1px solid ${colors.border}`, height: "70px", padding: "2px 5px", fontSize: "9px", backgroundColor: (assets.length + idx) % 2 === 1 ? colors.rowAlt : colors.white, textAlign: "center", verticalAlign: "middle" }}></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Security Table with โกดัง */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "5px", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                        <tr><th colSpan={4} style={{ ...headerStyle, height: "24px", fontSize: "10px" }}><span style={{ position: "relative", top: textOffset }}>🔐 รายละเอียด Security Set ที่ย้าย</span></th></tr>
                        <tr>
                            <th style={{ ...thStyle, width: "30px", height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                            <th style={{ ...thStyle, height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                            <th style={{ ...thStyle, width: "50px", height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                            <th style={{ ...thStyle, width: "80px", height: "22px", fontSize: "8px" }}><span style={{ position: "relative", top: textOffset }}>โกดัง</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displaySecuritySets.map((security: any, idx: number) => (
                            <tr key={idx}>
                                <Cell width="30px" center isAlt={idx % 2 === 1}>{idx + 1}</Cell>
                                <Cell isAlt={idx % 2 === 1}>{security.name}</Cell>
                                <Cell width="50px" center bold isAlt={idx % 2 === 1}>{security.qty > 0 ? security.qty : ""}</Cell>
                                <Cell width="80px" center isAlt={idx % 2 === 1}>{security.withdrawFor || ""}</Cell>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Note */}
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

                {/* Signatures - 2 แถว */}
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", marginBottom: "15px" }}>
                    <SignatureBlock title="ลงชื่อผู้ส่งของ (ร้านต้นทาง)" width="220px" />
                    <SignatureBlock title="ลงชื่อผู้รับของ (ร้านปลายทาง)" width="220px" />
                </div>
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end" }}>
                    <SignatureBlock title="Approved by Cheil" showImage={true} date={formatDateThai(doc.approvedAt)} width="220px" />
                    <SignatureBlock title="ลงชื่อผู้ขนส่ง" width="220px" />
                </div>
            </>
        );
    };

    // ============ REPAIR Template ============
    const renderRepair = () => {
        const totalRows = 6;
        const emptyRows = Math.max(0, totalRows - assets.length);

        return (
            <>
                {/* Header with 🔧 */}
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "15px",
                    paddingBottom: "10px",
                    borderBottom: `3px solid ${colors.primary}`,
                }}>
                    <div>
                        <h1 style={{ fontSize: "22px", fontWeight: 700, color: colors.primary, margin: 0, marginBottom: "5px" }}>
                            <span style={{ position: "relative", top: textOffset }}>🔧 เอกสารแจ้งซ่อม Asset</span>
                        </h1>
                        <div style={{ fontSize: "14px", color: colors.secondary, fontWeight: 500 }}>
                            <span style={{ position: "relative", top: textOffset }}>เลขที่: <span style={{ fontWeight: 700 }}>{doc.docCode}</span></span>
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ backgroundColor: colors.black, color: colors.white, padding: "6px 20px", fontWeight: 700, borderRadius: "4px", fontSize: "13px", display: "inline-block", letterSpacing: "1px", marginBottom: "5px" }}>
                            <span style={{ position: "relative", top: textOffset }}>SAMSUNG</span>
                        </div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: colors.primary }}>
                            <span style={{ position: "relative", top: textOffset }}>{vendorName}</span>
                        </div>
                    </div>
                </div>

                {/* Info Cards */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                    {/* ข้อมูลผู้แจ้งซ่อม */}
                    <div style={{
                        flex: 1,
                        backgroundColor: colors.rowAlt,
                        borderRadius: "6px",
                        padding: "10px 15px",
                        border: `1px solid ${colors.border}`,
                    }}>
                        <div style={{ fontSize: "10px", fontWeight: 600, color: colors.secondary, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px", position: "relative", top: "-5px" }}>
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
                        <div style={{ fontSize: "10px", fontWeight: 600, color: "#dc2626", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px", position: "relative", top: "-5px" }}>
                            📅 วันที่ส่งซ่อม
                        </div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "#991b1b", position: "relative", top: "-5px" }}>
                            {formatDate(shop?.startInstallDate || doc.createdAt)}
                        </div>
                    </div>
                </div>

                {/* Asset Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px", borderRadius: "8px", overflow: "hidden" }}>
                    <thead>
                        <tr><th colSpan={7} style={headerStyle}><span style={{ position: "relative", top: textOffset }}>🔧 รายการ Asset ที่แจ้งซ่อม</span></th></tr>
                        <tr>
                            <th style={{ ...thStyle, width: "35px" }}><span style={{ position: "relative", top: textOffset }}>No.</span></th>
                            <th style={{ ...thStyle, width: "90px" }}><span style={{ position: "relative", top: textOffset }}>Barcode</span></th>
                            <th style={thStyle}><span style={{ position: "relative", top: textOffset }}>Asset Name</span></th>
                            <th style={{ ...thStyle, width: "80px" }}><span style={{ position: "relative", top: textOffset }}>รูปภาพ</span></th>
                            <th style={{ ...thStyle, width: "70px" }}><span style={{ position: "relative", top: textOffset }}>Size</span></th>
                            <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>เกรด</span></th>
                            <th style={{ ...thStyle, width: "50px" }}><span style={{ position: "relative", top: textOffset }}>จำนวน</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((asset: any, idx: number) => (
                            <tr key={idx}>
                                <Cell width="35px" center isAlt={idx % 2 === 1} hasImage>{idx + 1}</Cell>
                                <Cell width="90px" center isAlt={idx % 2 === 1} hasImage>{asset.barcode || "-"}</Cell>
                                <Cell isAlt={idx % 2 === 1} hasImage>{asset.name}</Cell>
                                <ImageCell imageUrl={assetImages[asset.name] || null} isAlt={idx % 2 === 1} />
                                <Cell width="70px" center isAlt={idx % 2 === 1} hasImage>{asset.size || "-"}</Cell>
                                <Cell width="50px" center isAlt={idx % 2 === 1} hasImage>{asset.grade || "-"}</Cell>
                                <Cell width="50px" center bold isAlt={idx % 2 === 1} hasImage>{asset.qty}</Cell>
                            </tr>
                        ))}
                        {Array.from({ length: emptyRows }).map((_, idx) => (
                            <tr key={`empty-${idx}`}>
                                <Cell width="35px" center isAlt={(assets.length + idx) % 2 === 1} hasImage>{assets.length + idx + 1}</Cell>
                                <Cell width="90px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <ImageCell imageUrl={null} isAlt={(assets.length + idx) % 2 === 1} />
                                <Cell width="70px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="50px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                                <Cell width="50px" center isAlt={(assets.length + idx) % 2 === 1} hasImage />
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Note - อาการเสีย */}
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

                {/* Signatures - 2 แถว */}
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", marginBottom: "20px" }}>
                    <SignatureBlock title="ลงชื่อผู้แจ้งซ่อม" width="220px" />
                    <SignatureBlock title="ลงชื่อผู้รับเรื่อง" width="220px" />
                </div>
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end" }}>
                    <SignatureBlock title="Approved by Cheil" showImage={true} date={formatDateThai(doc.approvedAt)} width="220px" />
                    <SignatureBlock title="ลงชื่อผู้ส่งมอบงาน (ซ่อมเสร็จ)" width="220px" />
                </div>
            </>
        );
    };

    // ============ Select Template by Type ============
    const renderTemplate = () => {
        switch (documentType) {
            case "withdraw":
                return renderWithdraw();
            case "routing2shops":
            case "routing3shops":
            case "routing4shops":
                return renderRouting();
            case "other":
                return renderOther();
            case "transfer":
                return renderTransfer();
            case "borrowSecurity":
            case "borrowsecurity":
            case "borrow":
                return renderBorrow();
            case "returnAsset":
            case "returnasset":
            case "return":
                return renderReturn();
            case "shopToShop":
            case "shoptoShop":
            case "shoptoship":
            case "shop-to-shop":
                return renderShopToShop();
            case "repair":
                return renderRepair();
            default:
                return renderWithdraw();
        }
    };

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />

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
                {renderTemplate()}
            </div>
        </>
    );
}