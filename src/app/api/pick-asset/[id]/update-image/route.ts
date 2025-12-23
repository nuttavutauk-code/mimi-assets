import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. เช็ค Authentication
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. รับ params และ body
        const { id } = await params;
        const taskId = parseInt(id);

        if (isNaN(taskId)) {
            return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
        }

        const body = await req.json();
        const { imageType, imageUrl } = body;

        if (!imageType || !["barcode", "asset"].includes(imageType)) {
            return NextResponse.json({ error: "Invalid imageType" }, { status: 400 });
        }

        if (!imageUrl) {
            return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
        }

        // 3. เช็คว่า Task มีอยู่จริง
        const task = await prisma.pickAssetTask.findUnique({
            where: { id: taskId },
        });

        if (!task) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        // 4. อัปเดต URL รูป
        const updateData: Record<string, string> = {};
        if (imageType === "barcode") {
            updateData.barcodeImageUrl = imageUrl;
        } else {
            updateData.assetImageUrl = imageUrl;
        }

        await prisma.pickAssetTask.update({
            where: { id: taskId },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            message: `อัปเดตรูป ${imageType} สำเร็จ`,
        });
    } catch (error) {
        console.error("[UPDATE_IMAGE_ERROR]", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการอัปเดต" },
            { status: 500 }
        );
    }
}