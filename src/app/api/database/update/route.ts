// app/api/database/update/route.ts
// API สำหรับ Admin แก้ไขข้อมูลใน AssetTransactionHistory

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ✅ คอลัมน์ที่อนุญาตให้แก้ไข (ไม่กระทบระบบ)
const EDITABLE_FIELDS = [
  "assetName",
  "size",
  "grade",
  "toVendor",
  "fromVendor",
  "toShop",
  "fromShop",
  "mcsCodeOut",
  "mcsCodeIn",
  "remarkIn",
  "remarkOut",
  "status",
  "shopType",
  "cheilPO",
  "startWarranty",
  "endWarranty",
  "wkOut",
  "wkIn",
  "wkOutForRepair",
  "wkInForRepair",
];

interface UpdateItem {
  id: number;
  [key: string]: any;
}

export async function PUT(req: NextRequest) {
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

    // 3. รับข้อมูลจาก body
    const body = await req.json();
    const { updates } = body as { updates: UpdateItem[] };

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, message: "No updates provided" },
        { status: 400 }
      );
    }

    // 4. Validate และ filter เฉพาะ field ที่อนุญาต
    const validUpdates = updates.map((item) => {
      const { id, ...fields } = item;
      const filteredFields: Record<string, any> = {};

      for (const [key, value] of Object.entries(fields)) {
        if (EDITABLE_FIELDS.includes(key)) {
          // แปลง "-" กลับเป็น null หรือ ""
          filteredFields[key] = value === "-" ? null : value;
        }
      }

      return { id, data: filteredFields };
    });

    // 5. Update ทีละรายการ (ใช้ transaction)
    const results = await prisma.$transaction(
      validUpdates.map((item) =>
        prisma.assetTransactionHistory.update({
          where: { id: item.id },
          data: item.data,
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: `อัปเดตข้อมูลสำเร็จ ${results.length} รายการ`,
      updatedCount: results.length,
    });
  } catch (error) {
    console.error("Error updating database:", error);
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
