import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;

    // ===== Public Routes (ไม่ต้อง login) =====
    const publicPaths = [
        "/login",
        "/api/auth", // NextAuth routes - สำคัญมาก!
        "/api/library/get-image", // สำหรับ preview document pages
    ];

    // เช็คว่าเป็น public path หรือไม่
    const isPublicPath = publicPaths.some(p => path.startsWith(p));
    
    // Preview pages ไม่ต้อง login
    const isPreviewPage = path.startsWith("/preview-document");
    
    // Root path redirect ไป login
    if (path === "/") {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    // Public paths ผ่านได้เลย
    if (isPublicPath || isPreviewPage) {
        return NextResponse.next();
    }

    // ===== Protected Routes - ต้อง login =====
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    // ถ้าไม่มี token และพยายามเข้า protected route
    if (!token) {
        // API routes return 401
        if (path.startsWith("/api/")) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }
        // Pages redirect to login
        return NextResponse.redirect(new URL("/login", req.url));
    }

    // ===== Admin-only Routes =====
    const adminOnlyPaths = [
        "/api/user",
        "/api/asset/import",
        "/api/asset/export",
        "/api/shop/import",
        "/api/shop/export",
        "/api/database",
        "/api/document/delete",
        "/api/document/approve",
        "/api/library/ses/import",
        "/api/library/sis/import",
    ];

    const isAdminPath = adminOnlyPaths.some(p => path.startsWith(p));
    const isAdminPage = path.startsWith("/dashboard/admin-");

    if ((isAdminPath || isAdminPage) && token.role !== "ADMIN") {
        if (path.startsWith("/api/")) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Admin only" },
                { status: 403 }
            );
        }
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
}

// ===== กำหนด routes ที่ middleware จะทำงาน =====
export const config = {
    matcher: [
        // Root
        "/",
        // API routes
        "/api/:path*",
        // Dashboard routes
        "/dashboard/:path*",
    ],
};