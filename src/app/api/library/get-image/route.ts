import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// API สำหรับค้นหารูปภาพจาก Asset Name
// หมายเหตุ: API นี้เปิดเป็น public เพราะใช้สำหรับ preview document pages
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const assetName = searchParams.get("assetName");

        if (!assetName) {
            return NextResponse.json({ error: "assetName is required" }, { status: 400 });
        }

        // ค้นหาใน LibrarySIS ก่อน
        const sisItem = await prisma.librarySIS.findFirst({
            where: {
                assetName: {
                    equals: assetName,
                    mode: "insensitive", // case-insensitive
                },
            },
            select: {
                pictureUrl: true,
                assetName: true,
            },
        });

        if (sisItem?.pictureUrl) {
            return NextResponse.json({
                imageUrl: sisItem.pictureUrl,
                source: "LibrarySIS",
                assetName: sisItem.assetName,
            });
        }

        // ถ้าไม่พบใน SIS ค้นหาใน LibrarySES
        const sesItem = await prisma.librarySES.findFirst({
            where: {
                assetName: {
                    equals: assetName,
                    mode: "insensitive",
                },
            },
            select: {
                imageUrl: true,
                assetName: true,
            },
        });

        if (sesItem?.imageUrl) {
            return NextResponse.json({
                imageUrl: sesItem.imageUrl,
                source: "LibrarySES",
                assetName: sesItem.assetName,
            });
        }

        // ไม่พบรูปภาพ
        return NextResponse.json({
            imageUrl: null,
            source: null,
            assetName: assetName,
        });
    } catch (err) {
        console.error("[GET Library Image ERROR]", err);
        return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
    }
}

// API สำหรับค้นหารูปภาพหลายรายการพร้อมกัน
export async function POST(req: Request) {
    try {
        const { assetNames } = await req.json();

        if (!assetNames || !Array.isArray(assetNames)) {
            return NextResponse.json({ error: "assetNames array is required" }, { status: 400 });
        }

        const results: Record<string, string | null> = {};

        for (const assetName of assetNames) {
            // ค้นหาใน LibrarySIS
            const sisItem = await prisma.librarySIS.findFirst({
                where: {
                    assetName: {
                        equals: assetName,
                        mode: "insensitive",
                    },
                },
                select: { pictureUrl: true },
            });

            if (sisItem?.pictureUrl) {
                results[assetName] = sisItem.pictureUrl;
                continue;
            }

            // ค้นหาใน LibrarySES
            const sesItem = await prisma.librarySES.findFirst({
                where: {
                    assetName: {
                        equals: assetName,
                        mode: "insensitive",
                    },
                },
                select: { imageUrl: true },
            });

            results[assetName] = sesItem?.imageUrl || null;
        }

        return NextResponse.json({ images: results });
    } catch (err) {
        console.error("[POST Library Images ERROR]", err);
        return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
    }
}