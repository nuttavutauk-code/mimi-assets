// app/api/asset/update-nobarcode/route.ts
// API สำหรับแก้ไขข้อมูล Asset ที่มีสถานะ NO Barcode
// เมื่อแก้ไขแล้ว Status จะเปลี่ยนเป็น Ready

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  try {
    // 1. เช็ค Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // 2. เช็คว่าเป็น Admin
    const role = (session.user as any)?.role?.toUpperCase();
    if (role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden - Admin only" }, { status: 403 });
    }

    // 3. รับข้อมูลจาก body
    const { id, barcode, assetName, size, warehouse, startWarranty, endWarranty, cheilPO } = await req.json();

    if (!id || !barcode) {
      return NextResponse.json({ success: false, message: "Missing id or barcode" }, { status: 400 });
    }

    // 4. หา Asset
    const asset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      return NextResponse.json({ success: false, message: "Asset not found" }, { status: 404 });
    }

    // 5. เช็คว่าเป็นสถานะ NO Barcode หรือไม่
    if (asset.statusAsset !== "NO Barcode") {
      return NextResponse.json({ success: false, message: "Can only edit assets with 'NO Barcode' status" }, { status: 400 });
    }

    // 6. เช็คว่า barcode ใหม่ซ้ำกับที่มีอยู่หรือไม่
    const newBarcode = barcode.trim();
    if (newBarcode !== asset.barcode) {
      const existingAsset = await prisma.asset.findUnique({
        where: { barcode: newBarcode },
      });

      if (existingAsset) {
        return NextResponse.json({ success: false, message: "Barcode นี้มีอยู่ในระบบแล้ว" }, { status: 400 });
      }
    }

    // 7. เก็บ barcode เดิมเพื่ออัปเดต transaction
    const oldBarcode = asset.barcode;

    // 8. อัปเดต Asset (เปลี่ยนข้อมูลและ status เป็น Ready)
    await prisma.asset.update({
      where: { id },
      data: {
        barcode: newBarcode,
        assetName: assetName || null,
        size: size || null,
        warehouse: warehouse || null,
        startWarranty: startWarranty || null,
        endWarranty: endWarranty || null,
        cheilPO: cheilPO || null,
        statusAsset: "Ready", // ✅ เปลี่ยนเป็น Ready เมื่อแก้ไข
      },
    });

    // 9. อัปเดต AssetTransactionHistory ที่มี barcode เดิม
    if (oldBarcode !== newBarcode) {
      await prisma.assetTransactionHistory.updateMany({
        where: { barcode: oldBarcode },
        data: { barcode: newBarcode },
      });
    }

    return NextResponse.json({
      success: true,
      message: "อัปเดตข้อมูลสำเร็จ",
      oldBarcode,
      newBarcode,
    });
  } catch (error) {
    console.error("[UPDATE NOBARCODE ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}