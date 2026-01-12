import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// ✅ Config: ปิด bodyParser เพื่อรับ FormData
export const dynamic = "force-dynamic";

// ✅ รายชื่อนามสกุลไฟล์ที่อนุญาต
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

// ✅ ขนาดไฟล์สูงสุด (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
    try {
        // 1. เช็ค Authentication
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. เช็คว่าเป็น Admin
        const role = (session.user as any)?.role?.toUpperCase();
        if (role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
        }

        // 3. รับ FormData
        const formData = await req.formData();
        const files = formData.getAll("images") as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
        }

        // 4. สร้าง upload directory ถ้ายังไม่มี
        const uploadDir = path.join(process.cwd(), "public", "uploads", "ses");
        await mkdir(uploadDir, { recursive: true });

        // 5. ดึงข้อมูล Library SES ทั้งหมดเพื่อ matching ด้วย assetName
        const allRecords = await prisma.librarySES.findMany({
            select: { id: true, assetName: true },
        });

        // สร้าง lookup map ด้วย assetName
        const assetNameMap = new Map<string, number>();

        allRecords.forEach((record) => {
            if (record.assetName) {
                // ใช้ชื่อแบบ lowercase และ trim เพื่อ match ได้ง่ายขึ้น
                assetNameMap.set(record.assetName.toLowerCase().trim(), record.id);
            }
        });

        // 6. ประมวลผลแต่ละไฟล์
        const results: {
            filename: string;
            status: "success" | "not_found" | "error";
            message: string;
            matchedBy?: string;
            matchedValue?: string;
        }[] = [];

        let successCount = 0;
        let notFoundCount = 0;
        let errorCount = 0;

        for (const file of files) {
            const filename = file.name;
            const ext = path.extname(filename).toLowerCase();
            const nameWithoutExt = path.basename(filename, ext).trim();

            // ตรวจสอบนามสกุลไฟล์
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                results.push({
                    filename,
                    status: "error",
                    message: `ไม่รองรับนามสกุลไฟล์ ${ext}`,
                });
                errorCount++;
                continue;
            }

            // ตรวจสอบขนาดไฟล์
            if (file.size > MAX_FILE_SIZE) {
                results.push({
                    filename,
                    status: "error",
                    message: `ไฟล์ใหญ่เกิน 5MB`,
                });
                errorCount++;
                continue;
            }

            // หา matching record ด้วย assetName
            let recordId: number | undefined;
            let matchedValue: string | undefined;

            if (assetNameMap.has(nameWithoutExt.toLowerCase())) {
                recordId = assetNameMap.get(nameWithoutExt.toLowerCase());
                matchedValue = nameWithoutExt;
            }

            if (!recordId) {
                results.push({
                    filename,
                    status: "not_found",
                    message: `ไม่พบ ASSET NAME "${nameWithoutExt}" ในระบบ`,
                });
                notFoundCount++;
                continue;
            }

            try {
                // บันทึกไฟล์
                const bytes = await file.arrayBuffer();
                const buffer = Buffer.from(bytes);

                // ใช้ชื่อไฟล์เดิม
                const savedFilename = `${nameWithoutExt}${ext}`;
                const filePath = path.join(uploadDir, savedFilename);

                await writeFile(filePath, buffer);

                // อัปเดต URL ใน Database
                const imageUrl = `/uploads/ses/${savedFilename}`;
                await prisma.librarySES.update({
                    where: { id: recordId },
                    data: { imageUrl },
                });

                results.push({
                    filename,
                    status: "success",
                    message: `อัปโหลดสำเร็จ`,
                    matchedBy: "assetName",
                    matchedValue,
                });
                successCount++;
            } catch (err) {
                console.error(`Error saving file ${filename}:`, err);
                results.push({
                    filename,
                    status: "error",
                    message: `เกิดข้อผิดพลาดในการบันทึกไฟล์`,
                });
                errorCount++;
            }
        }

        // 7. สรุปผล
        return NextResponse.json({
            success: true,
            message: `อัปโหลดสำเร็จ ${successCount} ไฟล์ | ไม่พบข้อมูล ${notFoundCount} ไฟล์ | ผิดพลาด ${errorCount} ไฟล์`,
            summary: {
                total: files.length,
                success: successCount,
                notFound: notFoundCount,
                error: errorCount,
            },
            results,
        });
    } catch (error) {
        console.error("[UPLOAD_IMAGES_ERROR]", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการอัปโหลด" },
            { status: 500 }
        );
    }
}