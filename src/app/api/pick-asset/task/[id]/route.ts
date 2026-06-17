// ============================================================
// 📁 ไฟล์ที่ 5: src/app/api/pick-asset/task/[id]/route.ts
// ============================================================

// API สำหรับ Picker ดูรายละเอียด Tasks ของเอกสารหนึ่งๆ
// ✅ Next.js 15: params เป็น Promise

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. เช็ค Authentication
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2. ดึงข้อมูล User พร้อม role
        const userId = parseInt((session.user as any).id || (session.user as any).sub || "0");

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { vendor: true, role: true },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, message: "User not found" },
                { status: 400 }
            );
        }

        const isAdmin = user.role === "ADMIN";

        // ✅ User ต้องมี vendor, Admin ไม่จำเป็น
        if (!isAdmin && !user.vendor) {
            return NextResponse.json(
                { success: false, message: "User vendor not found" },
                { status: 400 }
            );
        }

        // ✅ Next.js 15: ต้อง await params
        const { id } = await params;
        const documentId = parseInt(id);
        
        // 3. รับ shopCode จาก query
        const { searchParams } = new URL(req.url);
        const shopCode = searchParams.get("shopCode") || "";

        if (isNaN(documentId)) {
            return NextResponse.json(
                { success: false, message: "Invalid document ID" },
                { status: 400 }
            );
        }

        // 4. ดึงข้อมูล Tasks ทั้งหมดของเอกสารนี้
        const whereClause: any = {
            documentId,
        };

        // ✅ Admin ดูได้ทุก task, User ดูได้เฉพาะ vendor ตัวเอง
        if (!isAdmin) {
            whereClause.warehouse = user.vendor;
        }

        // ✅ ถ้ามี shopCode ให้ filter ตาม shop ด้วย
        if (shopCode) {
            whereClause.shopCode = shopCode;
        }

        const tasks = await prisma.pickAssetTask.findMany({
            where: whereClause,
            include: {
                document: {
                    select: {
                        docCode: true,
                        documentType: true,
                        fullName: true,
                        company: true,
                        phone: true,
                    },
                },
            },
            orderBy: { id: "asc" },
        });

        if (tasks.length === 0) {
            return NextResponse.json(
                { success: false, message: "No tasks found or access denied" },
                { status: 404 }
            );
        }

        // 5. จัดกลุ่ม Tasks เป็น Assets และ Security Sets
        const assets = tasks.filter((t) => !t.isSecuritySet);
        const securitySets = tasks.filter((t) => t.isSecuritySet);

        // 6. สร้าง response structure
        const firstTask = tasks[0];

        return NextResponse.json({
            success: true,
            documentId,
            docCode: firstTask.document.docCode,
            documentType: firstTask.document.documentType,

            // ข้อมูลผู้เบิก
            requester: {
                name: firstTask.requesterName || firstTask.document.fullName,
                company: firstTask.requesterCompany || firstTask.document.company,
                phone: firstTask.requesterPhone || firstTask.document.phone,
            },

            // ข้อมูล Shop
            shop: {
                code: firstTask.shopCode,
                name: firstTask.shopName,
                startInstallDate: firstTask.startInstallDate?.toISOString(),
                endInstallDate: firstTask.endInstallDate?.toISOString(),
                q7b7: firstTask.q7b7,
                shopFocus: firstTask.shopFocus,
            },

            // รายการ Assets
            assets: assets.map((task) => ({
                id: task.id,
                assetName: task.assetName,
                size: task.size,
                grade: task.grade,
                qty: task.qty,
                barcode: task.barcode,
                barcodeImageUrl: task.barcodeImageUrl,
                assetImageUrl: task.assetImageUrl,
                status: task.status,
                warehouse: task.warehouse,
            })),

            // รายการ Security Sets
            securitySets: securitySets.map((task) => ({
                id: task.id,
                assetName: task.assetName,
                qty: task.qty,
                barcode: task.barcode,
                barcodeImageUrl: task.barcodeImageUrl,
                assetImageUrl: task.assetImageUrl,
                status: task.status,
                warehouse: task.warehouse,
            })),

            // สถานะรวม
            summary: {
                totalItems: tasks.length,
                completedItems: tasks.filter((t) => t.status === "completed").length,
                pendingItems: tasks.filter((t) => t.status === "pending").length,
            },
        });
    } catch (error) {
        console.error("Error fetching task detail:", error);
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