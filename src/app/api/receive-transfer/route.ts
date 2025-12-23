// app/api/receive-transfer/route.ts
// API สำหรับดึงรายการเอกสารใบย้ายของที่รอรับ

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

        // 2. ดึง vendor ของ User (โกดังปลายทาง)
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

        // 3. รับ query parameters
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status"); // pending, received, rejected

        // 4. ดึงรายการ TransferReceiveTask ที่ส่งมาให้โกดังนี้
        const whereClause: any = {
            toWarehouse: user.vendor,
        };

        // 5. ดึง Documents ที่มี TransferReceiveTask สำหรับโกดังนี้
        const documents = await prisma.document.findMany({
            where: {
                documentType: "transfer",
                transferReceiveTasks: {
                    some: {
                        toWarehouse: user.vendor,
                    },
                },
            },
            include: {
                createdBy: {
                    select: {
                        firstName: true,
                        lastName: true,
                        vendor: true,
                        phone: true,
                    },
                },
                transferReceiveTasks: {
                    where: {
                        toWarehouse: user.vendor,
                    },
                },
                shops: true,
            },
            orderBy: { createdAt: "desc" },
        });

        // 6. จัดกลุ่มและคำนวณสถานะ
        const result = documents.map((doc) => {
            const tasks = doc.transferReceiveTasks;
            const totalTasks = tasks.length;
            const receivedTasks = tasks.filter((t) => t.status === "received").length;
            const rejectedTasks = tasks.filter((t) => t.status === "rejected").length;
            const pendingTasks = tasks.filter((t) => t.status === "pending").length;

            // คำนวณสถานะรวม
            let docStatus = "pending"; // รอตรวจสอบ
            if (pendingTasks === 0) {
                if (rejectedTasks === 0) {
                    docStatus = "received"; // รับครบแล้ว
                } else {
                    docStatus = "received_with_rejected"; // รับแล้ว(มียกเลิก)
                }
            }

            // หาโกดังต้นทาง (จาก task แรก)
            const fromWarehouse = tasks.length > 0 ? tasks[0].fromWarehouse : "-";

            // หาวันที่ส่ง (จาก shop แรก)
            const transferDate = doc.shops.length > 0 ? doc.shops[0].startInstallDate : doc.createdAt;

            return {
                id: doc.id,
                docCode: doc.docCode,
                fromWarehouse,
                senderName: doc.fullName || `${doc.createdBy.firstName || ""} ${doc.createdBy.lastName || ""}`.trim(),
                senderPhone: doc.phone || doc.createdBy.phone || "-",
                transferDate,
                totalAssets: totalTasks,
                receivedAssets: receivedTasks,
                rejectedAssets: rejectedTasks,
                status: docStatus,
            };
        });

        // 7. Filter ตาม status ถ้ามี
        let filteredResult = result;
        if (status === "pending") {
            filteredResult = result.filter((r) => r.status === "pending");
        } else if (status === "received") {
            filteredResult = result.filter((r) => r.status === "received");
        } else if (status === "received_with_rejected") {
            filteredResult = result.filter((r) => r.status === "received_with_rejected");
        }

        return NextResponse.json({
            success: true,
            documents: filteredResult,
        });
    } catch (error) {
        console.error("Error fetching receive transfer list:", error);
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
