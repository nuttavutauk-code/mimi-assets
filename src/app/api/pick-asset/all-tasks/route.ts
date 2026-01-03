// src/app/api/pick-asset/all-tasks/route.ts
// API สำหรับ Admin ดูรายการ Pick Asset ทั้งหมด

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
        const page = parseInt(searchParams.get("page") || "1");
        const limit = 20;
        const skip = (page - 1) * limit;

        // ดึงเอกสารที่มี PickAssetTask (ใช้ pickTasks ตาม schema)
        const documents = await prisma.document.findMany({
            where: {
                pickTasks: {
                    some: {},
                },
            },
            select: {
                id: true,
                docCode: true,
                createdAt: true,
                fullName: true,
                company: true,
                shops: {
                    select: {
                        shopCode: true,
                        shopName: true,
                    },
                    take: 1,
                },
                pickTasks: {
                    select: {
                        id: true,
                        status: true,
                        warehouse: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        });

        const total = await prisma.document.count({
            where: {
                pickTasks: {
                    some: {},
                },
            },
        });

        // Map data
        const tasks = documents.map((doc) => {
            const shop = doc.shops[0];
            const totalItems = doc.pickTasks.length;
            const pickedItems = doc.pickTasks.filter((t) => t.status === "completed").length;
            const warehouse = doc.pickTasks[0]?.warehouse || "";

            let status = "pending";
            if (pickedItems === totalItems && totalItems > 0) {
                status = "completed";
            } else if (pickedItems > 0) {
                status = "picking";
            }

            return {
                id: `${doc.id}-${shop?.shopCode || ""}`,
                documentId: doc.id,
                docCode: doc.docCode,
                warehouse: warehouse,
                shopCode: shop?.shopCode || "",
                shopName: shop?.shopName || "",
                createdAt: doc.createdAt.toISOString(),
                status,
                totalItems,
                pickedItems,
                assignedUser: doc.fullName || "-",
            };
        });

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            success: true,
            tasks,
            totalPages,
            currentPage: page,
        });
    } catch (error) {
        console.error("Error fetching all pick tasks:", error);
        return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
    }
}