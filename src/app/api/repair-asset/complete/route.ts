// app/api/repair-asset/complete/route.ts
// API สำหรับซ่อมเสร็จ (เปลี่ยนสถานะเป็น "completed" และสร้าง Transaction ใหม่)

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

        // 2. รับ body
        const body = await req.json();
        const { taskId, repairEndDate } = body;

        if (!taskId || !repairEndDate) {
            return NextResponse.json(
                { success: false, message: "taskId และ repairEndDate จำเป็นต้องระบุ" },
                { status: 400 }
            );
        }

        // 3. ดึงข้อมูล User (ผู้ทำการซ่อม)
        const repairer = await prisma.user.findUnique({
            where: { id: parseInt(session.user.id) },
            select: { id: true, vendor: true },
        });

        // 4. ตรวจสอบว่า Task มีอยู่จริง
        const task = await prisma.repairTask.findUnique({
            where: { id: taskId },
        });

        if (!task) {
            return NextResponse.json(
                { success: false, message: "ไม่พบรายการซ่อม" },
                { status: 404 }
            );
        }

        // 5. ตรวจสอบสถานะ (ต้องเป็น pending เท่านั้น)
        if (task.status !== "pending") {
            return NextResponse.json(
                { success: false, message: "รายการนี้ไม่ได้อยู่ในสถานะรอดำเนินการ" },
                { status: 400 }
            );
        }

        // 6. ดึงข้อมูล Asset จาก Asset table (ถ้ามี)
        const assetData = await prisma.asset.findUnique({
            where: { barcode: task.barcode },
        });

        const completedDate = new Date(repairEndDate);

        // 7. Transaction: สร้าง Transaction ใหม่ (ขา IN - ซ่อมเสร็จกลับเข้าโกดัง)
        await prisma.assetTransactionHistory.create({
            data: {
                documentId: task.documentId,

                // ===== ข้อมูล Asset =====
                barcode: task.barcode,
                assetName: task.assetName,
                size: task.size,
                grade: task.grade || "A",
                startWarranty: assetData?.startWarranty || null,
                endWarranty: assetData?.endWarranty || null,
                cheilPO: assetData?.cheilPO || null,

                // ===== ขา IN (ซ่อมเสร็จกลับเข้าโกดัง) =====
                // Warehouse: โกดังที่ซ่อม (= Vendor ของผู้ทำการซ่อม)
                warehouseIn: repairer?.vendor || task.repairWarehouse,
                // In Stock Date: วันที่ซ่อมเสร็จ
                inStockDate: completedDate,
                // Unit In: 1
                unitIn: 1,
                // From Vendor: โกดังที่ซ่อม
                fromVendor: task.repairWarehouse,
                // MCS Code (In): "-"
                mcsCodeIn: "-",
                // From Shop: โกดังที่ซ่อม
                fromShop: task.repairWarehouse,
                // Remark IN: "ซ่อมเสร็จ"
                remarkIn: "ซ่อมเสร็จ",

                // ===== Auto by Logic =====
                assetStatus: "REFURBISH", // ✅ ของที่ซ่อมเสร็จแล้ว
                balance: 1, // กลับเข้าโกดังแล้ว (พร้อมใช้งาน)
                transactionCategory: "-",
                // ✅ บันทึก Refurbished Instock (ซ่อมเสร็จกลับเข้าโกดัง)
                refurbishedInStock: getWeekNumber(completedDate),
            },
        });

        // 8. อัปเดตสถานะ RepairTask เป็น "completed"
        await prisma.repairTask.update({
            where: { id: taskId },
            data: {
                status: "completed",
                repairEndDate: completedDate,
                completedAt: new Date(),
                completedBy: repairer?.id,
            },
        });

        return NextResponse.json({
            success: true,
            message: "ซ่อมเสร็จสิ้นสำเร็จ",
        });
    } catch (error) {
        console.error("Error completing repair:", error);
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