// app/api/pick-asset/available-barcodes/route.ts
// API สำหรับดึง Barcode ที่มีในระบบ

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const assetName = searchParams.get("assetName");

        // เช็คว่าเป็น CONTROLBOX หรือไม่
        const isControlbox = assetName?.includes("CONTROLBOX");

        if (isControlbox) {
            const securityWhere: any = {
                balance: 1,
            };

            if (search) {
                securityWhere.barcode = {
                    contains: search,
                    mode: "insensitive",
                };
            }

            if (assetName) {
                securityWhere.assetName = {
                    equals: assetName,
                    mode: "insensitive",
                };
            }

            const securityTransactions = await prisma.securitySetTransaction.findMany({
                where: securityWhere,
                select: {
                    barcode: true,
                    assetName: true,
                },
                orderBy: { barcode: "asc" },
                distinct: ["barcode"],
                take: 100,
            });

            return NextResponse.json({
                success: true,
                assets: securityTransactions
                    .filter(a => a.barcode && a.barcode.trim() !== "")
                    .map((a) => ({
                        barcode: a.barcode!,
                        assetName: a.assetName,
                        size: null,
                        label: `${a.barcode} - ${a.assetName || "N/A"}`,
                    })),
            });
        }

        // ===== ค้นหาจาก Asset table =====
        console.log("🔍 Searching assets with:", { assetName, search });

        const assetWhere: any = {};

        if (search) {
            assetWhere.barcode = {
                contains: search,
                mode: "insensitive",
            };
        }

        if (assetName) {
            assetWhere.assetName = {
                contains: assetName.trim(),
                mode: "insensitive",
            };
        }

        const assets = await prisma.asset.findMany({
            where: assetWhere,
            select: {
                barcode: true,
                assetName: true,
                size: true,
            },
            orderBy: { barcode: "asc" },
            take: 200,
        });

        console.log("🔍 Found assets from DB:", assets.length);

        // Filter เฉพาะที่มี barcode และ Balance = 1 (หรือไม่มี transaction)
        const availableAssets: typeof assets = [];

        for (const asset of assets) {
            if (!asset.barcode || asset.barcode.trim() === "") {
                continue;
            }

            // หา Transaction ล่าสุดของ Barcode นี้
            const latestTransaction = await prisma.assetTransactionHistory.findFirst({
                where: { barcode: asset.barcode },
                orderBy: { id: "desc" },
                select: { balance: true },
            });

            console.log(`🔍 Checking barcode: ${asset.barcode}, size: "${asset.size || ''}", balance: ${latestTransaction?.balance ?? 'NO_TX'}`);

            // ถ้าไม่มี Transaction หรือ Balance = 1 → แสดง Barcode นี้
            if (!latestTransaction || latestTransaction.balance === 1) {
                availableAssets.push(asset);
            }
        }

        console.log("🔍 Available assets:", availableAssets.length);

        return NextResponse.json({
            success: true,
            assets: availableAssets.map((a) => ({
                barcode: a.barcode,
                assetName: a.assetName,
                size: a.size || null,
                label: `${a.barcode} - ${a.assetName || "N/A"}${a.size ? ` (${a.size})` : " (ไม่มี Size)"}`,
            })),
        });
    } catch (error) {
        console.error("Error fetching available barcodes:", error);
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