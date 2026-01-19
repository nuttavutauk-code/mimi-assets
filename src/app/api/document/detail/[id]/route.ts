// ============================================================
// 📁 ไฟล์ที่ 1: src/app/api/document/detail/[id]/route.ts
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ✅ GET — ดึงข้อมูลเอกสาร (Next.js 15: params เป็น Promise)
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        // ✅ Next.js 15: ต้อง await params
        const { id } = await params;

        const doc = await prisma.document.findUnique({
            where: { id: Number(id) },
            include: {
                shops: {
                    include: {
                        assets: true,
                        securitySets: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        vendor: true,
                        company: true,
                    },
                },
            },
        });

        if (!doc) {
            return NextResponse.json({ success: false, message: "ไม่พบเอกสาร" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            document: doc,
        });

    } catch (error) {
        console.error("[DOCUMENT_GET_ERROR]", error);
        return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
    }
}