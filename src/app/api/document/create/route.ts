import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const {
      documentType,
      docCode,
      fullName,
      company,
      phone,
      shops,
      note,
      status,
      operation,
      otherDetail,
      returnCondition, // ✅ เพิ่มเงื่อนไขการเก็บกลับ
      borrowType, // ✅ ประเภทการยืม
    } = data;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }
    console.log(data);


    const document = await prisma.document.create({
      data: {
        documentType,
        docCode,
        createdById: user.id,
        fullName,
        company,
        phone,
        note,
        status: status || "draft",
        operation: operation || null,
        otherDetail: otherDetail || null,
        returnCondition: returnCondition || null, // ✅ เพิ่มเงื่อนไขการเก็บกลับ
        borrowType: borrowType || null, // ✅ ประเภทการยืม

        shops: {
          create: shops.map((shop: any) => ({
            shopCode: shop.shopCode || null,
            shopName: shop.shopName || null,
            startInstallDate: shop.startInstallDate ? new Date(shop.startInstallDate) : null,
            endInstallDate: shop.endInstallDate ? new Date(shop.endInstallDate) : null,
            q7b7: shop.q7b7 || null,
            shopFocus: shop.shopFocus || null,
            assets: {
              create: (shop.assets || []).map((a: any) => ({
                name: a.name,
                size: a.size || null,
                kv: a.kv || null,
                qty: Number(a.qty) || 0,
                withdrawFor: a.withdrawFor || null,
                barcode: a.barcode || null,
                grade: a.grade || null,
              })),
            },
            securitySets: {
              create: (shop.securitySets || []).map((s: any) => ({
                name: s.name,
                qty: Number(s.qty) || 0,
                withdrawFor: s.withdrawFor || null,
                barcode: s.barcode || null, // ✅ เพิ่ม barcode สำหรับ CONTROLBOX
              })),
            },
          })),
        },
      },
      include: {
        shops: {
          include: {
            assets: true,
            securitySets: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, document });
  } catch (error: any) {
    console.error("[CREATE DOCUMENT ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Server error", error: String(error.message || error) },
      { status: 500 }
    );
  }
}