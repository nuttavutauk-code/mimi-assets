// app/api/pick-asset/my-tasks/route.ts
// API สำหรับ Picker ดูรายการ Tasks ของตัวเอง (filter ตาม vendor)
// ✅ แก้ไขให้รองรับทั้ง vendor code และชื่อเต็ม

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
        const status = searchParams.get("status"); // pending, picking, completed

        // 4. สร้าง where clause - รองรับทั้ง vendor code และชื่อเต็ม
        const where: any = {
            OR: [
                { warehouse: user.vendor }, // ตรงทุกตัวอักษร เช่น "NEWLOOK"
                { warehouse: { contains: user.vendor, mode: "insensitive" } }, // มีคำนี้อยู่ เช่น "บริษัท NEWLOOK จำกัด"
                { warehouse: user.company }, // หรือใช้ชื่อบริษัท
                { warehouse: { contains: user.company || "", mode: "insensitive" } }, // หรือมีชื่อบริษัทอยู่
            ],
        };

        if (status) {
            where.status = status;
        }

        console.log("🔍 Searching with:", {
            vendor: user.vendor,
            company: user.company,
            whereClause: JSON.stringify(where, null, 2)
        });

        // 5. ดึงข้อมูล Tasks
        const [tasks, totalCount] = await Promise.all([
            prisma.pickAssetTask.findMany({
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
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.pickAssetTask.count({ where }),
        ]);

        console.log(`✅ Found ${tasks.length} tasks`);

        // 6. Group tasks by documentId + shopCode (แยกแต่ละ shop)
        const tasksByDocumentAndShop = tasks.reduce((acc: any, task) => {
            const key = `${task.documentId}-${task.shopCode || 'no-shop'}`; // ✅ ใช้ documentId + shopCode เป็น key
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
                    handledItems: 0, // ✅ เปลี่ยนจาก pickedItems เป็น handledItems (รวม completed + cancelled)
                    tasks: [],
                };
            }
            acc[key].tasks.push(task);
            acc[key].totalItems++;
            // ✅ นับทั้ง completed และ cancelled เป็น "จัดการแล้ว"
            if (task.status === "completed" || task.status === "cancelled") {
                acc[key].handledItems++;
            }
            return acc;
        }, {});

        // 7. คำนวณ status ของแต่ละเอกสาร + shop
        const groupedTasks = Object.values(tasksByDocumentAndShop).map((doc: any) => {
            const allHandled = doc.handledItems === doc.totalItems; // ✅ จัดการครบทุกรายการ
            const someHandled = doc.handledItems > 0;

            return {
                id: `${doc.documentId}-${doc.shopCode}`, // ✅ ใช้ composite id
                documentId: doc.documentId,
                docCode: doc.docCode,
                warehouse: doc.warehouse,
                shopCode: doc.shopCode,
                shopName: doc.shopName,
                createdAt: doc.createdAt,
                status: allHandled ? "completed" : someHandled ? "picking" : "pending",
                totalItems: doc.totalItems,
                pickedItems: doc.handledItems, // ✅ แสดงจำนวนที่จัดการแล้ว (completed + cancelled)
            };
        });

        // ✅ เรียงลำดับจากล่าสุดไว้บนสุด
        groupedTasks.sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // 8. คำนวณ pagination
        const totalPages = Math.ceil(totalCount / limit);

        return NextResponse.json({
            success: true,
            tasks: groupedTasks,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
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