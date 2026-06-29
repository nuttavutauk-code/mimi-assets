// app/api/pick-asset/edit-barcode/route.ts
// API สำหรับ Admin แก้ไข Barcode หลัง Pick Complete

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ✅ ฟังก์ชันคำนวณ Week Number
function getWeekNumber(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()} WK ${weekNo.toString().padStart(2, "0")}`;
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

            await prisma.pickAssetTask.update({
                where: { id: Number(pickTaskId) },
                data: { barcode: newBarcode },
            });

            return NextResponse.json({
                success: true,
                message: `แก้ไข Barcode สำเร็จ: ${oldBarcode} → ${newBarcode}`,
                oldBarcode,
                newBarcode,
            });
        }

        // 5. เช็คว่า Barcode เก่ามี Transaction ใหม่หรือยัง
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

        // หา Transaction ที่สร้างตอน Pick (มี documentId ตรงกัน และมีข้อมูลขาออก)
        const oldOutTransaction = oldBarcodeTransactions.find(
            (t) => t.documentId === pickTask.documentId && t.wkOut !== null
        );

        if (!oldOutTransaction) {
            return NextResponse.json(
                { success: false, message: "ไม่พบ Transaction ขาออกของ Barcode เดิม" },
                { status: 400 }
            );
        }

        // เช็คว่า Transaction ล่าสุดเป็นของ Document เดียวกันหรือไม่
        const latestTransaction = oldBarcodeTransactions[0];
        if (latestTransaction.id !== oldOutTransaction.id) {
            return NextResponse.json(
                { success: false, message: "ไม่สามารถแก้ไขได้ เนื่องจาก Barcode เดิมมีการเคลื่อนไหวใหม่แล้ว" },
                { status: 400 }
            );
        }

        // 6. เช็คว่า Barcode ใหม่พร้อมใช้ (balance = 1)
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

        // 7. ดำเนินการแก้ไข (ใช้ Transaction)
        await prisma.$transaction(async (tx) => {
            // 7.1 อัปเดต PickAssetTask
            await tx.pickAssetTask.update({
                where: { id: Number(pickTaskId) },
                data: { barcode: newBarcode },
            });

            // 7.2 เก็บข้อมูลขาออกจาก Barcode เก่า
            const outData = {
                wkOut: oldOutTransaction.wkOut,
                outDate: oldOutTransaction.outDate,
                unitOut: oldOutTransaction.unitOut,
                toVendor: oldOutTransaction.toVendor,
                mcsCodeOut: oldOutTransaction.mcsCodeOut,
                toShop: oldOutTransaction.toShop,
                remarkOut: oldOutTransaction.remarkOut,
                shopType: oldOutTransaction.shopType,
                status: oldOutTransaction.status,
            };

            // 7.3 ล้างข้อมูลขาออกของ Barcode เก่า (กลับเข้าสต็อก)
            await tx.assetTransactionHistory.update({
                where: { id: oldOutTransaction.id },
                data: {
                    wkOut: null,
                    outDate: null,
                    unitOut: null,
                    toVendor: null,
                    mcsCodeOut: null,
                    toShop: null,
                    remarkOut: null,
                    shopType: null,
                    status: null,
                    balance: 1,
                },
            });

            // 7.4 บันทึกข้อมูลขาออกให้ Barcode ใหม่
            await tx.assetTransactionHistory.update({
                where: { id: newBarcodeTransaction.id },
                data: {
                    documentId: pickTask.documentId,
                    wkOut: outData.wkOut,
                    outDate: outData.outDate,
                    unitOut: outData.unitOut,
                    toVendor: outData.toVendor,
                    mcsCodeOut: outData.mcsCodeOut,
                    toShop: outData.toShop,
                    remarkOut: outData.remarkOut,
                    shopType: outData.shopType,
                    status: outData.status,
                    balance: 0,
                },
            });
        });

        return NextResponse.json({
            success: true,
            message: `แก้ไข Barcode สำเร็จ: ${oldBarcode} → ${newBarcode}`,
            oldBarcode,
            newBarcode,
        });

    } catch (error) {
        console.error("[EDIT_BARCODE_ERROR]", error);
        return NextResponse.json(
            { success: false, message: "เกิดข้อผิดพลาดในการแก้ไข Barcode" },
            { status: 500 }
        );
    }
}