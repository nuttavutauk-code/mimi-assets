import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
        }

        const isAdmin = user.role?.toUpperCase() === "ADMIN";

        // สำหรับ Admin: ดูทั้งหมด, สำหรับ User: ดูเฉพาะของตัวเอง
        const documentWhere = isAdmin ? {} : { createdById: user.id };

        // ดึงสถิติเอกสาร
        const [
            totalDocuments,
            approvedDocuments,
            pendingDocuments,
            rejectedDocuments,
            recentDocuments,
            totalAssets,
            totalShops,
            recentActivities
        ] = await Promise.all([
            // จำนวนเอกสารทั้งหมด
            prisma.document.count({ where: documentWhere }),
            // อนุมัติแล้ว
            prisma.document.count({ where: { ...documentWhere, status: "approved" } }),
            // รอดำเนินการ
            prisma.document.count({ where: { ...documentWhere, status: "submitted" } }),
            // รอแก้ไข
            prisma.document.count({ where: { ...documentWhere, status: "rejected" } }),
            // เอกสารล่าสุด 5 รายการ
            prisma.document.findMany({
                where: documentWhere,
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                    id: true,
                    docCode: true,
                    documentType: true,
                    status: true,
                    createdAt: true,
                    fullName: true,
                },
            }),
            // จำนวน Asset ทั้งหมด (นับจาก AssetTransactionHistory ที่ balance > 0)
            prisma.assetTransactionHistory.count({ where: { balance: { gt: 0 } } }),
            // จำนวน Shop ที่เปิดอยู่
            prisma.shop.count({ where: { status: "OPEN" } }),
            // กิจกรรมล่าสุด (เอกสารที่เพิ่งสร้าง)
            prisma.document.findMany({
                where: documentWhere,
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                    id: true,
                    docCode: true,
                    documentType: true,
                    status: true,
                    createdAt: true,
                },
            }),
        ]);

        // คำนวณ % การเปลี่ยนแปลง (เทียบกับ 7 วันที่แล้ว)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [
            docsLastWeek,
            approvedLastWeek,
            pendingLastWeek,
        ] = await Promise.all([
            prisma.document.count({
                where: {
                    ...documentWhere,
                    createdAt: { lt: sevenDaysAgo },
                },
            }),
            prisma.document.count({
                where: {
                    ...documentWhere,
                    status: "approved",
                    createdAt: { lt: sevenDaysAgo },
                },
            }),
            prisma.document.count({
                where: {
                    ...documentWhere,
                    status: "submitted",
                    createdAt: { lt: sevenDaysAgo },
                },
            }),
        ]);

        // คำนวณ % เปลี่ยนแปลง
        const calcChange = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
        };

        return NextResponse.json({
            success: true,
            stats: {
                totalDocuments,
                approvedDocuments,
                pendingDocuments,
                rejectedDocuments,
                totalAssets,
                totalShops,
                changes: {
                    documents: calcChange(totalDocuments, docsLastWeek),
                    approved: calcChange(approvedDocuments, approvedLastWeek),
                    pending: calcChange(pendingDocuments, pendingLastWeek),
                },
            },
            recentDocuments,
            recentActivities,
            user: {
                role: user.role,
                vendor: user.vendor,
            },
        });
    } catch (error) {
        console.error("[DASHBOARD API ERROR]", error);
        return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
    }
}