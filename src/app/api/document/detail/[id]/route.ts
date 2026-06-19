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
                    orderBy: { id: "asc" },
                    include: {
                        assets: { orderBy: { id: "asc" } },
                        securitySets: { orderBy: { id: "asc" } },
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

        // ✅ ดึง PickAssetTask มาผูก barcode กลับให้แต่ละ asset/security row (สำหรับ download/preview)
        // จัดกลุ่ม tasks ตาม assetName + shopCode → array ของ barcode ตามลำดับ
        const pickTasks = await prisma.pickAssetTask.findMany({
            where: { documentId: Number(id) },
            orderBy: { id: "asc" },
            select: {
                assetName: true,
                shopCode: true,
                barcode: true,
                isSecuritySet: true,
                status: true,
            },
        });

        const barcodesByKey: Record<string, string[]> = {};
        for (const t of pickTasks) {
            if (!t.barcode) continue;
            const key = `${t.isSecuritySet ? "s" : "a"}|${t.assetName}|${t.shopCode || ""}`;
            (barcodesByKey[key] ||= []).push(t.barcode);
        }

        // map กลับ assets/securitySets ของแต่ละ shop → ใส่ assignedBarcodes
        // ใช้ index pointer แจก barcode ตามลำดับ ป้องกัน barcode ซ้ำเมื่อมีหลาย record ชื่อเดียวกัน
        const barcodeIndexByKey: Record<string, number> = {};
        const enrichedShops = doc.shops.map((s) => ({
            ...s,
            assets: s.assets.map((a) => {
                const key = `a|${a.name}|${s.shopCode || ""}`;
                const all = barcodesByKey[key] || [];
                const idx = barcodeIndexByKey[key] || 0;
                barcodeIndexByKey[key] = idx + a.qty;
                return { ...a, assignedBarcodes: all.slice(idx, idx + a.qty) };
            }),
            securitySets: s.securitySets.map((sec) => ({
                ...sec,
                assignedBarcodes: barcodesByKey[`s|${sec.name}|${s.shopCode || ""}`] || [],
            })),
        }));

        return NextResponse.json({
            success: true,
            document: { ...doc, shops: enrichedShops },
        });

    } catch (error) {
        console.error("[DOCUMENT_GET_ERROR]", error);
        return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
    }
}