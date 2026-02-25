// src/app/api/pick-asset/all-tasks/route.ts
// API สำหรับ Admin ดูรายการ Pick Asset ทั้งหมด (แสดง 1 รายการต่อ 1 shop)

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

        // ดึงเอกสารที่มี PickAssetTask พร้อมทุก shop
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
                },
                pickTasks: {
                    select: {
                        id: true,
                        status: true,
                        warehouse: true,
                        shopCode: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // ✅ แปลงเป็น 1 รายการต่อ 1 shop
        const allTasks: any[] = [];

        for (const doc of documents) {
            // Group pickTasks by shopCode
            const shopCodes = [...new Set(doc.pickTasks.map(t => t.shopCode).filter(Boolean))];
            
            // ถ้าไม่มี shopCode ใน pickTasks ให้ใช้จาก shops
            if (shopCodes.length === 0 && doc.shops.length > 0) {
                for (const shop of doc.shops) {
                    const shopPickTasks = doc.pickTasks;
                    const totalItems = shopPickTasks.length;
                    const pickedItems = shopPickTasks.filter((t) => t.status === "completed").length;
                    const warehouse = shopPickTasks[0]?.warehouse || "";

                    let status = "pending";
                    if (pickedItems === totalItems && totalItems > 0) {
                        status = "completed";
                    } else if (pickedItems > 0) {
                        status = "picking";
                    }

                    allTasks.push({
                        id: `${doc.id}-${shop.shopCode || ""}`,
                        documentId: doc.id,
                        docCode: doc.docCode,
                        warehouse: warehouse,
                        shopCode: shop.shopCode || "",
                        shopName: shop.shopName || "",
                        createdAt: doc.createdAt.toISOString(),
                        status,
                        totalItems,
                        pickedItems,
                        assignedUser: doc.fullName || "-",
                    });
                }
            } else {
                // มี shopCode ใน pickTasks
                for (const shopCode of shopCodes) {
                    const shop = doc.shops.find(s => s.shopCode === shopCode) || { shopCode, shopName: "" };
                    const shopPickTasks = doc.pickTasks.filter(t => t.shopCode === shopCode);
                    const totalItems = shopPickTasks.length;
                    const pickedItems = shopPickTasks.filter((t) => t.status === "completed").length;
                    const warehouse = shopPickTasks[0]?.warehouse || "";

                    let status = "pending";
                    if (pickedItems === totalItems && totalItems > 0) {
                        status = "completed";
                    } else if (pickedItems > 0) {
                        status = "picking";
                    }

                    allTasks.push({
                        id: `${doc.id}-${shopCode}`,
                        documentId: doc.id,
                        docCode: doc.docCode,
                        warehouse: warehouse,
                        shopCode: shop.shopCode || "",
                        shopName: shop.shopName || "",
                        createdAt: doc.createdAt.toISOString(),
                        status,
                        totalItems,
                        pickedItems,
                        assignedUser: doc.fullName || "-",
                    });
                }
            }
        }

        // ✅ เรียงตามวันที่สร้าง (ล่าสุดก่อน)
        allTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // ✅ Pagination
        const total = allTasks.length;
        const totalPages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;
        const tasks = allTasks.slice(skip, skip + limit);

        return NextResponse.json({
            success: true,
            tasks,
            totalPages,
            currentPage: page,
            totalTasks: total,
        });
    } catch (error) {
        console.error("Error fetching all pick tasks:", error);
        return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
    }
}