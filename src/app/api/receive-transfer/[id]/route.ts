// app/api/receive-transfer/[id]/route.ts
// API สำหรับดึงรายละเอียดและอัปเดต Transfer Receive Tasks

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - ดึงรายละเอียดเอกสารและ Tasks
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

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

        const documentId = parseInt(params.id);

        // ดึงเอกสารพร้อม tasks
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: {
                createdBy: {
                    select: {
                        firstName: true,
                        lastName: true,
                        vendor: true,
                        phone: true,
                    },
                },
                shops: true,
                transferReceiveTasks: {
                    where: {
                        toWarehouse: user.vendor,
                    },
                    orderBy: { id: "asc" },
                },
            },
        });

        if (!document) {
            return NextResponse.json(
                { success: false, message: "Document not found" },
                { status: 404 }
            );
        }

        // หาโกดังต้นทาง
        const fromWarehouse = document.transferReceiveTasks.length > 0 
            ? document.transferReceiveTasks[0].fromWarehouse 
            : "-";

        // หาวันที่โอนย้าย
        const transferDate = document.shops.length > 0 
            ? document.shops[0].startInstallDate 
            : document.createdAt;

        return NextResponse.json({
            success: true,
            document: {
                id: document.id,
                docCode: document.docCode,
                documentType: document.documentType,
                fromWarehouse,
                senderName: document.fullName || `${document.createdBy.firstName || ""} ${document.createdBy.lastName || ""}`.trim(),
                senderPhone: document.phone || document.createdBy.phone || "-",
                operation: document.operation,
                otherDetail: document.otherDetail,
                transferDate,
                transferDocImageUrl: document.transferDocImageUrl,
            },
            tasks: document.transferReceiveTasks.map((task) => ({
                id: task.id,
                pickAssetTaskId: task.pickAssetTaskId,
                barcode: task.barcode,
                assetName: task.assetName,
                size: task.size,
                grade: task.grade,
                status: task.status,
                rejectReason: task.rejectReason,
                assetImageUrl: task.assetImageUrl,
            })),
        });
    } catch (error) {
        console.error("Error fetching receive transfer detail:", error);
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

// PATCH - อัปเดตสถานะ Task และรูปภาพ
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = parseInt((session.user as any).id || (session.user as any).sub || "0");

        const body = await req.json();
        const { taskId, status, rejectReason, assetImageUrl, transferDocImageUrl } = body;

        // อัปเดตรูปเอกสาร (ถ้ามี)
        if (transferDocImageUrl !== undefined) {
            const documentId = parseInt(params.id);
            await prisma.document.update({
                where: { id: documentId },
                data: { transferDocImageUrl },
            });
        }

        // อัปเดต Task (ถ้ามี taskId)
        if (taskId) {
            const updateData: any = {};

            if (status) {
                updateData.status = status;
                if (status === "received") {
                    updateData.receivedAt = new Date();
                    updateData.receivedBy = userId;
                }
            }

            if (rejectReason !== undefined) {
                updateData.rejectReason = rejectReason;
            }

            if (assetImageUrl !== undefined) {
                updateData.assetImageUrl = assetImageUrl;
            }

            await prisma.transferReceiveTask.update({
                where: { id: taskId },
                data: updateData,
            });
        }

        return NextResponse.json({
            success: true,
            message: "Updated successfully",
        });
    } catch (error) {
        console.error("Error updating receive transfer:", error);
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
