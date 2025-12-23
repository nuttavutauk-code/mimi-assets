// app/api/database/route.ts
// API สำหรับดึงข้อมูล AssetTransactionHistory

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        // 1. เช็ค Authentication
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2. เช็คว่าเป็น Admin
        const role = (session.user as any)?.role?.toUpperCase();
        if (role !== "ADMIN") {
            return NextResponse.json(
                { success: false, message: "Forbidden - Admin only" },
                { status: 403 }
            );
        }

        // 3. รับ query parameters
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const barcode = searchParams.get("barcode") || "";
        const assetName = searchParams.get("assetName") || "";
        const mcsCode = searchParams.get("mcsCode") || "";
        const shopName = searchParams.get("shopName") || "";
        const noMcs = searchParams.get("noMcs") === "true";

        // 4. สร้าง where clause
        const where: any = {};

        if (barcode) {
            where.barcode = {
                contains: barcode,
                mode: "insensitive",
            };
        }

        if (assetName) {
            where.assetName = {
                contains: assetName,
                mode: "insensitive",
            };
        }

        if (mcsCode) {
            where.OR = [
                { mcsCodeIn: { contains: mcsCode, mode: "insensitive" } },
                { mcsCodeOut: { contains: mcsCode, mode: "insensitive" } },
            ];
        }

        if (shopName) {
            where.OR = [
                ...(where.OR || []),
                { fromShop: { contains: shopName, mode: "insensitive" } },
                { toShop: { contains: shopName, mode: "insensitive" } },
            ];
        }

        if (noMcs) {
            where.AND = [
                ...(where.AND || []),
                {
                    OR: [
                        { mcsCodeIn: null },
                        { mcsCodeIn: "" },
                        { mcsCodeOut: null },
                        { mcsCodeOut: "" },
                    ],
                },
            ];
        }

        // 5. ดึงข้อมูล
        const [transactions, totalCount] = await Promise.all([
            prisma.assetTransactionHistory.findMany({
                where,
                include: {
                    document: {
                        select: {
                            docCode: true,
                            documentType: true,
                        },
                    },
                },
                orderBy: { createdAt: "asc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.assetTransactionHistory.count({ where }),
        ]);

        // 6. Format data
        const formattedData = transactions.map((t) => ({
            id: t.id,
            docCode: t.document?.docCode || "-",
            barcode: t.barcode,
            assetName: t.assetName,
            warehouseIn: t.warehouseIn || "-",
            assetStatus: t.assetStatus || "-",
            inStockDate: t.inStockDate ? new Date(t.inStockDate).toLocaleDateString("th-TH") : "-",
            startWarranty: t.startWarranty || "-",
            endWarranty: t.endWarranty || "-",
            cheilPO: t.cheilPO || "-",
            unitIn: t.unitIn ?? "-",
            fromVendor: t.fromVendor || "-",
            mcsCodeIn: t.mcsCodeIn || "-",
            fromShop: t.fromShop || "-",
            outDate: t.outDate ? new Date(t.outDate).toLocaleDateString("th-TH") : "-",
            unitOut: t.unitOut ?? "-",
            toVendor: t.toVendor || "-",
            status: t.status || "-",
            shopType: t.shopType || "-",
            mcsCodeOut: t.mcsCodeOut || "-",
            toShop: t.toShop || "-",
            balance: t.balance,
            size: t.size || "-",
            grade: t.grade || "-",
            remarkIn: t.remarkIn || "-",
            remarkOut: t.remarkOut || "-",
            wkOut: t.wkOut || "-",
            wkIn: t.wkIn || "-",
            wkOutForRepair: t.wkOutForRepair || "-",
            wkInForRepair: t.wkInForRepair || "-",
            newInStock: t.newInStock || "-",
            refurbishedInStock: t.refurbishedInStock || "-",
            borrow: t.borrow || "-",
            return: t.return || "-",
            repair: t.repair || "-",
            outToRentalWarehouse: t.outToRentalWarehouse || "-",
            inToRentalWarehouse: t.inToRentalWarehouse || "-",
            discarded: t.discarded || "-",
            adjustError: t.adjustError || "-",
        }));

        // 7. คำนวณ pagination
        const totalPages = Math.ceil(totalCount / limit);

        return NextResponse.json({
            success: true,
            data: formattedData,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit,
            },
        });
    } catch (error) {
        console.error("Error fetching database:", error);
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