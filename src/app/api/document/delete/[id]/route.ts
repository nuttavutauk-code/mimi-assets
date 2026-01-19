// ============================================================
// 📁 ไฟล์ที่ 2: src/app/api/document/delete/[id]/route.ts
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// ✅ Next.js 15: params เป็น Promise
export async function DELETE(
    req: Request,
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

        // 2. เช็ค Role (Admin เท่านั้น)
        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, message: "Forbidden: Admin only" },
                { status: 403 }
            );
        }

        // ✅ Next.js 15: ต้อง await params
        const { id: idStr } = await params;
        const id = Number(idStr);

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

        // ===== จัดการข้อมูลที่เกี่ยวข้องก่อนลบเอกสาร =====

        // 1. Reset AssetTransactionHistory ที่เกี่ยวข้องกับเอกสารนี้
        // แทนที่จะลบ → Reset ขา OUT กลับ และ balance = 1
        const resetTransactions = await prisma.assetTransactionHistory.updateMany({
            where: { documentId: id },
            data: {
                documentId: null,
                outDate: null,
                unitOut: null,
                toVendor: null,
                status: null,
                shopType: null,
                mcsCodeOut: null,
                toShop: null,
                remarkOut: null,
                balance: 1,
                // Reset WK columns
                wkOut: null,
                wkOutForRepair: null,
                borrow: null,
                outToRentalWarehouse: null,
                inToRentalWarehouse: null,
                discarded: null,
                adjustError: null,
            },
        });

        // 2. Reset SecuritySetTransaction ที่เกี่ยวข้องกับเอกสารนี้
        const resetSecurityTransactions = await prisma.securitySetTransaction.updateMany({
            where: { documentId: id },
            data: {
                documentId: null,
                outDate: null,
                unitOut: null,
                toVendor: null,
                status: null,
                mcsCodeOut: null,
                toShop: null,
                remarkOut: null,
                balance: 1,
            },
        });

        // 3. ลบ TransferReceiveTask ที่เกี่ยวข้องกับเอกสารนี้
        const deletedTransferTasks = await prisma.transferReceiveTask.deleteMany({
            where: { documentId: id },
        });

        // 4. ลบ RepairTask ที่เกี่ยวข้องกับเอกสารนี้
        const deletedRepairTasks = await prisma.repairTask.deleteMany({
            where: { documentId: id },
        });

        // 5. ลบ PickAssetTask ที่เกี่ยวข้องกับเอกสารนี้
        const deletedPickTasks = await prisma.pickAssetTask.deleteMany({
            where: { documentId: id },
        });

        // 6. ลบเอกสาร (DocumentShop, DocumentAsset, DocumentSecuritySet จะถูกลบอัตโนมัติผ่าน onDelete: Cascade)
        await prisma.document.delete({
            where: { id },
        });

        console.log(`✅ Deleted document ${id}:`);
        console.log(`   - Transactions reset: ${resetTransactions.count}`);
        console.log(`   - Security transactions reset: ${resetSecurityTransactions.count}`);
        console.log(`   - Pick tasks deleted: ${deletedPickTasks.count}`);
        console.log(`   - Transfer tasks deleted: ${deletedTransferTasks.count}`);
        console.log(`   - Repair tasks deleted: ${deletedRepairTasks.count}`);

        return NextResponse.json({
            success: true,
            message: "ลบเอกสารสำเร็จ",
            reset: {
                transactions: resetTransactions.count,
                securityTransactions: resetSecurityTransactions.count,
            },
            deleted: {
                pickTasks: deletedPickTasks.count,
                transferTasks: deletedTransferTasks.count,
                repairTasks: deletedRepairTasks.count,
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