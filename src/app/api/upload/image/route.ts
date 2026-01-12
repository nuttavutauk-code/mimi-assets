import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

// ✅ Storage Type: "local" หรือ "s3" (อนาคต)
const STORAGE_TYPE = process.env.STORAGE_TYPE || "local";

// ✅ รายชื่อนามสกุลไฟล์ที่อนุญาต
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

// ✅ ขนาดไฟล์สูงสุด (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
    try {
        // 1. เช็ค Authentication
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. รับ FormData
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const imageType = formData.get("imageType") as string; // "barcode" | "asset" | "doc" | "transfer-asset"
        const taskId = formData.get("taskId") as string;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // 3. ตรวจสอบนามสกุลไฟล์
        const ext = path.extname(file.name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return NextResponse.json(
                { error: `ไม่รองรับนามสกุลไฟล์ ${ext}` },
                { status: 400 }
            );
        }

        // 4. ตรวจสอบขนาดไฟล์
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: "ไฟล์ใหญ่เกิน 10MB" },
                { status: 400 }
            );
        }

        // 5. สร้างชื่อไฟล์ unique
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        
        // ✅ กำหนด folder และ filename ตาม imageType
        let folder = "general";
        let filenamePrefix = "img";
        
        if (imageType === "barcode" || imageType === "asset") {
            // Pick Asset images
            folder = `pick-assets/${imageType}`;
            filenamePrefix = taskId || "unknown";
        } else if (imageType === "doc" || imageType === "transfer-asset") {
            // Receive Transfer images
            folder = `receive-transfer/${imageType === "doc" ? "documents" : "assets"}`;
            filenamePrefix = taskId || "unknown";
        }
        
        const filename = `${filenamePrefix}_${timestamp}_${randomStr}${ext}`;

        let imageUrl: string;

        if (STORAGE_TYPE === "s3") {
            // ===== S3 Upload (อนาคต) =====
            return NextResponse.json(
                { error: "S3 upload not implemented yet" },
                { status: 501 }
            );
        } else {
            // ===== Local Storage =====
            const uploadDir = path.join(
                process.cwd(),
                "public",
                "uploads",
                folder
            );

            // สร้าง directory ถ้ายังไม่มี
            await mkdir(uploadDir, { recursive: true });

            // บันทึกไฟล์
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const filePath = path.join(uploadDir, filename);

            await writeFile(filePath, buffer);

            imageUrl = `/uploads/${folder}/${filename}`;
        }

        return NextResponse.json({
            success: true,
            url: imageUrl, // ✅ เพิ่ม url สำหรับ receive-transfer
            imageUrl,
            filename,
            message: "อัปโหลดรูปสำเร็จ",
        });
    } catch (error) {
        console.error("[UPLOAD_IMAGE_ERROR]", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการอัปโหลด" },
            { status: 500 }
        );
    }
}