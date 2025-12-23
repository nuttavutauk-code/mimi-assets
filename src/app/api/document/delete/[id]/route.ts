import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(
    req: Request,
    context: { params: { id: string } }
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

        // 2. เช็ค Role (Admin เท่านั้น)
        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, message: "Forbidden: Admin only" },
                { status: 403 }
            );
        }

        // แปลง id จาก string → number ก่อนใช้กับ Prisma
        const id = Number(context.params.id);

        if (isNaN(id)) {
            return NextResponse.json(
                { success: false, message: "รหัสเอกสารไม่ถูกต้อง" },
                { status: 400 }
            );
        }

        const existing = await prisma.document.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, message: "ไม่พบเอกสารนี้" },
                { status: 404 }
            );
        }

        // ===== ลบข้อมูลที่เกี่ยวข้องก่อนลบเอกสาร =====

        // 1. ลบ AssetTransactionHistory ที่เกี่ยวข้องกับเอกสารนี้
        const deletedTransactions = await prisma.assetTransactionHistory.deleteMany({
            where: { documentId: id },
        });

        // 2. ลบ PickAssetTask ที่เกี่ยวข้องกับเอกสารนี้
        const deletedTasks = await prisma.pickAssetTask.deleteMany({
            where: { documentId: id },
        });

        // 3. ลบเอกสาร (DocumentShop, DocumentAsset, DocumentSecuritySet จะถูกลบอัตโนมัติผ่าน onDelete: Cascade)
        await prisma.document.delete({
            where: { id },
        });

        console.log(`✅ Deleted document ${id}:`);
        console.log(`   - Transactions deleted: ${deletedTransactions.count}`);
        console.log(`   - Pick tasks deleted: ${deletedTasks.count}`);

        return NextResponse.json({
            success: true,
            message: "ลบเอกสารสำเร็จ",
            deleted: {
                transactions: deletedTransactions.count,
                pickTasks: deletedTasks.count,
            },
        });
    } catch (err) {
        console.error("❌ Error deleting document:", err);
        return NextResponse.json(
            { success: false, message: "เกิดข้อผิดพลาดในการลบเอกสาร" },
            { status: 500 }
        );
    }
}