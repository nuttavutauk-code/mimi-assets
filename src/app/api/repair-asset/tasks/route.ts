// app/api/repair-asset/tasks/route.ts
// API สำหรับดึงรายการ Repair Tasks ตาม Warehouse ของ User

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        // 1. เช็ค Authentication
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2. ดึงข้อมูล User เพื่อเอา Vendor (Warehouse)
        const user = await prisma.user.findUnique({
            where: { id: parseInt(session.user.id) },
            select: { vendor: true },
        });

        if (!user?.vendor) {
            return NextResponse.json({
                success: true,
                tasks: [],
                message: "User ไม่มี Vendor กำหนด",
            });
        }

        // 3. รับ query parameters
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status"); // pending, repairing, completed, all

        // 4. สร้าง where clause
        const where: any = {
            repairWarehouse: user.vendor,
        };

        if (status && status !== "all") {
            where.status = status;
        }

        // 5. ดึงข้อมูล Repair Tasks
        const tasks = await prisma.repairTask.findMany({
            where,
            include: {
                document: {
                    select: {
                        docCode: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({
            success: true,
            tasks: tasks.map((task) => ({
                id: task.id,
                documentId: task.documentId,
                docCode: task.document.docCode,
                barcode: task.barcode,
                assetName: task.assetName,
                size: task.size,
                grade: task.grade,
                repairWarehouse: task.repairWarehouse,
                reporterName: task.reporterName,
                reporterCompany: task.reporterCompany,
                reporterPhone: task.reporterPhone,
                status: task.status,
                repairStartDate: task.repairStartDate,
                repairEndDate: task.repairEndDate,
                createdAt: task.createdAt,
                completedAt: task.completedAt,
            })),
            warehouse: user.vendor,
        });
    } catch (error) {
        console.error("Error fetching repair tasks:", error);
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