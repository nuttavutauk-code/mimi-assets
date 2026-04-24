import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { writeAuditLog, AuditAction, getSessionUser } from "@/lib/audit-log";

/**
 * 📦 PATCH /api/shop/toggle-status
 * สลับสถานะ OPEN <-> CLOSED ของ Shop
 */
export async function PATCH(req: Request) {
    try {
    // เช็ค Authentication (Admin only)
    const auth = await requireAdmin();
    if (auth.response) return auth.response;
    const { userId, username, userRole } = getSessionUser(auth.session);


        const body = await req.json();
        const { mcsCode } = body;

        if (!mcsCode) {
            return NextResponse.json(
                { success: false, error: "MCS Code is required" },
                { status: 400 }
            );
        }

        // หา Shop ปัจจุบัน
        const shop = await prisma.shop.findUnique({
            where: { mcsCode },
        });

        if (!shop) {
            return NextResponse.json(
                { success: false, error: "Shop not found" },
                { status: 404 }
            );
        }

        // Toggle status: OPEN <-> CLOSED
        const currentStatus = shop.status?.toUpperCase() || "";
        const newStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN";

        // อัปเดต status
        const updatedShop = await prisma.shop.update({
            where: { mcsCode },
            data: { status: newStatus },
        });

        await writeAuditLog({ userId, username, userRole, action: AuditAction.SHOP_TOGGLE_STATUS, entity: "Shop", entityId: mcsCode, detail: { mcsCode, oldStatus: currentStatus || null, newStatus }, req });
        return NextResponse.json({
            success: true,
            message: `เปลี่ยนสถานะเป็น ${newStatus} สำเร็จ`,
            shop: updatedShop,
        });
    } catch (error) {
        console.error("[TOGGLE_SHOP_STATUS_ERROR]", error);
        return NextResponse.json(
            { success: false, error: "เกิดข้อผิดพลาดในการเปลี่ยนสถานะ" },
            { status: 500 }
        );
    }
}