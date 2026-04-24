// ============================================================
// 📁 ไฟล์ที่ 3: src/app/api/document/update/[id]/route.ts
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog, AuditAction, getSessionUser } from "@/lib/audit-log";

// ✅ Next.js 15: params เป็น Promise
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

        // ✅ Next.js 15: ต้อง await params
        const { id } = await params;
        const documentId = parseInt(id);
        const body = await req.json();

        const {
            documentType,
            docCode,
            fullName,
            company,
            phone,
            note,
            status,
            shops,
            returnCondition, // ✅ เพิ่มเงื่อนไขการเก็บกลับ
            operation, // ✅ ประเภทการย้าย (Transfer)
            otherDetail, // ✅ รายละเอียดอื่นๆ (Transfer)
            borrowType, // ✅ ประเภทการยืม (Borrow)
            transactionStatus, // ✅ Status ที่ Admin เลือก (18 ค่า)
        } = body;

        console.log("📝 Updating document:", documentId);
        console.log("📦 Payload:", JSON.stringify(body, null, 2));

        // ✅ 1. ลบข้อมูล shops เก่าทั้งหมด (จะลบ assets และ securitySets ตาม cascade)
        await prisma.documentShop.deleteMany({
            where: { documentId },
        });

        // ✅ 2. อัปเดต Document พร้อมสร้าง shops ใหม่
        const updatedDocument = await prisma.document.update({
            where: { id: documentId },
            data: {
                documentType,
                docCode,
                fullName,
                company,
                phone: phone || null,
                note: note || null,
                status: status || "submitted",
                returnCondition: returnCondition || undefined, // ✅ เพิ่มเงื่อนไขการเก็บกลับ
                operation: operation || null, // ✅ ประเภทการย้าย
                otherDetail: otherDetail || null, // ✅ รายละเอียดอื่นๆ
                borrowType: borrowType || null, // ✅ ประเภทการยืม
                transactionStatus: transactionStatus || null, // ✅ Status ที่ Admin เลือก

                shops: {
                    create: shops.map((shop: any) => ({
                        shopCode: shop.shopCode || null,
                        shopName: shop.shopName || null,
                        startInstallDate: shop.startInstallDate
                            ? new Date(shop.startInstallDate)
                            : null,
                        endInstallDate: shop.endInstallDate
                            ? new Date(shop.endInstallDate)
                            : null,
                        q7b7: shop.q7b7 || null,
                        shopFocus: shop.shopFocus || null,

                        assets: {
                            create: (shop.assets || []).map((asset: any) => ({
                                barcode: asset.barcode || null, // ✅ เพิ่ม barcode
                                name: asset.name,
                                size: asset.size || null,
                                grade: asset.grade || null, // ✅ เพิ่ม grade
                                kv: asset.kv || null,
                                qty: asset.qty || 0,
                                withdrawFor: asset.withdrawFor || null,
                            })),
                        },

                        securitySets: {
                            create: (shop.securitySets || []).map((security: any) => ({
                                name: security.name,
                                qty: security.qty || 0,
                                withdrawFor: security.withdrawFor || null,
                                barcode: security.barcode || null, // ✅ เพิ่ม barcode สำหรับ CONTROLBOX
                            })),
                        },
                    })),
                },
            },
            include: {
                shops: {
                    select: {
                        id: true,
                        shopCode: true,
                        shopName: true,
                        startInstallDate: true,
                        endInstallDate: true,
                        q7b7: true,
                        shopFocus: true,
                        assets: true,
                        securitySets: true,
                    },
                },
            },
        });

        console.log("✅ Document updated successfully:", updatedDocument.id);

        // ✅ 3. ถ้า status = "approved" → สร้าง Pick Asset Tasks
        if (status === "approved") {
            console.log("🎯 Creating Pick Asset Tasks...");

            // ลบ Pick Tasks เก่าทั้งหมดของเอกสารนี้ (ถ้ามี)
            await prisma.pickAssetTask.deleteMany({
                where: { documentId: updatedDocument.id },
            });

            for (const shop of updatedDocument.shops) {
                // สร้าง Task สำหรับ Assets
                for (const asset of shop.assets) {
                    await prisma.pickAssetTask.create({
                        data: {
                            documentId: updatedDocument.id,
                            assetName: asset.name,
                            size: asset.size,
                            grade: null,
                            qty: asset.qty,
                            isSecuritySet: false,
                            warehouse: asset.withdrawFor || "Unknown",
                            shopCode: shop.shopCode,
                            shopName: shop.shopName,
                            startInstallDate: shop.startInstallDate,
                            endInstallDate: shop.endInstallDate,
                            q7b7: shop.q7b7,
                            shopFocus: shop.shopFocus,
                            requesterName: fullName,
                            requesterCompany: company,
                            requesterPhone: phone,
                            status: "pending",
                        },
                    });
                }

                // สร้าง Task สำหรับ Security Sets (เฉพาะที่ qty > 0)
                for (const security of shop.securitySets) {
                    // ✅ เช็คว่า qty > 0 ก่อนสร้าง Task
                    if (security.qty > 0) {
                        await prisma.pickAssetTask.create({
                            data: {
                                documentId: updatedDocument.id,
                                assetName: security.name,
                                size: null,
                                grade: null,
                                qty: security.qty,
                                isSecuritySet: true,
                                warehouse: security.withdrawFor || "Unknown",
                                shopCode: shop.shopCode,
                                shopName: shop.shopName,
                                startInstallDate: shop.startInstallDate,
                                endInstallDate: shop.endInstallDate,
                                q7b7: shop.q7b7,
                                shopFocus: shop.shopFocus,
                                requesterName: fullName,
                                requesterCompany: company,
                                requesterPhone: phone,
                                status: "pending",
                            },
                        });
                    }
                }
            }

            console.log("✅ Pick Asset Tasks created successfully");
        }

        const { userId, username, userRole } = getSessionUser(session);
        await writeAuditLog({ userId, username, userRole, action: AuditAction.DOCUMENT_UPDATE, entity: "Document", entityId: String(documentId), detail: { docCode: updatedDocument.docCode, documentType: updatedDocument.documentType, status: updatedDocument.status }, req });

        return NextResponse.json({
            success: true,
            message: "อัปเดตเอกสารสำเร็จ",
            document: updatedDocument,
        });
    } catch (error: any) {
        console.error("[UPDATE DOCUMENT ERROR]", error);
        return NextResponse.json(
            {
                success: false,
                message: error.message || "เกิดข้อผิดพลาดในการอัปเดตเอกสาร",
            },
            { status: 500 }
        );
    }
}