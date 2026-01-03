// src/app/api/repair-asset/all-tasks/route.ts
// API สำหรับ Admin ดูรายการ Repair Asset ทั้งหมด

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        // ตรวจสอบว่าเป็น Admin
        if (!session?.user || session.user.role?.toUpperCase() !== "ADMIN") {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get("status") || "all";

        // สร้าง where clause
        const where: any = {};
        if (status !== "all") {
            where.status = status;
        }

        // ดึงข้อมูลทั้งหมด (ไม่กรองตาม warehouse)
        const tasks = await prisma.repairTask.findMany({
            where,
            select: {
                id: true,
                documentId: true,
                barcode: true,
                assetName: true,
                size: true,
                grade: true,
                repairWarehouse: true,
                status: true,
                repairStartDate: true,
                repairEndDate: true,
                createdAt: true,
                completedAt: true,
                document: {
                    select: {
                        docCode: true,
                        fullName: true,
                        company: true,
                        phone: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Map data
        const mappedTasks = tasks.map((task) => ({
            id: task.id,
            documentId: task.documentId,
            docCode: task.document?.docCode || "",
            barcode: task.barcode,
            assetName: task.assetName,
            size: task.size,
            grade: task.grade,
            repairWarehouse: task.repairWarehouse,
            reporterName: task.document?.fullName || null,
            reporterCompany: task.document?.company || null,
            reporterPhone: task.document?.phone || null,
            status: task.status,
            repairStartDate: task.repairStartDate?.toISOString() || null,
            repairEndDate: task.repairEndDate?.toISOString() || null,
            createdAt: task.createdAt.toISOString(),
            completedAt: task.completedAt?.toISOString() || null,
        }));

        return NextResponse.json({
            success: true,
            tasks: mappedTasks,
        });
    } catch (error) {
        console.error("Error fetching all repair tasks:", error);
        return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
    }
}