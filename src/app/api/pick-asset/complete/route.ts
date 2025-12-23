// app/api/pick-asset/complete/route.ts
// API สำหรับ Picker กด Complete เมื่อกรอก Barcode ครบแล้ว
// จะ Mark Tasks เป็น completed และอัปเดต Transaction History (เพิ่มขา OUT)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ✅ ฟังก์ชันคำนวณ Week Number (ตามสูตร Excel: WEEKNUM(date, 15) = ISO Week เริ่มวันจันทร์)
// Output Format: "2025 WK 11"
function getWeekNumber(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()} WK ${weekNo.toString().padStart(2, "0")}`;
}

// ✅ Helper: กำหนดคอลัมน์ WK ที่ต้องบันทึกตามประเภทเอกสาร (สำหรับขาออก)
type WkOutColumn = "wkOut" | "wkOutForRepair" | "wkInForRepair" | "borrow";

function getWkOutColumnForDocumentType(documentType: string): WkOutColumn {
    switch (documentType) {
        // ขาออก - เบิกปกติ
        case "withdraw":
        case "routing2shops":
        case "routing3shops":
        case "routing4shops":
        case "withdrawother":
            return "wkOut";

        // ขาออก - ย้ายระหว่างโกดัง (WK OUT for Repair = ออก, WK IN for Repair = เข้า)
        case "transfer":
            return "wkOutForRepair";

        // ขาออก - ยืม
        case "borrow":
        case "borrowsecurity":
            return "borrow";

        default:
            return "wkOut";
    }
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

function getWkDataForOutTransaction(
    documentType: string,
    weekNumber: string,
    otherActivity?: string | null
): WkData {
    // ถ้ามี otherActivity → บันทึกในคอลัมน์ที่เลือกแทน (ไม่แตะคอลัมน์อื่น)
    if (otherActivity) {
        const result: WkData = {};
        switch (otherActivity) {
            case "outToRentalWarehouse":
                result.outToRentalWarehouse = weekNumber;
                break;
            case "inToRentalWarehouse":
                result.inToRentalWarehouse = weekNumber;
                break;
            case "discarded":
                result.discarded = weekNumber;
                break;
            case "adjustError":
                result.adjustError = weekNumber;
                break;
        }
        return result;
    }

    // ถ้าไม่มี otherActivity → ใช้ logic ปกติ (ไม่แตะคอลัมน์อื่น)
    const normalColumn = getWkOutColumnForDocumentType(documentType);

    // ✅ บันทึกเฉพาะคอลัมน์ที่ตรงกับ normalColumn เท่านั้น (ไม่เขียนทับคอลัมน์อื่น)
    const result: WkData = {};

    switch (normalColumn) {
        case "wkOut":
            result.wkOut = weekNumber;
            break;
        case "wkOutForRepair":
            result.wkOutForRepair = weekNumber;
            break;
        case "borrow":
            result.borrow = weekNumber;
            break;
    }

    return result;
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

        // 2. ดึง vendor และ userId ของ Picker (User ที่ login)
        const pickerId = parseInt((session.user as any).id || (session.user as any).sub || "0");

        const picker = await prisma.user.findUnique({
            where: { id: pickerId },
            select: { vendor: true },
        });

        if (!picker || !picker.vendor) {
            return NextResponse.json(
                { success: false, message: "User vendor not found" },
                { status: 400 }
            );
        }

        // 3. รับข้อมูลจาก body
        const body = await req.json();
        const { documentId, shopCode } = body;

        if (!documentId || typeof documentId !== "number") {
            return NextResponse.json(
                { success: false, message: "Valid document ID is required" },
                { status: 400 }
            );
        }

        // 4. ดึง Tasks ของเอกสารนี้ (ของ vendor นี้) - filter ตาม shopCode ถ้ามี
        const whereClause: any = {
            documentId,
            warehouse: picker.vendor,
        };

        // ✅ ถ้ามี shopCode ให้ filter เฉพาะ Shop นั้น
        if (shopCode) {
            whereClause.shopCode = shopCode;
        }

        const tasks = await prisma.pickAssetTask.findMany({
            where: whereClause,
            include: {
                document: {
                    include: {
                        createdBy: true, // ดึงข้อมูลผู้ออกเอกสาร
                    },
                },
            },
        }) as any[];

        if (tasks.length === 0) {
            return NextResponse.json(
                { success: false, message: "No tasks found or access denied" },
                { status: 404 }
            );
        }

        // 5. แยก tasks ที่ถูกยกเลิกออก
        const cancelledTasks = tasks.filter((t) => t.status === "cancelled");
        const activeTasks = tasks.filter((t) => t.status !== "cancelled");

        // 6. เช็คว่ากรอก Barcode ครบหรือยัง (เฉพาะ active tasks ของ Shop นี้)
        // ✅ Security Type C ไม่ต้องกรอก Barcode
        const tasksNeedBarcode = activeTasks.filter((t) => !t.assetName.includes("Security Type C"));
        const incompleteTasks = tasksNeedBarcode.filter((t) => !t.barcode);
        if (incompleteTasks.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: `กรุณากรอก Barcode ให้ครบ ยังเหลืออีก ${incompleteTasks.length} รายการ`,
                    incompleteTasks: incompleteTasks.map((t) => ({
                        id: t.id,
                        assetName: t.assetName,
                    })),
                },
                { status: 400 }
            );
        }

        // 7. Mark active Tasks เป็น completed (เฉพาะ Shop นี้ ไม่รวม cancelled)
        const updateWhereClause: any = {
            documentId,
            warehouse: picker.vendor,
            status: { not: "cancelled" }, // ไม่อัปเดต cancelled tasks
        };

        // ✅ ถ้ามี shopCode ให้ update เฉพาะ Shop นั้น
        if (shopCode) {
            updateWhereClause.shopCode = shopCode;
        }

        await prisma.pickAssetTask.updateMany({
            where: updateWhereClause,
            data: {
                status: "completed",
                completedAt: new Date(),
                completedBy: pickerId,
            },
        });

        // 8. ถ้ามี cancelled tasks → อัปเดต DocumentAsset/DocumentSecuritySet และล้างรูปเอกสาร
        const document = tasks[0].document;
        const documentCreator = document.createdBy;

        if (cancelledTasks.length > 0) {
            // นับจำนวนที่ถูกยกเลิกแยกตาม assetName, isSecuritySet, และ shopId (ถ้ามี)
            const cancelledCounts: Record<string, { count: number; isSecuritySet: boolean; shopName?: string }> = {};
            for (const task of cancelledTasks) {
                const key = `${task.assetName}|||${task.isSecuritySet}|||${task.shopName || ""}`;
                if (!cancelledCounts[key]) {
                    cancelledCounts[key] = { count: 0, isSecuritySet: task.isSecuritySet, shopName: task.shopName };
                }
                cancelledCounts[key].count++;
            }

            // ดึง DocumentShop พร้อม assets และ securitySets
            const documentShops = await prisma.documentShop.findMany({
                where: { documentId },
                include: {
                    assets: true,
                    securitySets: true,
                },
            });

            // อัปเดตแต่ละ shop
            for (const shop of documentShops) {
                // อัปเดต DocumentAsset
                for (const asset of shop.assets) {
                    const key = `${asset.name}|||false|||${shop.shopName || ""}`;
                    if (cancelledCounts[key]) {
                        const newQty = asset.qty - cancelledCounts[key].count;
                        if (newQty <= 0) {
                            // ลบรายการถ้า qty <= 0
                            await prisma.documentAsset.delete({
                                where: { id: asset.id },
                            });
                        } else {
                            // อัปเดต qty
                            await prisma.documentAsset.update({
                                where: { id: asset.id },
                                data: { qty: newQty },
                            });
                        }
                    }
                }

                // อัปเดต DocumentSecuritySet
                for (const sec of shop.securitySets) {
                    const key = `${sec.name}|||true|||${shop.shopName || ""}`;
                    if (cancelledCounts[key]) {
                        const newQty = sec.qty - cancelledCounts[key].count;
                        if (newQty <= 0) {
                            // ลบรายการถ้า qty <= 0
                            await prisma.documentSecuritySet.delete({
                                where: { id: sec.id },
                            });
                        } else {
                            // อัปเดต qty
                            await prisma.documentSecuritySet.update({
                                where: { id: sec.id },
                                data: { qty: newQty },
                            });
                        }
                    }
                }
            }

            console.log(`✅ Document ${documentId} updated: ${cancelledTasks.length} items cancelled`);
        }

        // 9. อัปเดต Transaction History สำหรับแต่ละ active Task (เพิ่มขา OUT)

        let transactionsUpdated = 0;
        let transactionsNotFound = 0;
        const notFoundBarcodes: string[] = [];
        let securityTypeCProcessed = 0;

        for (const task of activeTasks) {
            // ✅ Security Type C: ไม่มี Barcode - สร้าง Transaction ใหม่โดยตรง
            const isSecurityTypeC = task.assetName.includes("Security Type C");

            // ✅ กำหนด Status: ถ้ามี MCS Code → ดึง SHOP TYPE จาก Shop table, ถ้าไม่มี → "NO MCS"
            let taskStatus = "NO MCS";
            if (task.shopCode && task.shopCode.trim() !== "") {
                // ดึง SHOP TYPE จาก Shop table
                const shop = await prisma.shop.findUnique({
                    where: { mcsCode: task.shopCode },
                    select: { shopType: true },
                });
                taskStatus = shop?.shopType || "NO MCS";
            }

            if (isSecurityTypeC) {
                // สร้าง Transaction สำหรับ Security Type C (ไม่ต้องหา existing)
                const currentDate = new Date(); // ✅ วันที่ Picker กดบันทึก

                // ✅ กำหนด Remark OUT สำหรับ Security Type C
                let securityRemarkOut = "-";
                if ((document.documentType === "borrow" || document.documentType === "borrowsecurity") && document.borrowType) {
                    securityRemarkOut = document.borrowType;
                }

                await prisma.securitySetTransaction.create({
                    data: {
                        documentId: document.id,
                        docCode: document.docCode,

                        // Asset Info
                        barcode: null, // ไม่มี Barcode
                        assetName: task.assetName,

                        // OUT Info
                        outDate: currentDate, // ✅ เปลี่ยนเป็นวันที่ Picker กดบันทึก
                        unitOut: task.qty,
                        toVendor: documentCreator?.vendor || null,
                        status: document.transactionStatus || null, // ✅ Status ที่ Admin เลือก (18 ค่า)
                        mcsCodeOut: task.shopCode || null,
                        toShop: task.shopName || null,
                        remarkOut: securityRemarkOut,

                        // Balance
                        balance: 0,

                        // WK
                        ...getWkDataForOutTransaction(document.documentType, getWeekNumber(currentDate), document.otherActivity),
                    },
                });
                securityTypeCProcessed++;
                continue;
            }

            // ✅ Asset ปกติ และ CONTROLBOX: ต้องมี Barcode
            const barcode = task.barcode;

            if (!barcode) {
                // ไม่มี barcode → ข้ามไป
                continue;
            }

            // ✅ เช็คว่าเป็น CONTROLBOX หรือไม่
            const isControlbox = task.assetName.includes("CONTROLBOX");

            // ✅ กำหนด Remark OUT
            let remarkOut = "-";
            if (document.documentType === "transfer" && document.operation) {
                if (document.operation === "อื่นๆ" && document.otherDetail) {
                    remarkOut = document.otherDetail;
                } else {
                    remarkOut = document.operation;
                }
            }
            // ✅ ถ้าเป็นใบยืม (borrow, borrowsecurity) ให้ใช้ borrowType
            if ((document.documentType === "borrow" || document.documentType === "borrowsecurity") && document.borrowType) {
                remarkOut = document.borrowType;
            }

            if (isControlbox) {
                // ===== CONTROLBOX: ใช้ SecuritySetTransaction =====
                const existingSecurityTransaction = await prisma.securitySetTransaction.findFirst({
                    where: {
                        barcode,
                        balance: 1,
                    },
                    orderBy: {
                        id: "desc",
                    },
                });

                if (!existingSecurityTransaction) {
                    transactionsNotFound++;
                    notFoundBarcodes.push(barcode);
                    console.warn(`⚠️ No active security transaction found for barcode: ${barcode}`);
                    continue;
                }

                // อัปเดต SecuritySetTransaction
                const currentDateSecurity = new Date(); // ✅ วันที่ Picker กดบันทึก
                await prisma.securitySetTransaction.update({
                    where: { id: existingSecurityTransaction.id },
                    data: {
                        documentId: document.id,
                        outDate: currentDateSecurity, // ✅ เปลี่ยนเป็นวันที่ Picker กดบันทึก
                        unitOut: 1,
                        toVendor: documentCreator?.vendor || null,
                        status: document.transactionStatus || null, // ✅ Status ที่ Admin เลือก (18 ค่า)
                        mcsCodeOut: task.shopCode || null,
                        toShop: task.shopName || null,
                        remarkOut: remarkOut,
                        balance: 0,
                        ...getWkDataForOutTransaction(document.documentType, getWeekNumber(currentDateSecurity), document.otherActivity),
                    },
                });

                transactionsUpdated++;
                continue;
            }

            // ===== Asset ปกติ: ใช้ AssetTransactionHistory =====
            const existingTransaction = await prisma.assetTransactionHistory.findFirst({
                where: {
                    barcode,
                    balance: 1,
                },
                orderBy: {
                    createdAt: "desc",
                },
            });

            if (!existingTransaction) {
                transactionsNotFound++;
                notFoundBarcodes.push(barcode);
                console.warn(`⚠️ No active transaction found for barcode: ${barcode}`);
                continue;
            }

            // ✅ อัปเดต Transaction เดิม (เพิ่มขา OUT)
            const currentDateAsset = new Date(); // ✅ วันที่ Picker กดบันทึก
            await prisma.assetTransactionHistory.update({
                where: { id: existingTransaction.id },
                data: {
                    documentId: document.id,
                    outDate: currentDateAsset, // ✅ เปลี่ยนเป็นวันที่ Picker กดบันทึก
                    unitOut: 1,
                    toVendor: documentCreator?.vendor || null,
                    status: document.transactionStatus || null, // ✅ Status ที่ Admin เลือก (18 ค่า)
                    shopType: taskStatus, // ✅ Shop Type จาก Shop table
                    mcsCodeOut: task.shopCode || null,
                    toShop: task.shopName || null,
                    remarkOut: remarkOut,
                    grade: task.grade || undefined,
                    balance: 0,
                    assetStatus: "-",

                    // ✅ บันทึก WK ตามประเภทเอกสารหรือ otherActivity
                    ...getWkDataForOutTransaction(document.documentType, getWeekNumber(currentDateAsset), document.otherActivity),
                },
            });

            transactionsUpdated++;

            // ✅ สำหรับ Lightbox / ACC WALL: อัปเดต Size ลง Asset table ถ้ามี custom size
            const assetNameLower = task.assetName.toLowerCase().replace(/\s+/g, '');
            const isLightboxOrAccWall = assetNameLower.includes("lightbox") ||
                assetNameLower.includes("accwall");
            if (isLightboxOrAccWall && task.size && task.size.includes("*")) {
                // เป็น custom size format: W*D*H(XX)
                await prisma.asset.updateMany({
                    where: { barcode },
                    data: { size: task.size },
                });
                console.log(`✅ Updated Asset ${barcode} size to: ${task.size}`);
            }

            // ✅ ===== สำหรับ Transfer: สร้าง TransferReceiveTask รอโกดังปลายทางรับของ =====
            if (document.documentType === "transfer") {
                // สร้าง TransferReceiveTask (รอโกดังปลายทางตรวจสอบ)
                await prisma.transferReceiveTask.create({
                    data: {
                        documentId: document.id,
                        pickAssetTaskId: task.id,
                        barcode,
                        assetName: task.assetName,
                        size: task.size,
                        grade: task.grade,
                        fromWarehouse: task.warehouse, // โกดังต้นทาง (Vendor ของผู้สร้างเอกสาร)
                        toWarehouse: task.shopName || "", // โกดังปลายทาง (ที่ User เลือกใน Form)
                        status: "pending", // รอตรวจสอบ
                    },
                });
                console.log(`✅ Created TransferReceiveTask for barcode: ${barcode}, toWarehouse: ${task.shopName}`);
            }
        }

        // 10. สร้าง Response
        let message = `Successfully completed ${activeTasks.length} tasks and updated ${transactionsUpdated} transactions.`;

        if (cancelledTasks.length > 0) {
            message += ` ${cancelledTasks.length} tasks were cancelled and document updated.`;
        }

        if (securityTypeCProcessed > 0) {
            message += ` Created ${securityTypeCProcessed} security type C transactions.`;
        }

        if (transactionsNotFound > 0) {
            message += ` Warning: ${transactionsNotFound} barcodes not found in system (${notFoundBarcodes.join(", ")}).`;
        }

        return NextResponse.json({
            success: true,
            message,
            tasksCompleted: activeTasks.length,
            tasksCancelled: cancelledTasks.length,
            transactionsUpdated,
            securityTypeCProcessed,
            transactionsNotFound,
            notFoundBarcodes,
            documentUpdated: cancelledTasks.length > 0,
        });
    } catch (error) {
        console.error("Error completing tasks:", error);
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