// app/api/document/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ประเภทเอกสารที่ต้องผ่าน Pick Asset (1-8) - ขาออกอย่างเดียว
const NEEDS_PICK_ASSET_TYPES = [
    "withdraw",
    "routing2shops",
    "routing3shops",
    "routing4shops",
    "withdrawother",
    "other", // ✅ เพิ่ม other
    "transfer",
    "borrowsecurity",
    "borrow",
];

// ประเภทเอกสารที่บันทึกลง AssetTransactionHistory ทันที (9-11)
const DIRECT_TRANSACTION_TYPES = ["return", "returnasset", "shoptoshop", "repair"];

// ฟังก์ชันคำนวณ Week Number (ตามสูตร Excel: WEEKNUM(date, 15) = ISO Week เริ่มวันจันทร์)
// Output Format: "2025 WK 11"
function getWeekNumber(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number (Monday=1, Sunday=7)
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    // Get first day of year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()} WK ${weekNo.toString().padStart(2, "0")}`;
}

// ✅ Helper: กำหนดคอลัมน์ WK ที่ต้องบันทึกตามประเภทเอกสาร
type WkColumn = "wkOut" | "wkIn" | "wkOutForRepair" | "wkInForRepair" | "newInStock" | "refurbishedInStock" | "borrow" | "return";

function getWkColumnForDocumentType(documentType: string, returnCondition?: string | null): WkColumn | null {
    switch (documentType) {
        // ขาออก
        case "withdraw":
        case "routing2shops":
        case "routing3shops":
        case "routing4shops":
        case "withdrawother":
            return "wkOut";

        // ขาออกไปซ่อม/ย้ายระหว่างโกดัง
        case "transfer":
            return "wkOutForRepair";

        // ขาออกไปยืม
        case "borrow":
        case "borrowsecurity":
            return "borrow";

        // ขาเข้า - เก็บกลับ
        case "return":
        case "returnasset":
            // เช็ค returnCondition
            if (returnCondition === "from_borrow") {
                return "return"; // เก็บกลับจากการยืม
            }
            return "wkIn"; // เก็บกลับปกติ

        // ขาเข้าจากซ่อม
        case "repair":
            return "refurbishedInStock";

        default:
            return null;
    }
}

// ฟังก์ชันตรวจสอบว่าต้องผ่าน Picker หรือไม่
async function needsPickerProcess(documentId: number): Promise<boolean> {
    const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
            shops: {
                include: {
                    assets: true,
                    securitySets: true,
                },
            },
        },
    });

    if (!document) return false;

    // ถ้าเป็นประเภท Direct Transaction ไม่ต้องผ่าน Picker
    if (DIRECT_TRANSACTION_TYPES.includes(document.documentType)) {
        return false;
    }

    // เช็คว่าเป็นประเภทที่ต้องผ่าน Pick Asset
    if (!NEEDS_PICK_ASSET_TYPES.includes(document.documentType)) {
        return false;
    }

    // เช็คว่ามี Asset หรือ Security Set หรือไม่
    for (const shop of document.shops) {
        if (shop.assets.length > 0 || shop.securitySets.length > 0) {
            return true;
        }
    }

    return false;
}

// ฟังก์ชันสร้าง Pick Asset Tasks (สำหรับลำดับ 1-8)
async function createPickAssetTasks(documentId: number): Promise<number> {
    const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
            createdBy: true, // ✅ เพิ่มเพื่อดึง vendor ของผู้สร้างเอกสาร
            shops: {
                include: {
                    assets: true,
                    securitySets: true,
                },
            },
        },
    });

    if (!document) throw new Error("Document not found");

    let tasksCreated = 0;

    // ✅ สำหรับ Transfer: โกดังต้นทาง = Vendor ของผู้สร้างเอกสาร
    const isTransfer = document.documentType === "transfer";
    const creatorVendor = document.createdBy?.vendor || "Unknown";

    // Loop ผ่านแต่ละ Shop
    for (const shop of document.shops) {
        // สร้าง Tasks สำหรับ Assets
        for (const asset of shop.assets) {
            // สร้าง Task เท่ากับจำนวน qty (แต่ละ Task มี qty = 1)
            for (let i = 0; i < asset.qty; i++) {
                await prisma.pickAssetTask.create({
                    data: {
                        documentId: document.id,
                        assetName: asset.name,
                        size: asset.size || null,
                        grade: asset.grade || null, // ✅ เพิ่ม grade
                        qty: 1,
                        isSecuritySet: false,
                        // ✅ Transfer: ใช้ vendor ของผู้สร้าง, อื่นๆ: ใช้ withdrawFor
                        warehouse: isTransfer ? creatorVendor : (asset.withdrawFor || "Unknown"),
                        shopCode: shop.shopCode,
                        shopName: shop.shopName,
                        startInstallDate: shop.startInstallDate,
                        endInstallDate: shop.endInstallDate,
                        q7b7: shop.q7b7,
                        shopFocus: shop.shopFocus,
                        requesterName: document.fullName,
                        requesterCompany: document.company,
                        requesterPhone: document.phone,
                        status: "pending",
                        // ✅ Transfer: ส่ง barcode ที่ User ระบุมาด้วย
                        barcode: isTransfer ? (asset.barcode || null) : null,
                    },
                });
                tasksCreated++;
            }
        }

        // สร้าง Tasks สำหรับ Security Sets
        for (const security of shop.securitySets) {
            // ✅ เช็คว่าเป็น Security Type C หรือไม่ (ไม่มี Barcode)
            const isSecurityTypeC = security.name.includes("Security Type C");

            if (isSecurityTypeC) {
                // ✅ Security Type C: สร้าง Task เดียว รวมจำนวน (ไม่ต้องระบุ Barcode)
                await prisma.pickAssetTask.create({
                    data: {
                        documentId: document.id,
                        assetName: security.name,
                        qty: security.qty, // รวมจำนวนจริง
                        isSecuritySet: true,
                        warehouse: security.withdrawFor || "Unknown",
                        shopCode: shop.shopCode,
                        shopName: shop.shopName,
                        startInstallDate: shop.startInstallDate,
                        endInstallDate: shop.endInstallDate,
                        q7b7: shop.q7b7,
                        shopFocus: shop.shopFocus,
                        requesterName: document.fullName,
                        requesterCompany: document.company,
                        requesterPhone: document.phone,
                        status: "pending",
                    },
                });
                tasksCreated++;
            } else {
                // ✅ CONTROLBOX: แยกรายการเป็น 1 ต่อชิ้น (ต้องระบุ Barcode)
                for (let i = 0; i < security.qty; i++) {
                    await prisma.pickAssetTask.create({
                        data: {
                            documentId: document.id,
                            assetName: security.name,
                            qty: 1,
                            isSecuritySet: true,
                            warehouse: security.withdrawFor || "Unknown",
                            shopCode: shop.shopCode,
                            shopName: shop.shopName,
                            startInstallDate: shop.startInstallDate,
                            endInstallDate: shop.endInstallDate,
                            q7b7: shop.q7b7,
                            shopFocus: shop.shopFocus,
                            requesterName: document.fullName,
                            requesterCompany: document.company,
                            requesterPhone: document.phone,
                            status: "pending",
                        },
                    });
                    tasksCreated++;
                }
            }
        }
    }

    return tasksCreated;
}

// ✅ Helper: สร้าง WK data object ตาม otherActivity หรือ logic ปกติ
type WkData = {
    wkOut?: string | null;
    wkIn?: string | null;
    wkOutForRepair?: string | null;
    wkInForRepair?: string | null;
    newInStock?: string | null;
    refurbishedInStock?: string | null;
    borrow?: string | null;
    return?: string | null;
    outToRentalWarehouse?: string | null;
    inToRentalWarehouse?: string | null;
    discarded?: string | null;
    adjustError?: string | null;
};

function getWkDataForTransaction(
    normalColumn: WkColumn | null,
    weekNumber: string,
    otherActivity?: string | null
): WkData {
    // ถ้ามี otherActivity → บันทึกในคอลัมน์ที่เลือกแทน (ไม่แตะคอลัมน์อื่น)
    if (otherActivity) {
        return {
            outToRentalWarehouse: otherActivity === "outToRentalWarehouse" ? weekNumber : undefined,
            inToRentalWarehouse: otherActivity === "inToRentalWarehouse" ? weekNumber : undefined,
            discarded: otherActivity === "discarded" ? weekNumber : undefined,
            adjustError: otherActivity === "adjustError" ? weekNumber : undefined,
        };
    }

    // ถ้าไม่มี otherActivity → ใช้ logic ปกติ (ไม่แตะคอลัมน์อื่น)
    if (!normalColumn) return {};

    // ✅ บันทึกเฉพาะคอลัมน์ที่ตรงกับ normalColumn เท่านั้น (ไม่เขียนทับคอลัมน์อื่น)
    const result: WkData = {};

    switch (normalColumn) {
        case "wkOut":
            result.wkOut = weekNumber;
            break;
        case "wkIn":
            result.wkIn = weekNumber;
            break;
        case "wkOutForRepair":
            result.wkOutForRepair = weekNumber;
            break;
        case "wkInForRepair":
            result.wkInForRepair = weekNumber;
            break;
        case "newInStock":
            result.newInStock = weekNumber;
            break;
        case "refurbishedInStock":
            result.refurbishedInStock = weekNumber;
            break;
        case "borrow":
            result.borrow = weekNumber;
            break;
        case "return":
            result.return = weekNumber;
            break;
    }

    return result;
}

// ฟังก์ชันจัดการ Transaction สำหรับ returnasset และ shoptoshop (ลำดับ 9-10)
async function createDirectTransactions(documentId: number): Promise<{ created: number; updated: number; notFound: string[]; securityCreated: number }> {
    const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
            createdBy: true, // ดึงข้อมูลผู้ออกเอกสาร
            shops: {
                include: {
                    assets: true,
                    securitySets: true, // ✅ เพิ่มดึง Security Sets
                },
            },
        },
    });

    if (!document) throw new Error("Document not found");

    const documentCreator = document.createdBy; // ผู้ออกเอกสาร
    let transactionsCreated = 0;
    let transactionsUpdated = 0;
    let securityTransactionsCreated = 0; // ✅ นับ Security Set Transactions
    const notFoundBarcodes: string[] = [];
    const currentDate = new Date();
    const weekNumber = getWeekNumber(currentDate);

    // หา Shop ต้นทาง และ Shop ปลายทาง (สำหรับ shoptoshop)
    const sourceShop = document.shops[0]; // Shop ต้นทาง
    const destShop = document.shops[1]; // Shop ปลายทาง (ถ้ามี)

    if (!sourceShop) return { created: 0, updated: 0, notFound: [], securityCreated: 0 };

    for (const asset of sourceShop.assets) {
        if (!asset.barcode) continue; // ข้ามถ้าไม่มี barcode

        // ดึงข้อมูล Asset จาก Asset table (ถ้ามี)
        const assetData = await prisma.asset.findUnique({
            where: { barcode: asset.barcode },
        });

        if (document.documentType === "shoptoshop") {
            // ===== ลำดับ 10: Shop To Shop =====
            // Logic: ขาเข้า + ขาออก พร้อมกัน (Transaction ใหม่)
            // - ขาเข้า: จาก Shop ต้นทาง
            // - ขาออก: ไป Shop ปลายทาง
            // - Balance = 0 (ย้ายไปร้านอื่นแล้ว)

            // กำหนด Shop Type: ถ้ามี MCS Code → ดึง SHOP TYPE จาก Shop table, ถ้าไม่มี → "NO MCS"
            let shopTypeValue = "NO MCS";
            if (destShop?.shopCode && destShop.shopCode.trim() !== "") {
                const shopData = await prisma.shop.findUnique({
                    where: { mcsCode: destShop.shopCode },
                    select: { shopType: true },
                });
                shopTypeValue = shopData?.shopType || "NO MCS";
            }

            await prisma.assetTransactionHistory.create({
                data: {
                    documentId: document.id,

                    // ===== ข้อมูล Asset (ดึงจาก Barcode) =====
                    barcode: asset.barcode,
                    assetName: assetData?.assetName || asset.name,
                    size: assetData?.size || asset.size || null,
                    grade: asset.grade || "A",
                    startWarranty: assetData?.startWarranty || null,
                    endWarranty: assetData?.endWarranty || null,
                    cheilPO: assetData?.cheilPO || null,

                    // ===== ขา IN (จาก Shop ต้นทาง) =====
                    // Warehouse: Vendor ของผู้ออกเอกสาร
                    warehouseIn: documentCreator?.vendor || null,
                    // In Stock Date: วันที่เริ่มติดตั้ง
                    inStockDate: sourceShop.startInstallDate || currentDate,
                    // Unit In: 1
                    unitIn: 1,
                    // From Vendor: Vendor ของผู้ออกเอกสาร
                    fromVendor: documentCreator?.vendor || null,
                    // MCS Code (In): MCS Code ของ Shop ต้นทาง
                    mcsCodeIn: sourceShop.shopCode || null,
                    // From Shop: Shop Name ของ Shop ต้นทาง
                    fromShop: sourceShop.shopName || null,
                    // Remark IN: "Shop to Shop"
                    remarkIn: "Shop to Shop",

                    // ===== ขา OUT (ไป Shop ปลายทาง) =====
                    // Out Date: วันที่เริ่มติดตั้ง
                    outDate: sourceShop.startInstallDate || currentDate,
                    // Unit Out: 1
                    unitOut: 1,
                    // To Vendor: Vendor ของผู้ออกเอกสาร
                    toVendor: documentCreator?.vendor || null,
                    // Status: ค่าที่ Admin เลือก (18 ค่า)
                    status: document.transactionStatus || null,
                    // Shop Type: SHOP TYPE จาก Shop table หรือ "NO MCS"
                    shopType: shopTypeValue,
                    // MCS Code (Out): MCS Code ของ Shop ปลายทาง
                    mcsCodeOut: destShop?.shopCode || null,
                    // To Shop: Shop Name ของ Shop ปลายทาง
                    toShop: destShop?.shopName || null,
                    // Remark OUT: "Shop to Shop"
                    remarkOut: "Shop to Shop",

                    // ===== Auto by Logic =====
                    assetStatus: "-",
                    balance: 0, // ย้ายไปร้านอื่นแล้ว
                    transactionCategory: "-",
                    // ✅ บันทึก WK IN และ WK OUT
                    wkIn: getWeekNumber(sourceShop.startInstallDate || currentDate),
                    wkOut: getWeekNumber(sourceShop.startInstallDate || currentDate),
                },
            });

            transactionsCreated++;

        } else if (document.documentType === "returnasset" || document.documentType === "return") {
            // ===== ลำดับ 9: Return Asset (ใบเก็บ Asset กลับ) =====
            // Logic: ขาเข้าอย่างเดียว (สร้าง Transaction ใหม่)
            // - เก็บของกลับจาก Shop เข้าโกดัง
            // - Balance = 1 (กลับมาอยู่ในโกดังแล้ว)
            // - บันทึก wkIn (เก็บกลับปกติ) หรือ return (เก็บกลับจากการยืม) ตาม returnCondition

            // ✅ กำหนดคอลัมน์ WK ที่จะบันทึก
            const wkColumn = getWkColumnForDocumentType(document.documentType, document.returnCondition);

            await prisma.assetTransactionHistory.create({
                data: {
                    documentId: document.id,

                    // ข้อมูล Asset (ดึงจาก Barcode)
                    barcode: asset.barcode,
                    assetName: assetData?.assetName || asset.name,
                    size: assetData?.size || asset.size || null,
                    grade: asset.grade || "A",
                    startWarranty: assetData?.startWarranty || null,
                    endWarranty: assetData?.endWarranty || null,
                    cheilPO: assetData?.cheilPO || null,

                    // ===== ขา IN (เก็บกลับเข้าโกดัง) =====
                    // Warehouse: ดึงจาก Vendor ของผู้ออกเอกสาร (เก็บกลับเข้าโกดังของตัวเอง)
                    warehouseIn: documentCreator?.vendor || null,
                    // In Stock Date: ดึงจาก วันที่เริ่มติดตั้ง
                    inStockDate: sourceShop.startInstallDate || currentDate,
                    // Unit In: 1
                    unitIn: 1,
                    // From Vendor: Vendor ของผู้ออกเอกสาร
                    fromVendor: documentCreator?.vendor || null,
                    // MCS Code (In): ดึงจาก MCS Code
                    mcsCodeIn: sourceShop.shopCode || null,
                    // From Shop: ดึงจาก Shop Name
                    fromShop: sourceShop.shopName || null,
                    // Remark IN: "-"
                    remarkIn: "-",

                    // ===== Auto by Logic =====
                    assetStatus: "USED", // ✅ นำเข้าจากการเก็บกลับ
                    balance: 1, // กลับเข้าโกดังแล้ว (พร้อมใช้งาน)
                    transactionCategory: "-",
                    // ✅ บันทึก WK ตามเงื่อนไขหรือ otherActivity
                    ...getWkDataForTransaction(wkColumn, weekNumber, document.otherActivity),
                },
            });

            transactionsCreated++;

        } else if (document.documentType === "repair") {
            // ===== ลำดับ 11: ใบแจ้งซ่อม (Repair) =====
            // Logic ใหม่:
            // 1. อัปเดต Transaction เดิม (เพิ่มขา OUT) → Balance = 0 (ของออกไปซ่อมที่โกดังตัวเอง)
            // 2. สร้าง RepairTask สำหรับหน้า Repair Asset

            // === Step 1: หา Transaction เดิมที่มี Balance = 1 แล้วอัปเดตขา OUT ===
            const existingTransaction = await prisma.assetTransactionHistory.findFirst({
                where: {
                    barcode: asset.barcode,
                    balance: 1,
                },
                orderBy: { id: "desc" },
            });

            if (existingTransaction) {
                // อัปเดต Transaction เดิม (เพิ่มขา OUT)
                await prisma.assetTransactionHistory.update({
                    where: { id: existingTransaction.id },
                    data: {
                        // ขา OUT
                        outDate: sourceShop.startInstallDate || currentDate,
                        unitOut: 1,
                        toVendor: documentCreator?.vendor || null, // ✅ Vendor ของผู้ทำเอกสาร
                        status: "SEND TO REPAIR",
                        mcsCodeOut: "-",
                        toShop: documentCreator?.vendor || null, // ✅ Vendor ของผู้ทำเอกสาร
                        remarkOut: "ส่งซ่อม",
                        balance: 0, // ออกไปซ่อมแล้ว
                        repair: getWeekNumber(sourceShop.startInstallDate || currentDate), // ✅ บันทึก WK ลงคอลัมน์ Repair
                    },
                });
                transactionsUpdated++;
            } else {
                notFoundBarcodes.push(asset.barcode);
            }

            // === Step 2: สร้าง RepairTask ===
            await prisma.repairTask.create({
                data: {
                    documentId: document.id,
                    barcode: asset.barcode,
                    assetName: assetData?.assetName || asset.name,
                    size: assetData?.size || asset.size || null,
                    grade: asset.grade || "A",
                    repairWarehouse: documentCreator?.vendor || "Unknown", // ✅ ใช้ Vendor ของผู้แจ้งซ่อม
                    reporterName: document.fullName,
                    reporterCompany: document.company,
                    reporterPhone: document.phone,
                    reporterVendor: documentCreator?.vendor || null,
                    status: "pending", // รอดำเนินการ
                    transactionId: existingTransaction?.id || null, // เก็บ ID สำหรับอ้างอิง (ถ้ามี)
                },
            });

            transactionsCreated++;
        }
    }

    // ✅ ===== บันทึก Security Set Transaction (เฉพาะ returnasset/return = ขาเข้า) =====
    if (document.documentType === "returnasset" || document.documentType === "return") {
        for (const shop of document.shops) {
            for (const security of shop.securitySets) {
                if (security.qty <= 0) continue; // ข้ามถ้าจำนวนเป็น 0

                // เช็คว่าเป็น CONTROLBOX (มี Barcode) หรือไม่
                const isControlBox = security.name.includes("CONTROLBOX");

                if (isControlBox) {
                    // ✅ CONTROLBOX: Track แยกรายตัว
                    // ถ้ามี Barcode จาก form → สร้าง 1 record พร้อม barcode
                    // ถ้าไม่มี Barcode → สร้างตามจำนวน qty

                    if (security.barcode) {
                        // มี Barcode: สร้าง 1 record พร้อม barcode
                        await prisma.securitySetTransaction.create({
                            data: {
                                docCode: document.docCode,
                                documentId: document.id,
                                assetName: security.name,
                                barcode: security.barcode, // ✅ ใช้ barcode จาก form

                                // ===== ขา IN (เก็บกลับเข้าโกดัง) =====
                                warehouseIn: security.withdrawFor || null,
                                inStockDate: sourceShop?.startInstallDate || currentDate,
                                unitIn: 1,
                                fromVendor: documentCreator?.vendor || null,
                                mcsCodeIn: shop.shopCode || null,
                                fromShop: shop.shopName || null,
                                remarkIn: "-",
                            },
                        });
                        securityTransactionsCreated++;
                    } else {
                        // ไม่มี Barcode: สร้างตามจำนวน qty
                        for (let i = 0; i < security.qty; i++) {
                            await prisma.securitySetTransaction.create({
                                data: {
                                    docCode: document.docCode,
                                    documentId: document.id,
                                    assetName: security.name,
                                    barcode: null,

                                    // ===== ขา IN (เก็บกลับเข้าโกดัง) =====
                                    warehouseIn: security.withdrawFor || null,
                                    inStockDate: sourceShop?.startInstallDate || currentDate,
                                    unitIn: 1,
                                    fromVendor: documentCreator?.vendor || null,
                                    mcsCodeIn: shop.shopCode || null,
                                    fromShop: shop.shopName || null,
                                    remarkIn: "-",
                                },
                            });
                            securityTransactionsCreated++;
                        }
                    }
                } else {
                    // ✅ Security Type C (ไม่มี Barcode): บันทึกเป็น 1 record ต่อ 1 รายการ
                    await prisma.securitySetTransaction.create({
                        data: {
                            docCode: document.docCode,
                            documentId: document.id,
                            assetName: security.name,
                            barcode: null, // ไม่มี Barcode

                            // ===== ขา IN (เก็บกลับเข้าโกดัง) =====
                            warehouseIn: security.withdrawFor || null,
                            inStockDate: sourceShop?.startInstallDate || currentDate,
                            unitIn: security.qty, // บันทึกจำนวนรวม
                            fromVendor: documentCreator?.vendor || null,
                            mcsCodeIn: shop.shopCode || null,
                            fromShop: shop.shopName || null,
                            remarkIn: "-",

                            // ===== ขา OUT (ปล่อยว่าง) =====
                            // ไม่ต้องใส่ค่า
                        },
                    });
                    securityTransactionsCreated++;
                }
            }
        }
    }

    return { created: transactionsCreated, updated: transactionsUpdated, notFound: notFoundBarcodes, securityCreated: securityTransactionsCreated };
}

export async function POST(req: NextRequest) {
    try {
        // 1. เช็ค Authentication
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2. เช็ค Role (Admin เท่านั้น)
        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, message: "Forbidden: Admin only" },
                { status: 403 }
            );
        }

        // 3. รับ documentId และ otherActivity
        const body = await req.json();
        const { documentId, otherActivity } = body;

        if (!documentId || typeof documentId !== "number") {
            return NextResponse.json(
                { success: false, message: "Valid document ID is required" },
                { status: 400 }
            );
        }

        // 4. เช็คว่าเอกสารมีอยู่จริง
        const document = await prisma.document.findUnique({
            where: { id: documentId },
        });

        if (!document) {
            return NextResponse.json(
                { success: false, message: "Document not found" },
                { status: 404 }
            );
        }

        // 5. เช็คว่าเอกสารถูก submit แล้วหรือยัง
        if (document.status !== "submitted") {
            return NextResponse.json(
                { success: false, message: "Document must be submitted first" },
                { status: 400 }
            );
        }

        // 6. Update document status เป็น approved + บันทึก otherActivity (ถ้ามี)
        await prisma.document.update({
            where: { id: documentId },
            data: {
                status: "approved",
                otherActivity: otherActivity || null, // ✅ บันทึก Other Activity
            },
        });

        // 7. ตรวจสอบประเภทเอกสาร
        const isDirectTransaction = DIRECT_TRANSACTION_TYPES.includes(document.documentType);

        if (isDirectTransaction) {
            // กรณี returnasset หรือ shoptoshop: บันทึกลง AssetTransactionHistory ทันที
            const result = await createDirectTransactions(documentId);

            let message = `Document approved successfully. Created ${result.created} transactions.`;
            if (result.securityCreated > 0) {
                message += ` Created ${result.securityCreated} security set transactions.`;
            }
            if (result.notFound.length > 0) {
                message += ` Warning: ${result.notFound.length} barcodes not found.`;
            }

            return NextResponse.json({
                success: true,
                message,
                needsPicker: false,
                transactionsCreated: result.created,
                transactionsUpdated: result.updated,
                securityTransactionsCreated: result.securityCreated,
                notFoundBarcodes: result.notFound,
            });
        }

        // 8. เช็คว่าต้องผ่าน Picker หรือไม่
        const needsPicker = await needsPickerProcess(documentId);

        if (needsPicker) {
            // กรณีที่ 1: ต้องผ่าน Picker (ลำดับ 1-8)
            const tasksCreated = await createPickAssetTasks(documentId);

            return NextResponse.json({
                success: true,
                message: `Document approved successfully. Created ${tasksCreated} pick tasks.`,
                needsPicker: true,
                tasksCreated,
            });
        } else {
            // กรณีที่ 2: ไม่ต้องผ่าน Picker และไม่ใช่ Direct Transaction
            return NextResponse.json({
                success: true,
                message: "Document approved successfully.",
                needsPicker: false,
            });
        }
    } catch (error) {
        console.error("Error approving document:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}