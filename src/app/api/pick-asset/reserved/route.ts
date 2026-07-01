import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role?.toUpperCase() !== "ADMIN") {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const barcode = searchParams.get("barcode")?.trim() || "";
        const statusFilter = searchParams.get("status") || ""; // "pending" | "picking" | ""=all
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20")));

        const whereBase: any = {
            barcode: { not: null },
            status: { notIn: ["completed", "cancelled"] },
        };

        if (barcode) {
            whereBase.barcode = { contains: barcode, mode: "insensitive" };
        }

        if (statusFilter === "pending" || statusFilter === "picking") {
            whereBase.status = statusFilter;
        }

        const [total, tasks] = await Promise.all([
            prisma.pickAssetTask.count({ where: whereBase }),
            prisma.pickAssetTask.findMany({
                where: whereBase,
                include: {
                    document: {
                        select: { docCode: true, documentType: true, fullName: true, company: true },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        const items = tasks.map((t) => ({
            id: t.id,
            barcode: t.barcode,
            assetName: t.assetName,
            warehouse: t.warehouse,
            status: t.status,
            documentId: t.documentId,
            docCode: t.document?.docCode || "",
            documentType: t.document?.documentType || "",
            shopCode: t.shopCode || "",
            shopName: t.shopName || "",
            requesterName: t.requesterName || "",
            requesterCompany: t.requesterCompany || "",
            createdAt: t.createdAt,
        }));

        return NextResponse.json({
            success: true,
            items,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error("[RESERVED_BARCODES_ERROR]", error);
        return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
    }
}
