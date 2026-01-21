// app/api/document/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendRejectionEmail } from "@/lib/email";

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

        // 2. เช็ค Role (Admin เท่านั้น)
        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, message: "Forbidden: Admin only" },
                { status: 403 }
            );
        }

        // 3. รับ documentId และ reason
        const body = await req.json();
        const { documentId, reason } = body;

        if (!documentId || typeof documentId !== "number") {
            return NextResponse.json(
                { success: false, message: "Valid document ID is required" },
                { status: 400 }
            );
        }

        // 4. เช็คว่าเอกสารมีอยู่จริง + ดึงข้อมูลผู้สร้างเอกสาร
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: {
                createdBy: true,
            },
        });

        if (!document) {
            return NextResponse.json(
                { success: false, message: "Document not found" },
                { status: 404 }
            );
        }

        // 5. เช็คว่าเอกสารถูก submit แล้วหรือยัง
        if (document.status !== "submitted") {
            return NextResponse.json(
                { success: false, message: "Document must be submitted first" },
                { status: 400 }
            );
        }

        // 6. Update document status เป็น rejected
        await prisma.document.update({
            where: { id: documentId },
            data: {
                status: "rejected",
                note: reason || null, // บันทึกเหตุผลใน note
            },
        });

        // 7. ส่ง Email แจ้งผู้สร้างเอกสาร
        if (document.createdBy?.email) {
            sendRejectionEmail({
                toEmail: document.createdBy.email,
                userName: document.createdBy.username || document.createdBy.firstName || "User",
                docCode: document.docCode,
                documentType: document.documentType,
                rejectedBy: session.user.username || session.user.name || "Admin",
                reason: reason || undefined,
            }).catch((err) => console.error("Failed to send rejection email:", err));
        }

        return NextResponse.json({
            success: true,
            message: "Document rejected successfully.",
        });
    } catch (error) {
        console.error("Error rejecting document:", error);
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