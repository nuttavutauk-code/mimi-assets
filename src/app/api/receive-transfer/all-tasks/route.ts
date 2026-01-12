// src/app/api/receive-transfer/all-tasks/route.ts
// API สำหรับ Admin ดูรายการรับของโอนย้ายทั้งหมด

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
        const status = searchParams.get("status") || "all";
        const limit = 20;
        const skip = (page - 1) * limit;

        // สร้าง where clause - ดึงเฉพาะเอกสาร TRANSFER ที่ approved แล้ว
        const where = {
            documentType: "TRANSFER",
            status: "approved",
        };

        // ดึงข้อมูลทั้งหมด
        const [documents, total] = await Promise.all([
            prisma.document.findMany({
                where,
                select: {
                    id: true,
                    docCode: true,
                    fullName: true,
                    phone: true,
                    createdAt: true,
                    shops: {
                        select: {
                            assets: {
                                select: {
                                    id: true,
                                    barcode: true,
                                },
                            },
                        },
                    },
                    // ดึงข้อมูลจาก transactions เพื่อหา warehouse info
                    transactions: {
                        select: {
                            warehouseIn: true,
                            fromVendor: true,
                            outDate: true,
                        },
                        take: 1,
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.document.count({ where }),
        ]);

        // Map data
        const tasks = documents
            .map((doc) => {
                const transaction = doc.transactions[0];
                const allAssets = doc.shops.flatMap((s) => s.assets);
                const totalItems = allAssets.length;

                // นับจาก barcode ที่มีค่า (ถือว่ารับแล้ว)
                const receivedItems = allAssets.filter((a) => a.barcode && a.barcode.length > 0).length;
                const pendingItems = totalItems - receivedItems;

                let taskStatus = "pending";
                if (receivedItems === totalItems && totalItems > 0) {
                    taskStatus = "completed";
                } else if (receivedItems > 0) {
                    taskStatus = "partial";
                }

                // กรองตาม status ถ้าระบุ
                if (status !== "all" && taskStatus !== status) {
                    return null;
                }

                return {
                    id: doc.id,
                    documentId: doc.id,
                    docCode: doc.docCode,
                    fromWarehouse: transaction?.fromVendor || "-",
                    toWarehouse: transaction?.warehouseIn || "-",
                    senderName: doc.fullName || "-",
                    transferDate: transaction?.outDate?.toISOString() || doc.createdAt.toISOString(),
                    status: taskStatus,
                    totalItems,
                    receivedItems,
                    rejectedItems: 0,
                    createdAt: doc.createdAt.toISOString(),
                };
            })
            .filter(Boolean);

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            success: true,
            tasks,
            totalPages,
            currentPage: page,
        });
    } catch (error) {
        console.error("Error fetching all receive transfer tasks:", error);
        return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
    }
}