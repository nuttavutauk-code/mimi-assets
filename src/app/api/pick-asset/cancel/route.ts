// app/api/pick-asset/cancel/route.ts
// API สำหรับยกเลิกรายการ Pick Asset Task
// - ไม่ลบรายการ แค่เปลี่ยน status เป็น "cancelled"
// - ล้างค่า barcode, barcodeImageUrl, assetImageUrl ให้ว่าง

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { taskId } = body;

        if (!taskId) {
            return NextResponse.json({ success: false, error: "taskId is required" }, { status: 400 });
        }

        // ตรวจสอบว่า task มีอยู่จริง
        const task = await prisma.pickAssetTask.findUnique({
            where: { id: taskId },
        });

        if (!task) {
            return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
        }

        // ตรวจสอบว่ายังไม่ถูก complete
        if (task.status === "completed") {
            return NextResponse.json({ success: false, error: "Cannot cancel completed task" }, { status: 400 });
        }

        // อัปเดต task เป็น cancelled และล้างค่าต่างๆ
        const updatedTask = await prisma.pickAssetTask.update({
            where: { id: taskId },
            data: {
                status: "cancelled",
                barcode: null,
                barcodeImageUrl: null,
                assetImageUrl: null,
            },
        });

        console.log(`✅ Task ${taskId} cancelled by user ${session.user.email}`);

        return NextResponse.json({
            success: true,
            message: "Task cancelled successfully",
            task: updatedTask,
        });

    } catch (error) {
        console.error("Error cancelling task:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}