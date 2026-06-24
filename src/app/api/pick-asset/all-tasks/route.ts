// src/app/api/pick-asset/all-tasks/route.ts
// API สำหรับ Admin ดูรายการ Pick Asset ทั้งหมด (ทุกรายการ ทุกสถานะ)
// ✅ ดึงจาก PickAssetTask โดยตรง เหมือน User

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
        const limit = parseInt(searchParams.get("limit") || "10");
        const statusFilter = searchParams.get("status"); // pending, picking, completed, all
        const searchQuery = searchParams.get("search") || ""; // ค้นหา docCode, shopCode, shopName

        // ✅ ดึง PickAssetTask ทั้งหมดจาก Database โดยตรง
        const allPickTasks = await prisma.pickAssetTask.findMany({
            include: {
                document: {
                    select: {
                        docCode: true,
                        documentType: true,
                        fullName: true,
                        company: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // ✅ Group by documentId + shopCode (แยกแต่ละ shop)
        const groupedTasks: Record<string, any> = {};

        for (const task of allPickTasks) {
            const key = `${task.documentId}-${task.shopCode || "no-shop"}`;

            if (!groupedTasks[key]) {
                groupedTasks[key] = {
                    documentId: task.documentId,
                    docCode: task.document?.docCode || "",
                    documentType: task.document?.documentType || "",
                    warehouse: task.warehouse || "",
                    shopCode: task.shopCode || "",
                    shopName: task.shopName || "",
                    createdAt: task.document?.createdAt?.toISOString() || task.createdAt.toISOString(),
                    assignedUser: task.document?.fullName || "-",
                    company: task.document?.company || "",
                    totalItems: 0,
                    completedItems: 0,
                    pendingItems: 0,
                    cancelledItems: 0,
                    status: "pending",
                    tasks: [],
                };
            }

            groupedTasks[key].totalItems++;
            groupedTasks[key].tasks.push({
                id: task.id,
                status: task.status,
                assetName: task.assetName,
            });

            if (task.status === "completed") {
                groupedTasks[key].completedItems++;
            } else if (task.status === "cancelled") {
                groupedTasks[key].cancelledItems++;
            } else {
                groupedTasks[key].pendingItems++;
            }
        }

        // ✅ คำนวณ status ของแต่ละ group
        let allTasks = Object.values(groupedTasks).map((group: any) => {
            const handledItems = group.completedItems + group.cancelledItems;

            if (handledItems === group.totalItems && group.totalItems > 0) {
                group.status = "completed";
            } else if (handledItems > 0) {
                group.status = "picking";
            } else {
                group.status = "pending";
            }

            // เพิ่ม pickedItems สำหรับ compatibility
            group.pickedItems = group.completedItems;

            return group;
        });

        // ✅ Filter by status (ถ้ามี)
        if (statusFilter && statusFilter !== "all") {
            allTasks = allTasks.filter((task: any) => task.status === statusFilter);
        }

        // ✅ Filter by search query (ถ้ามี)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            allTasks = allTasks.filter((task: any) =>
                task.docCode?.toLowerCase().includes(query) ||
                task.shopCode?.toLowerCase().includes(query) ||
                task.shopName?.toLowerCase().includes(query) ||
                task.warehouse?.toLowerCase().includes(query) ||
                task.assignedUser?.toLowerCase().includes(query)
            );
        }

        // ✅ เรียงตามวันที่สร้าง (ล่าสุดก่อน)
        allTasks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // ✅ Pagination
        const total = allTasks.length;
        const totalPages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;
        const tasks = allTasks.slice(skip, skip + limit);

        // ✅ สรุปสถิติ
        const stats = {
            total: Object.keys(groupedTasks).length,
            pending: Object.values(groupedTasks).filter((t: any) => t.status === "pending").length,
            picking: Object.values(groupedTasks).filter((t: any) => t.status === "picking").length,
            completed: Object.values(groupedTasks).filter((t: any) => t.status === "completed").length,
        };

        return NextResponse.json({
            success: true,
            tasks,
            totalPages,
            currentPage: page,
            totalTasks: total,
            stats,
        });
    } catch (error) {
        console.error("Error fetching all pick tasks:", error);
        return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
    }
}