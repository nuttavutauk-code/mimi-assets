// app/api/pick-asset/update-barcode/route.ts
// API สำหรับ Picker อัพเดท Barcode และรูปภาพของแต่ละ Task

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
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
            select: { vendor: true },
        });

        if (!user || !user.vendor) {
            return NextResponse.json(
                { success: false, message: "User vendor not found" },
                { status: 400 }
            );
        }

        // 3. รับข้อมูลจาก body
        const body = await req.json();
        const { taskId, barcode, barcodeImageUrl, assetImageUrl } = body;

        if (!taskId) {
            return NextResponse.json(
                { success: false, message: "Task ID is required" },
                { status: 400 }
            );
        }

        // 4. เช็คว่า Task นี้เป็นของ vendor นี้หรือไม่
        const task = await prisma.pickAssetTask.findUnique({
            where: { id: taskId },
        });

        if (!task) {
            return NextResponse.json(
                { success: false, message: "Task not found" },
                { status: 404 }
            );
        }

        if (task.warehouse !== user.vendor) {
            return NextResponse.json(
                { success: false, message: "Access denied: Task does not belong to your warehouse" },
                { status: 403 }
            );
        }

        // 5. เช็คว่า Task ยัง complete หรือ cancelled หรือยัง
        if (task.status === "completed") {
            return NextResponse.json(
                { success: false, message: "Cannot update completed task" },
                { status: 400 }
            );
        }

        if (task.status === "cancelled") {
            return NextResponse.json(
                { success: true, message: "Task is cancelled, skipped update" },
            );
        }

        // 6. Update Task
        const updatedTask = await prisma.pickAssetTask.update({
            where: { id: taskId },
            data: {
                barcode: barcode || task.barcode,
                barcodeImageUrl: barcodeImageUrl || task.barcodeImageUrl,
                assetImageUrl: assetImageUrl || task.assetImageUrl,
                status: "picking", // เปลี่ยน status เป็น picking
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            message: "Task updated successfully",
            task: {
                id: updatedTask.id,
                barcode: updatedTask.barcode,
                barcodeImageUrl: updatedTask.barcodeImageUrl,
                assetImageUrl: updatedTask.assetImageUrl,
                status: updatedTask.status,
            },
        });
    } catch (error) {
        console.error("Error updating barcode:", error);
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