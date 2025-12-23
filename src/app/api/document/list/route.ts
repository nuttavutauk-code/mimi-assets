import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ประเภทเอกสารที่ต้อง Pick Asset
const NEEDS_PICK_ASSET_TYPES = [
  "withdraw",
  "routing2shops",
  "routing3shops",
  "routing4shops",
  "withdrawother",
  "transfer",
  "borrowsecurity",
  "borrow",
];

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // ✅ ดึง query parameters
    const { searchParams } = new URL(req.url);
    const docCode = searchParams.get("docCode")?.trim() || "";
    const vendor = searchParams.get("vendor")?.trim() || "";
    const documentType = searchParams.get("documentType")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    // ✅ กำหนด where เงื่อนไข
    const where: Prisma.DocumentWhereInput = {
      createdById: user.id,
      AND: [
        docCode ? { docCode: { contains: docCode, mode: Prisma.QueryMode.insensitive } } : {},
        vendor ? { company: { contains: vendor, mode: Prisma.QueryMode.insensitive } } : {},
        documentType ? { documentType: { equals: documentType } } : {},
        status ? { status: { equals: status } } : {},
      ],
    };

    // ✅ ดึงข้อมูลพร้อม PickAssetTask
    const [documents, totalCount] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          pickTasks: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      prisma.document.count({ where }),
    ]);

    // ✅ คำนวณ pickAssetStatus
    const documentsWithPickStatus = documents.map((doc) => {
      let pickAssetStatus = "-";

      // เช็คว่าเป็นประเภทที่ต้อง Pick Asset และอนุมัติแล้ว
      if (NEEDS_PICK_ASSET_TYPES.includes(doc.documentType) && doc.status === "approved") {
        const tasks = doc.pickTasks || [];
        
        if (tasks.length === 0) {
          pickAssetStatus = "-";
        } else {
          // เช็คว่ามี task ที่ยังไม่เสร็จหรือไม่
          const hasPendingOrPicking = tasks.some(
            (t) => t.status === "pending" || t.status === "picking"
          );

          if (hasPendingOrPicking) {
            pickAssetStatus = "processing"; // อยู่ระหว่างดำเนินการ
          } else {
            pickAssetStatus = "completed"; // เสร็จสิ้น
          }
        }
      }

      // ลบ pickTasks ออกจาก response (ไม่ต้องส่งไป frontend)
      const { pickTasks, ...docWithoutTasks } = doc;

      return {
        ...docWithoutTasks,
        pickAssetStatus,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      documents: documentsWithPickStatus,
      totalPages,
      totalCount,
      page,
      limit,
    });
  } catch (error) {
    console.error("[DOCUMENT LIST ERROR]", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}