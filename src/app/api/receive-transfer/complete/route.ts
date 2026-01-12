// app/api/receive-transfer/complete/route.ts
// API สำหรับบันทึกการรับของโอนย้าย (สร้าง Transaction ขาเข้า)

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

        const userId = parseInt((session.user as any).id || (session.user as any).sub || "0");

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { vendor: true },
        });

        if (!user || !user.vendor) {
            return NextResponse.json(
                { success: false, message: "User vendor not found" },
                { status: 400 }
            );
        }

        // 2. รับข้อมูลจาก body
        const body = await req.json();
        const { documentId, tasks } = body;
        // tasks = [{ id, status, rejectReason, assetImageUrl }]

        if (!documentId || !tasks || !Array.isArray(tasks)) {
            return NextResponse.json(
                { success: false, message: "Document ID and tasks are required" },
                { status: 400 }
            );
        }

        // 3. เช็คว่าทุก task ถูกตัดสินใจแล้ว
        const pendingTasks = tasks.filter((t: any) => t.status === "pending");
        if (pendingTasks.length > 0) {
            return NextResponse.json(
                { success: false, message: `กรุณาตัดสินใจรับของหรือปฏิเสธให้ครบทุกรายการ (เหลือ ${pendingTasks.length} รายการ)` },
                { status: 400 }
            );
        }

        // 4. ดึงข้อมูล Document
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: {
                createdBy: true,
                shops: true,
            },
        });

        if (!document) {
            return NextResponse.json(
                { success: false, message: "Document not found" },
                { status: 404 }
            );
        }

        // 5. อัปเดต Tasks และสร้าง Transaction สำหรับรายการที่รับ
        let receivedCount = 0;
        let rejectedCount = 0;
        let transactionsCreated = 0;

        for (const taskData of tasks) {
            const { id: taskId, status, rejectReason, assetImageUrl } = taskData;

            // อัปเดต Task
            await prisma.transferReceiveTask.update({
                where: { id: taskId },
                data: {
                    status,
                    rejectReason: status === "rejected" ? rejectReason : null,
                    assetImageUrl,
                    receivedAt: status === "received" ? new Date() : null,
                    receivedBy: status === "received" ? userId : null,
                },
            });

            if (status === "received") {
                receivedCount++;

                // ดึงข้อมูล Task
                const task = await prisma.transferReceiveTask.findUnique({
                    where: { id: taskId },
                });

                if (task) {
                    // ดึงข้อมูล Asset จาก Asset table
                    const assetData = await prisma.asset.findUnique({
                        where: { barcode: task.barcode },
                    });

                    // กำหนด Remark
                    let remarkIn = "ย้ายระหว่างโกดัง";
                    if (document.operation) {
                        if (document.operation === "อื่นๆ" && document.otherDetail) {
                            remarkIn = document.otherDetail;
                        } else {
                            remarkIn = document.operation;
                        }
                    }

                    // สร้าง Transaction ขาเข้า
                    await prisma.assetTransactionHistory.create({
                        data: {
                            documentId: document.id,

                            // ===== ข้อมูล Asset =====
                            barcode: task.barcode,
                            assetName: assetData?.assetName || task.assetName,
                            size: assetData?.size || task.size,
                            grade: task.grade || "A",
                            startWarranty: assetData?.startWarranty || null,
                            endWarranty: assetData?.endWarranty || null,
                            cheilPO: assetData?.cheilPO || null,

                            // ===== ขา IN (เข้าโกดังปลายทาง) =====
                            warehouseIn: task.toWarehouse, // โกดังปลายทาง
                            inStockDate: new Date(), // วันที่รับของ
                            unitIn: 1,
                            fromVendor: task.fromWarehouse, // โกดังต้นทาง
                            mcsCodeIn: "-",
                            fromShop: task.fromWarehouse,
                            remarkIn,

                            // ===== Auto by Logic =====
                            assetStatus: "-",
                            balance: 1, // เข้าโกดังปลายทางแล้ว (พร้อมใช้งาน)
                            transactionCategory: "-",
                            wkInForRepair: getWeekNumber(new Date()),
                        },
                    });

                    transactionsCreated++;
                }
            } else if (status === "rejected") {
                rejectedCount++;

                // ดึงข้อมูล Task เพื่อหา Transaction ขาออกและ revert
                const task = await prisma.transferReceiveTask.findUnique({
                    where: { id: taskId },
                });

                if (task) {
                    // หา Transaction ขาออกที่สร้างตอน Picker ต้นทางกดบันทึก
                    // และ revert balance กลับเป็น 1 (ของกลับไปอยู่โกดังต้นทาง)
                    const outTransaction = await prisma.assetTransactionHistory.findFirst({
                        where: {
                            documentId: document.id,
                            barcode: task.barcode,
                            balance: 0,
                        },
                        orderBy: { id: "desc" },
                    });

                    if (outTransaction) {
                        // Revert: เปลี่ยน balance กลับเป็น 1 และลบข้อมูลขาออก
                        await prisma.assetTransactionHistory.update({
                            where: { id: outTransaction.id },
                            data: {
                                balance: 1, // กลับไปอยู่โกดังต้นทาง
                                outDate: null,
                                unitOut: null,
                                toVendor: null,
                                mcsCodeOut: null,
                                toShop: null,
                                remarkOut: `ปฏิเสธ: ${rejectReason || "-"}`,
                                wkOutForRepair: null,
                            },
                        });
                        console.log(`✅ Reverted transaction for barcode: ${task.barcode}`);
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `บันทึกสำเร็จ! รับของ ${receivedCount} รายการ, ปฏิเสธ ${rejectedCount} รายการ`,
            receivedCount,
            rejectedCount,
            transactionsCreated,
        });
    } catch (error) {
        console.error("Error completing receive transfer:", error);
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
