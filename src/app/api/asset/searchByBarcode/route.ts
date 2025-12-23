import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // ✅ ใช้ Singleton ป้องกันการสร้าง client ซ้ำ
import { requireAuth } from "@/lib/auth-helpers";

// 🔹 รองรับ GET /api/asset/searchByBarcode?query=A0&balanceFilter=0|1&warehouse=NEWLOOK&mcsCode=XXX
// balanceFilter: 
//   - 0 = แสดงเฉพาะ Barcode ที่มี Balance = 0 (ของออกไปแล้ว) → สำหรับ Return Asset, Shop to Shop
//   - 1 = แสดงเฉพาะ Barcode ที่มี Balance = 1 (ของอยู่ในโกดัง) → สำหรับ Transfer, Withdraw, Repair
//   - ไม่ส่ง = แสดงทั้งหมด (เหมือนเดิม)
// warehouse: filter ตาม warehouseIn ใน Transaction
// mcsCode: filter ตาม mcsCodeOut ใน Transaction (สำหรับ Shop to Shop)
export async function GET(req: Request) {
  try {
    // เช็ค Authentication
    const auth = await requireAuth();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("query") || "").trim();
    const balanceFilter = searchParams.get("balanceFilter"); // "0" หรือ "1" หรือ null
    const warehouse = searchParams.get("warehouse"); // Vendor ของ User
    const mcsCode = searchParams.get("mcsCode"); // MCS Code ของ Shop ต้นทาง (สำหรับ Shop to Shop)

    // ✅ ถ้ามี mcsCode → ค้นหา Barcode ที่อยู่ใน Shop นั้น (ไม่ต้องมี query)
    if (mcsCode) {
      // หา Barcode ทั้งหมดที่อยู่ใน Shop นี้ (Balance = 0 และ mcsCodeOut = mcsCode)
      const transactions = await prisma.assetTransactionHistory.findMany({
        where: {
          mcsCodeOut: mcsCode,
          balance: 0,
          ...(query ? { barcode: { startsWith: query, mode: "insensitive" } } : {}),
        },
        select: {
          barcode: true,
          assetName: true,
          size: true,
        },
        orderBy: { id: "desc" },
        take: 50,
      });

      // กรอง duplicate barcode (เอาเฉพาะ transaction ล่าสุดของแต่ละ barcode)
      const uniqueBarcodes = new Map<string, { barcode: string; assetName: string; size: string | null }>();
      for (const t of transactions) {
        if (!uniqueBarcodes.has(t.barcode)) {
          uniqueBarcodes.set(t.barcode, { barcode: t.barcode, assetName: t.assetName, size: t.size });
        }
      }

      return NextResponse.json({ assets: Array.from(uniqueBarcodes.values()).slice(0, 20) }, { status: 200 });
    }

    // ✅ ถ้ามี warehouse + balanceFilter=1 → ค้นหา Barcode ที่อยู่ในโกดังนั้น (ไม่ต้องมี query)
    if (warehouse && balanceFilter === "1") {
      const transactions = await prisma.assetTransactionHistory.findMany({
        where: {
          warehouseIn: warehouse,
          balance: 1,
          ...(query ? { barcode: { startsWith: query, mode: "insensitive" } } : {}),
        },
        select: {
          barcode: true,
          assetName: true,
          size: true,
        },
        orderBy: { id: "desc" },
        take: 50,
      });

      // กรอง duplicate barcode (เอาเฉพาะ transaction ล่าสุดของแต่ละ barcode)
      const uniqueBarcodes = new Map<string, { barcode: string; assetName: string; size: string | null }>();
      for (const t of transactions) {
        if (!uniqueBarcodes.has(t.barcode)) {
          uniqueBarcodes.set(t.barcode, { barcode: t.barcode, assetName: t.assetName, size: t.size });
        }
      }

      return NextResponse.json({ assets: Array.from(uniqueBarcodes.values()).slice(0, 20) }, { status: 200 });
    }

    // ✅ ถ้ามี balanceFilter=0 → ค้นหา Barcode ที่ออกไปแล้ว (สำหรับ Return Asset)
    if (balanceFilter === "0") {
      const transactions = await prisma.assetTransactionHistory.findMany({
        where: {
          balance: 0,
          ...(query ? { barcode: { startsWith: query, mode: "insensitive" } } : {}),
        },
        select: {
          barcode: true,
          assetName: true,
          size: true,
        },
        orderBy: { id: "desc" },
        take: 50,
      });

      // กรอง duplicate barcode (เอาเฉพาะ transaction ล่าสุดของแต่ละ barcode)
      const uniqueBarcodes = new Map<string, { barcode: string; assetName: string; size: string | null }>();
      for (const t of transactions) {
        if (!uniqueBarcodes.has(t.barcode)) {
          uniqueBarcodes.set(t.barcode, { barcode: t.barcode, assetName: t.assetName, size: t.size });
        }
      }

      return NextResponse.json({ assets: Array.from(uniqueBarcodes.values()).slice(0, 20) }, { status: 200 });
    }

    // ✅ ถ้า query ว่าง และไม่มี filter พิเศษ → ไม่ต้อง query DB
    if (!query) {
      return NextResponse.json({ assets: [] }, { status: 200 });
    }

    // ✅ ใช้ startsWith เพื่อให้ใช้ index ได้เต็มที่
    const assets = await prisma.asset.findMany({
      where: {
        barcode: {
          startsWith: query,
          mode: "insensitive",
        },
      },
      select: {
        barcode: true,
        assetName: true,
        size: true,
      },
      orderBy: { barcode: "asc" },
      take: 50, // ดึงมากขึ้นเพราะจะ filter อีกที
    });

    // ✅ ถ้าไม่มี balanceFilter → คืนค่าทั้งหมด (เหมือนเดิม)
    if (balanceFilter === null || balanceFilter === undefined || balanceFilter === "") {
      return NextResponse.json({ assets: assets.slice(0, 20) }, { status: 200 });
    }

    // ✅ Filter ตาม Balance และ Warehouse
    const targetBalance = parseInt(balanceFilter);
    const filteredAssets: typeof assets = [];

    for (const asset of assets) {
      // หา Transaction ล่าสุดของ Barcode นี้
      const latestTransaction = await prisma.assetTransactionHistory.findFirst({
        where: { barcode: asset.barcode },
        orderBy: { id: "desc" },
        select: { balance: true, warehouseIn: true },
      });

      if (targetBalance === 1) {
        // Balance = 1: ของอยู่ในโกดัง
        // ✅ ต้องมี Transaction และ Balance = 1 และ warehouseIn ตรงกับ warehouse ที่ส่งมา
        if (latestTransaction && latestTransaction.balance === 1) {
          // ถ้าส่ง warehouse มา → filter ตาม warehouseIn
          if (warehouse) {
            if (latestTransaction.warehouseIn === warehouse) {
              filteredAssets.push(asset);
            }
          } else {
            // ไม่ส่ง warehouse → แสดงทั้งหมดที่ Balance = 1
            filteredAssets.push(asset);
          }
        }
      } else if (targetBalance === 0) {
        // Balance = 0: ของออกไปแล้ว
        // ต้องมี Transaction และ Balance = 0
        if (latestTransaction && latestTransaction.balance === 0) {
          filteredAssets.push(asset);
        }
      }

      // หยุดถ้าได้ครบ 20 แล้ว
      if (filteredAssets.length >= 20) break;
    }

    return NextResponse.json({ assets: filteredAssets }, { status: 200 });
  } catch (error) {
    console.error("Error in searchByBarcode:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
