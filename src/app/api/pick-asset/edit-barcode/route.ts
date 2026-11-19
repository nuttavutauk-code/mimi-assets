// app/api/pick-asset/edit-barcode/route.ts
// API สำหรับ Admin แก้ไข Barcode หลัง Pick Complete

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { resolveOriginalAssetStatus } from "@/lib/assetStatus";
import { writeAuditLog, AuditAction, getSessionUser } from "@/lib/audit-log";
import { getWkOutColumnsWritten } from "@/lib/wkOut";

// ✅ ฟังก์ชันคำนวณ Week Number
function getWeekNumber(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()} WK ${weekNo.toString().padStart(2, "0")}`;
}

// ✅ เพิ่มเวอร์ชันเอกสาร (Ver.2, Ver.3 ...) ทุกครั้งที่แก้ Barcode ที่เคยกำหนดไปแล้ว
async function bumpDocumentVersion(tx: Prisma.TransactionClient, documentId: number): Promise<number> {
    const updated = await tx.document.update({
        where: { id: documentId },
        data: { version: { increment: 1 } },
        select: { version: true },
    });
    return updated.version;
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

        // 2. เช็คว่าเป็น Admin
        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, message: "Forbidden: Admin only" },
                { status: 403 }
            );
        }

        // 3. รับ Input
        const body = await req.json();
        const { pickTaskId, newBarcode } = body;

        if (!pickTaskId || !newBarcode) {
            return NextResponse.json(
                { success: false, message: "กรุณาระบุ pickTaskId และ newBarcode" },
                { status: 400 }
            );
        }

        // 4. ดึงข้อมูล PickAssetTask
        const pickTask = await prisma.pickAssetTask.findUnique({
            where: { id: Number(pickTaskId) },
            include: {
                document: true,
            },
        });

        if (!pickTask) {
            return NextResponse.json(
                { success: false, message: "ไม่พบ PickAssetTask" },
                { status: 404 }
            );
        }

        if (pickTask.status !== "completed" && pickTask.status !== "picking" && pickTask.status !== "pending") {
            return NextResponse.json(
                { success: false, message: "สามารถแก้ไขได้เฉพาะรายการที่ pending, picking หรือ completed เท่านั้น" },
                { status: 400 }
            );
        }

        const oldBarcode = pickTask.barcode;

        if (pickTask.status !== "pending") {
            if (!oldBarcode) {
                return NextResponse.json(
                    { success: false, message: "ไม่พบ Barcode เดิมใน PickAssetTask" },
                    { status: 400 }
                );
            }

            if (oldBarcode === newBarcode) {
                return NextResponse.json(
                    { success: false, message: "Barcode ใหม่ต้องไม่เหมือนกับ Barcode เดิม" },
                    { status: 400 }
                );
            }
        }

        // Branch: pending → assign barcode ครั้งแรก (ไม่มี barcode เดิม)
        if (pickTask.status === "pending") {
            const isControlbox = pickTask.assetName.includes("CONTROLBOX");

            if (isControlbox) {
                const latest = await prisma.securitySetTransaction.findFirst({
                    where: { barcode: newBarcode },
                    orderBy: { id: "desc" },
                    select: { balance: true, warehouseIn: true, assetName: true },
                });
                if (!latest) {
                    return NextResponse.json({ success: false, message: "ไม่พบ Security Barcode ใหม่" }, { status: 400 });
                }
                if (latest.balance !== 1) {
                    return NextResponse.json({ success: false, message: "Barcode ใหม่ไม่พร้อมใช้งาน" }, { status: 400 });
                }
                if (latest.warehouseIn !== pickTask.warehouse) {
                    return NextResponse.json({ success: false, message: `Barcode ไม่ได้อยู่ในโกดัง ${pickTask.warehouse}` }, { status: 400 });
                }
                if (latest.assetName !== pickTask.assetName) {
                    return NextResponse.json({ success: false, message: "Barcode ไม่ตรงประเภท Security" }, { status: 400 });
                }
            } else {
                const latest = await prisma.assetTransactionHistory.findFirst({
                    where: { barcode: newBarcode },
                    orderBy: { id: "desc" },
                    select: { balance: true, warehouseIn: true, assetName: true },
                });
                if (!latest) {
                    return NextResponse.json({ success: false, message: "ไม่พบ Barcode ใหม่ในระบบ" }, { status: 400 });
                }
                if (latest.balance !== 1) {
                    return NextResponse.json({ success: false, message: "Barcode ใหม่ไม่พร้อมใช้งาน (ออกไปแล้ว)" }, { status: 400 });
                }
                if (latest.warehouseIn !== pickTask.warehouse) {
                    return NextResponse.json({ success: false, message: `Barcode ไม่ได้อยู่ในโกดัง ${pickTask.warehouse}` }, { status: 400 });
                }
                if (latest.assetName !== pickTask.assetName) {
                    return NextResponse.json({ success: false, message: `Barcode เป็นของ ${latest.assetName} ไม่ตรงกับ ${pickTask.assetName}` }, { status: 400 });
                }
            }

            const conflict = await prisma.pickAssetTask.findFirst({
                where: {
                    barcode: newBarcode,
                    status: { notIn: ["completed", "cancelled"] },
                    id: { not: Number(pickTaskId) },
                },
                select: { id: true },
            });
            if (conflict) {
                return NextResponse.json({ success: false, message: "Barcode ถูกใช้งานอยู่ใน task อื่น" }, { status: 400 });
            }

            await prisma.pickAssetTask.update({
                where: { id: Number(pickTaskId) },
                data: { barcode: newBarcode, status: "picking" },
            });

            return NextResponse.json({
                success: true,
                message: `กำหนด Barcode สำเร็จ: ${newBarcode}`,
                oldBarcode: null,
                newBarcode,
            });
        }

        const isControlbox = pickTask.assetName.includes("CONTROLBOX");

        // ✅ Branch: status === "picking" → ยังไม่มี OUT transaction (admin assign แล้ว picker ยังไม่ confirm)
        //          แค่ตรวจ barcode ใหม่ + update task.barcode
        if (pickTask.status === "picking") {
            // เช็ค barcode ใหม่ balance=1 + warehouse + assetName ตรง
            if (isControlbox) {
                const latest = await prisma.securitySetTransaction.findFirst({
                    where: { barcode: newBarcode },
                    orderBy: { id: "desc" },
                    select: { balance: true, warehouseIn: true, assetName: true },
                });
                if (!latest) {
                    return NextResponse.json({ success: false, message: "ไม่พบ Security Barcode ใหม่" }, { status: 400 });
                }
                if (latest.balance !== 1) {
                    return NextResponse.json({ success: false, message: "Barcode ใหม่ไม่พร้อมใช้งาน" }, { status: 400 });
                }
                if (latest.warehouseIn !== pickTask.warehouse) {
                    return NextResponse.json({ success: false, message: `Barcode ไม่ได้อยู่ในโกดัง ${pickTask.warehouse}` }, { status: 400 });
                }
                if (latest.assetName !== pickTask.assetName) {
                    return NextResponse.json({ success: false, message: "Barcode ไม่ตรงประเภท Security" }, { status: 400 });
                }
            } else {
                const latest = await prisma.assetTransactionHistory.findFirst({
                    where: { barcode: newBarcode },
                    orderBy: { id: "desc" },
                    select: { balance: true, warehouseIn: true, assetName: true },
                });
                if (!latest) {
                    return NextResponse.json({ success: false, message: "ไม่พบ Barcode ใหม่ในระบบ" }, { status: 400 });
                }
                if (latest.balance !== 1) {
                    return NextResponse.json({ success: false, message: "Barcode ใหม่ไม่พร้อมใช้งาน (ออกไปแล้ว)" }, { status: 400 });
                }
                if (latest.warehouseIn !== pickTask.warehouse) {
                    return NextResponse.json({ success: false, message: `Barcode ไม่ได้อยู่ในโกดัง ${pickTask.warehouse}` }, { status: 400 });
                }
                if (latest.assetName !== pickTask.assetName) {
                    return NextResponse.json({ success: false, message: `Barcode เป็นของ ${latest.assetName} ไม่ตรงกับ ${pickTask.assetName}` }, { status: 400 });
                }
            }

            // เช็คว่าไม่ถูก assign ค้างใน PickAssetTask อื่น
            const conflict = await prisma.pickAssetTask.findFirst({
                where: {
                    barcode: newBarcode,
                    status: { notIn: ["completed", "cancelled"] },
                    id: { not: Number(pickTaskId) },
                },
                select: { id: true },
            });
            if (conflict) {
                return NextResponse.json({ success: false, message: "Barcode ถูกใช้งานอยู่ใน task อื่น" }, { status: 400 });
            }

            const docVersion = await prisma.$transaction(async (tx) => {
                await tx.pickAssetTask.update({
                    where: { id: Number(pickTaskId) },
                    data: { barcode: newBarcode },
                });
                return bumpDocumentVersion(tx, pickTask.documentId);
            });

            return NextResponse.json({
                success: true,
                message: `แก้ไข Barcode สำเร็จ: ${oldBarcode} → ${newBarcode} (เอกสาร Ver.${docVersion})`,
                oldBarcode,
                newBarcode,
                documentVersion: docVersion,
            });
        }

        // จากนี้ไปเป็น status === "completed" → ต้องมี Barcode เดิมเสมอ
        if (!oldBarcode) {
            return NextResponse.json(
                { success: false, message: "ไม่พบ Barcode เดิมใน PickAssetTask" },
                { status: 400 }
            );
        }

        // ✅ Branch: status === "completed" + CONTROLBOX → ใช้ SecuritySetTransaction
        //          ย้ายขา OUT จาก Barcode เดิม (คืนเข้าสต็อก) ไปยัง Barcode ใหม่
        if (isControlbox) {
            const oldBarcodeRows = await prisma.securitySetTransaction.findMany({
                where: { barcode: oldBarcode },
                orderBy: { id: "desc" },
            });

            // แถวขา OUT ที่สร้างตอน Pick Complete ของเอกสารนี้
            const oldOutRow = oldBarcodeRows.find(
                (t) => t.documentId === pickTask.documentId && t.balance === 0 && t.outDate !== null
            );
            if (!oldOutRow) {
                return NextResponse.json(
                    { success: false, message: "ไม่พบ Transaction ขาออกของ Security Barcode เดิม" },
                    { status: 400 }
                );
            }
            if (oldBarcodeRows[0].id !== oldOutRow.id) {
                return NextResponse.json(
                    { success: false, message: "ไม่สามารถแก้ไขได้ เนื่องจาก Barcode เดิมมีการเคลื่อนไหวใหม่แล้ว" },
                    { status: 400 }
                );
            }

            // เช็ค Barcode ใหม่: balance=1 + โกดังเดียวกัน + รุ่นเดียวกัน
            const newRow = await prisma.securitySetTransaction.findFirst({
                where: { barcode: newBarcode },
                orderBy: { id: "desc" },
            });
            if (!newRow) {
                return NextResponse.json({ success: false, message: "ไม่พบ Security Barcode ใหม่" }, { status: 400 });
            }
            if (newRow.balance !== 1) {
                return NextResponse.json({ success: false, message: "Barcode ใหม่ไม่พร้อมใช้งาน (ถูกเบิกไปแล้ว)" }, { status: 400 });
            }
            if (newRow.warehouseIn !== pickTask.warehouse) {
                return NextResponse.json({ success: false, message: `Barcode ไม่ได้อยู่ในโกดัง ${pickTask.warehouse}` }, { status: 400 });
            }
            if (newRow.assetName !== pickTask.assetName) {
                return NextResponse.json({ success: false, message: `Barcode เป็นของ ${newRow.assetName} ไม่ตรงกับ ${pickTask.assetName}` }, { status: 400 });
            }

            // เช็คว่า Barcode ใหม่ไม่ถูกจองค้างใน PickAssetTask อื่น
            const conflict = await prisma.pickAssetTask.findFirst({
                where: {
                    barcode: newBarcode,
                    status: { notIn: ["completed", "cancelled"] },
                    id: { not: Number(pickTaskId) },
                },
                select: { id: true },
            });
            if (conflict) {
                return NextResponse.json({ success: false, message: "Barcode ถูกใช้งานอยู่ใน task อื่น" }, { status: 400 });
            }

            // คอลัมน์ WK ที่ขา OUT ของเอกสารนี้เขียนไว้ (ตาม documentType / otherActivity เหมือนตอน Complete)
            const wkColumns = getWkOutColumnsWritten(
                pickTask.document.documentType,
                pickTask.document.otherActivity
            );
            const wkMove: Record<string, string | null> = {};
            const wkClear: Record<string, null> = {};
            for (const col of wkColumns) {
                wkMove[col] = oldOutRow[col] ?? null;
                wkClear[col] = null;
            }

            let docVersion = 1;
            await prisma.$transaction(async (tx) => {
                // ล็อกด้วยเงื่อนไข: Barcode ใหม่ต้องยัง balance=1 ณ ตอนเขียน (กันชนกับการ Pick พร้อมกัน)
                const claimed = await tx.securitySetTransaction.updateMany({
                    where: { id: newRow.id, balance: 1 },
                    data: {
                        documentId: pickTask.documentId,
                        outDate: oldOutRow.outDate,
                        unitOut: oldOutRow.unitOut,
                        toVendor: oldOutRow.toVendor,
                        status: oldOutRow.status,
                        mcsCodeOut: oldOutRow.mcsCodeOut,
                        toShop: oldOutRow.toShop,
                        remarkOut: oldOutRow.remarkOut,
                        balance: 0,
                        ...wkMove,
                    },
                });
                if (claimed.count !== 1) {
                    throw new Error("NEW_BARCODE_TAKEN");
                }

                // คืน Barcode เดิมเข้าสต็อก (documentId = null เหมือนตอนลบเอกสาร)
                const released = await tx.securitySetTransaction.updateMany({
                    where: { id: oldOutRow.id, balance: 0 },
                    data: {
                        documentId: null,
                        outDate: null,
                        unitOut: null,
                        toVendor: null,
                        status: null,
                        mcsCodeOut: null,
                        toShop: null,
                        remarkOut: null,
                        balance: 1,
                        ...wkClear,
                    },
                });
                if (released.count !== 1) {
                    throw new Error("OLD_BARCODE_CHANGED");
                }

                await tx.pickAssetTask.update({
                    where: { id: Number(pickTaskId) },
                    data: { barcode: newBarcode },
                });

                docVersion = await bumpDocumentVersion(tx, pickTask.documentId);
            });

            const { userId, username, userRole } = getSessionUser(session);
            await writeAuditLog({
                userId,
                username,
                userRole,
                action: AuditAction.PICK_TASK_BARCODE_UPDATE,
                entity: "PickAssetTask",
                entityId: String(pickTaskId),
                detail: {
                    type: "security",
                    documentId: pickTask.documentId,
                    docCode: pickTask.document.docCode,
                    assetName: pickTask.assetName,
                    oldBarcode,
                    newBarcode,
                    taskStatus: pickTask.status,
                    documentVersion: docVersion,
                },
                req,
            });

            return NextResponse.json({
                success: true,
                message: `แก้ไข Barcode สำเร็จ: ${oldBarcode} → ${newBarcode} (เอกสาร Ver.${docVersion})`,
                oldBarcode,
                newBarcode,
                documentVersion: docVersion,
            });
        }

        // ✅ Branch: status === "completed" + Asset ปกติ → ใช้ AssetTransactionHistory
        //          ย้ายขา OUT จาก Barcode เดิม (คืนเข้าสต็อก) ไปยัง Barcode ใหม่
        // 5. หาแถวขา OUT ของ Barcode เดิม
        const oldBarcodeTransactions = await prisma.assetTransactionHistory.findMany({
            where: { barcode: oldBarcode },
            orderBy: { id: "desc" },
        });

        if (oldBarcodeTransactions.length === 0) {
            return NextResponse.json(
                { success: false, message: "ไม่พบ Transaction ของ Barcode เดิม" },
                { status: 400 }
            );
        }

        // แถวที่สร้างตอน Pick Complete ของเอกสารนี้ (ไม่อิง wkOut เพราะ transfer/borrow/otherActivity เขียน WK คอลัมน์อื่น)
        const oldOutTransaction = oldBarcodeTransactions.find(
            (t) => t.documentId === pickTask.documentId && t.balance === 0 && t.outDate !== null
        );

        if (!oldOutTransaction) {
            return NextResponse.json(
                { success: false, message: "ไม่พบ Transaction ขาออกของ Barcode เดิม" },
                { status: 400 }
            );
        }

        // เช็คว่า Transaction ล่าสุดเป็นของ Document เดียวกันหรือไม่
        if (oldBarcodeTransactions[0].id !== oldOutTransaction.id) {
            return NextResponse.json(
                { success: false, message: "ไม่สามารถแก้ไขได้ เนื่องจาก Barcode เดิมมีการเคลื่อนไหวใหม่แล้ว" },
                { status: 400 }
            );
        }

        // 6. เช็ค Barcode ใหม่: balance=1 + โกดังเดียวกัน + Asset Name เดียวกัน
        const newBarcodeTransaction = await prisma.assetTransactionHistory.findFirst({
            where: { barcode: newBarcode },
            orderBy: { id: "desc" },
        });

        if (!newBarcodeTransaction) {
            return NextResponse.json(
                { success: false, message: "ไม่พบ Barcode ใหม่ในระบบ" },
                { status: 400 }
            );
        }
        if (newBarcodeTransaction.balance !== 1) {
            return NextResponse.json(
                { success: false, message: "Barcode ใหม่ไม่พร้อมใช้งาน (ถูกเบิกไปแล้ว)" },
                { status: 400 }
            );
        }
        if (newBarcodeTransaction.warehouseIn !== pickTask.warehouse) {
            return NextResponse.json({ success: false, message: `Barcode ไม่ได้อยู่ในโกดัง ${pickTask.warehouse}` }, { status: 400 });
        }
        if (newBarcodeTransaction.assetName !== pickTask.assetName) {
            return NextResponse.json({ success: false, message: `Barcode เป็นของ ${newBarcodeTransaction.assetName} ไม่ตรงกับ ${pickTask.assetName}` }, { status: 400 });
        }

        // เช็คว่า Barcode ใหม่ไม่ถูกจองค้างใน PickAssetTask อื่น
        const assetConflict = await prisma.pickAssetTask.findFirst({
            where: {
                barcode: newBarcode,
                status: { notIn: ["completed", "cancelled"] },
                id: { not: Number(pickTaskId) },
            },
            select: { id: true },
        });
        if (assetConflict) {
            return NextResponse.json({ success: false, message: "Barcode ถูกใช้งานอยู่ใน task อื่น" }, { status: 400 });
        }

        // เอกสาร transfer: ถ้าโกดังปลายทางรับ/ปฏิเสธไปแล้ว ห้ามแก้ (ขา IN ปลายทางผูกกับ Barcode เดิมแล้ว)
        const transferTask = await prisma.transferReceiveTask.findFirst({
            where: { pickAssetTaskId: Number(pickTaskId) },
            select: { id: true, status: true },
        });
        if (transferTask && transferTask.status !== "pending") {
            return NextResponse.json(
                { success: false, message: "ไม่สามารถแก้ไขได้ เนื่องจากโกดังปลายทางรับ/ปฏิเสธของรายการนี้ไปแล้ว" },
                { status: 400 }
            );
        }

        // ✅ Status เดิมของ Barcode เก่า (ตอนเบิกออกถูกเขียนทับเป็น "-")
        const oldOriginalStatus = await resolveOriginalAssetStatus(oldOutTransaction.barcode, oldOutTransaction.id);

        // คอลัมน์ WK ที่ขา OUT ของเอกสารนี้เขียนไว้ (ตาม documentType / otherActivity เหมือนตอน Complete)
        const assetWkColumns = getWkOutColumnsWritten(
            pickTask.document.documentType,
            pickTask.document.otherActivity
        );
        const assetWkMove: Record<string, string | null> = {};
        const assetWkClear: Record<string, null> = {};
        for (const col of assetWkColumns) {
            assetWkMove[col] = oldOutTransaction[col] ?? null;
            assetWkClear[col] = null;
        }

        // Lightbox / ACC WALL custom size (W*D*H) — ตอน Complete เขียนลง Asset table ของ Barcode ที่ Pick
        const assetNameKey = pickTask.assetName.toLowerCase().replace(/\s+/g, "");
        const hasCustomSize =
            (assetNameKey.includes("lightbox") || assetNameKey.includes("accwall")) &&
            !!pickTask.size && pickTask.size.includes("*");

        // 7. ดำเนินการแก้ไข (ใช้ Transaction)
        let docVersion = 1;
        await prisma.$transaction(async (tx) => {
            // 7.1 บันทึกขา OUT ให้ Barcode ใหม่ (เงื่อนไข balance=1 กันชนกับการ Pick พร้อมกัน)
            const claimed = await tx.assetTransactionHistory.updateMany({
                where: { id: newBarcodeTransaction.id, balance: 1 },
                data: {
                    documentId: pickTask.documentId,
                    outDate: oldOutTransaction.outDate,
                    unitOut: oldOutTransaction.unitOut,
                    toVendor: oldOutTransaction.toVendor,
                    mcsCodeOut: oldOutTransaction.mcsCodeOut,
                    toShop: oldOutTransaction.toShop,
                    remarkOut: oldOutTransaction.remarkOut,
                    shopType: oldOutTransaction.shopType,
                    status: oldOutTransaction.status,
                    balance: 0,
                    assetStatus: "-",
                    ...(pickTask.grade ? { grade: pickTask.grade } : {}),
                    ...assetWkMove,
                },
            });
            if (claimed.count !== 1) {
                throw new Error("NEW_BARCODE_TAKEN");
            }

            // 7.2 ล้างขา OUT ของ Barcode เดิม (กลับเข้าสต็อก, documentId = null เหมือนตอนลบเอกสาร)
            const released = await tx.assetTransactionHistory.updateMany({
                where: { id: oldOutTransaction.id, balance: 0 },
                data: {
                    documentId: null,
                    outDate: null,
                    unitOut: null,
                    toVendor: null,
                    mcsCodeOut: null,
                    toShop: null,
                    remarkOut: null,
                    shopType: null,
                    status: null,
                    balance: 1,
                    ...assetWkClear,
                    // คืน Status เดิม (ถ้าหาไม่ได้ คงค่าเดิมไว้)
                    ...(oldOriginalStatus ? { assetStatus: oldOriginalStatus } : {}),
                },
            });
            if (released.count !== 1) {
                throw new Error("OLD_BARCODE_CHANGED");
            }

            // 7.3 อัปเดต PickAssetTask
            await tx.pickAssetTask.update({
                where: { id: Number(pickTaskId) },
                data: { barcode: newBarcode },
            });

            docVersion = await bumpDocumentVersion(tx, pickTask.documentId);

            // 7.4 Transfer: ให้โกดังปลายทางรอรับ Barcode ใหม่
            if (transferTask) {
                await tx.transferReceiveTask.update({
                    where: { id: transferTask.id },
                    data: { barcode: newBarcode },
                });
            }

            // 7.5 Lightbox / ACC WALL: ย้าย custom size ไปที่ Barcode ใหม่
            if (hasCustomSize) {
                await tx.asset.updateMany({
                    where: { barcode: newBarcode },
                    data: { size: pickTask.size },
                });
            }
        });

        const auditUser = getSessionUser(session);
        await writeAuditLog({
            ...auditUser,
            action: AuditAction.PICK_TASK_BARCODE_UPDATE,
            entity: "PickAssetTask",
            entityId: String(pickTaskId),
            detail: {
                type: "asset",
                documentId: pickTask.documentId,
                docCode: pickTask.document.docCode,
                assetName: pickTask.assetName,
                oldBarcode,
                newBarcode,
                taskStatus: pickTask.status,
                documentVersion: docVersion,
                transferReceiveTaskId: transferTask?.id ?? null,
            },
            req,
        });

        return NextResponse.json({
            success: true,
            message: `แก้ไข Barcode สำเร็จ: ${oldBarcode} → ${newBarcode} (เอกสาร Ver.${docVersion})`,
            oldBarcode,
            newBarcode,
            documentVersion: docVersion,
        });

    } catch (error) {
        if (error instanceof Error && (error.message === "NEW_BARCODE_TAKEN" || error.message === "OLD_BARCODE_CHANGED")) {
            return NextResponse.json(
                { success: false, message: "ข้อมูล Barcode มีการเปลี่ยนแปลงระหว่างทำรายการ กรุณาลองใหม่" },
                { status: 409 }
            );
        }
        console.error("[EDIT_BARCODE_ERROR]", error);
        return NextResponse.json(
            { success: false, message: "เกิดข้อผิดพลาดในการแก้ไข Barcode" },
            { status: 500 }
        );
    }
}