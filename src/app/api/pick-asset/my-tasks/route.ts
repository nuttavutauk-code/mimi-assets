// app/api/pick-asset/my-tasks/route.ts
// API สำหรับ Picker ดูรายการ Tasks ของตัวเอง (filter ตาม vendor)
// ✅ แก้ไข Pagination ให้ถูกต้อง - Group ก่อนแล้วค่อย Paginate

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

        // 2. ดึง vendor ของ User
        const userId = parseInt((session.user as any).id || (session.user as any).sub || "0");

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { vendor: true, company: true },
        });

        if (!user || !user.vendor) {
            return NextResponse.json(
                { success: false, message: "User vendor not found" },
                { status: 400 }
            );
        }

        // 3. รับ query parameters
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const statusFilter = searchParams.get("status"); // pending, picking, completed
        const searchQuery = searchParams.get("search") || "";

        // 4. สร้าง where clause - รองรับทั้ง vendor code และชื่อเต็ม
        const where: any = {
            OR: [
                { warehouse: user.vendor },
                { warehouse: { contains: user.vendor, mode: "insensitive" } },
                { warehouse: user.company },
                { warehouse: { contains: user.company || "", mode: "insensitive" } },
            ],
        };

        // 5. ✅ ดึง Tasks ทั้งหมดของ User (ไม่ paginate ตรงนี้)
        const allTasks = await prisma.pickAssetTask.findMany({
            where,
            include: {
                document: {
                    select: {
                        docCode: true,
                        documentType: true,
                        fullName: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // 6. ✅ Group tasks by documentId + shopCode ก่อน
        const tasksByDocumentAndShop = allTasks.reduce((acc: any, task) => {
            const key = `${task.documentId}-${task.shopCode || 'no-shop'}`;
            if (!acc[key]) {
                acc[key] = {
                    documentId: task.documentId,
                    docCode: task.document.docCode,
                    warehouse: task.warehouse,
                    shopCode: task.shopCode || "",
                    shopName: task.shopName || "N/A",
                    createdAt: task.createdAt.toISOString(),
                    status: "pending",
                    totalItems: 0,
                    handledItems: 0,
                    tasks: [],
                };
            }
            acc[key].tasks.push(task);
            acc[key].totalItems++;
            if (task.status === "completed" || task.status === "cancelled") {
                acc[key].handledItems++;
            }
            return acc;
        }, {});

        // 7. คำนวณ status ของแต่ละ group
        let groupedTasks = Object.values(tasksByDocumentAndShop).map((doc: any) => {
            const allHandled = doc.handledItems === doc.totalItems;
            const someHandled = doc.handledItems > 0;

            return {
                id: `${doc.documentId}-${doc.shopCode}`,
                documentId: doc.documentId,
                docCode: doc.docCode,
                warehouse: doc.warehouse,
                shopCode: doc.shopCode,
                shopName: doc.shopName,
                createdAt: doc.createdAt,
                status: allHandled ? "completed" : someHandled ? "picking" : "pending",
                totalItems: doc.totalItems,
                pickedItems: doc.handledItems,
            };
        });

        // 8. ✅ Filter by status (ถ้ามี)
        if (statusFilter && statusFilter !== "all") {
            groupedTasks = groupedTasks.filter((task: any) => task.status === statusFilter);
        }

        // 9. ✅ Filter by search query (ถ้ามี)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            groupedTasks = groupedTasks.filter((task: any) =>
                task.docCode?.toLowerCase().includes(query) ||
                task.shopCode?.toLowerCase().includes(query) ||
                task.shopName?.toLowerCase().includes(query) ||
                task.warehouse?.toLowerCase().includes(query)
            );
        }

        // 10. ✅ เรียงลำดับจากล่าสุดไว้บนสุด
        groupedTasks.sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // 11. ✅ Pagination จาก grouped data (ไม่ใช่จาก raw tasks)
        const totalGroups = groupedTasks.length;
        const totalPages = Math.ceil(totalGroups / limit);
        const skip = (page - 1) * limit;
        const paginatedTasks = groupedTasks.slice(skip, skip + limit);

        return NextResponse.json({
            success: true,
            tasks: paginatedTasks,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount: totalGroups,  // ✅ นับจำนวน groups ไม่ใช่ tasks
                limit,
            },
        });
    } catch (error) {
        console.error("❌ Error fetching pick tasks:", error);
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