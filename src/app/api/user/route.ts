import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { writeAuditLog, AuditAction, getSessionUser } from "@/lib/audit-log";

// ===== Helper: ตรวจสอบ Admin =====
async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: "Unauthorized", status: 401 };
  }
  if (session.user.role !== "ADMIN") {
    return { error: "Forbidden: Admin only", status: 403 };
  }
  return null;
}

/* ===========================================================
   [ GET USERS - ดึงข้อมูลผู้ใช้ทั้งหมดแบบแบ่งหน้า ]
   Endpoint: GET /api/user?page=1&limit=10&search=xxx
   =========================================================== */
export async function GET(req: Request) {
  try {
    // เช็ค Admin
    const authError = await checkAdminAuth();
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status });
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 10;
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    // สร้าง where clause สำหรับ search
    const whereClause = search.trim()
      ? {
          OR: [
            { username: { contains: search, mode: "insensitive" as const } },
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { company: { contains: search, mode: "insensitive" as const } },
            { vendor: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          vendor: true,
          initials: true,
          company: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data: users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[GET USERS ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

/* ===========================================================
   [ CREATE USER - สร้างผู้ใช้ใหม่ ]
   Endpoint: POST /api/user
   =========================================================== */
export async function POST(req: Request) {
  try {
    // เช็ค Admin
    const authError = await checkAdminAuth();
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status });
    }

    const body = await req.json();

    if (!body.username || !body.password) {
      return NextResponse.json(
        { error: "Missing required fields (username, password)" },
        { status: 400 }
      );
    }

    // ตรวจสอบว่า username ซ้ำไหม
    const existingUser = await prisma.user.findUnique({
      where: { username: body.username },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(body.password, 10);

    // ✅ ถ้าไม่ได้ใส่ initials จะสร้างจากชื่อจริงอัตโนมัติ
    const autoInitials =
      body.initials ||
      ((body.firstName?.[0] || "") + (body.lastName?.[0] || "")).toUpperCase();

    const newUser = await prisma.user.create({
      data: {
        username: body.username,
        email: body.email,
        password: hashedPassword,
        firstName: body.firstName || "",
        lastName: body.lastName || "",
        vendor: body.vendor || "",
        initials: autoInitials, // ✅ เพิ่มการเก็บชื่อย่อ
        company: body.company || "",
        phone: body.phone || "",
        role: body.role || "USER",
      },
    });

    const { password, ...result } = newUser;
    const session = await getServerSession(authOptions);
    const { userId, username, userRole } = getSessionUser(session ?? {});
    await writeAuditLog({ userId, username, userRole, action: AuditAction.USER_CREATE, entity: "User", entityId: String(newUser.id), detail: { targetUsername: newUser.username, role: newUser.role }, req });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[CREATE USER ERROR]", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

/* ===========================================================
   [ UPDATE USER - แก้ไขข้อมูลผู้ใช้ ]
   Endpoint: PUT /api/user?id=3
   =========================================================== */
export async function PUT(req: Request) {
  try {
    // เช็ค Admin
    const authError = await checkAdminAuth();
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const body = await req.json();

    // เข้ารหัส password ถ้ามีส่งมา
    if (body.password) {
      body.password = await bcrypt.hash(body.password, 10);
    } else {
      delete body.password;
    }

    // ✅ สร้าง initials อัตโนมัติ ถ้าไม่ได้ส่งมา
    if (!body.initials) {
      body.initials =
        ((body.firstName?.[0] || "") + (body.lastName?.[0] || "")).toUpperCase();
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: body,
    });

    const { password, ...result } = updatedUser;
    const session = await getServerSession(authOptions);
    const { userId, username, userRole } = getSessionUser(session ?? {});
    await writeAuditLog({ userId, username, userRole, action: AuditAction.USER_UPDATE, entity: "User", entityId: id, detail: { targetUsername: updatedUser.username }, req });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[UPDATE USER ERROR]", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/* ===========================================================
   [ DELETE USER - ลบผู้ใช้ ]
   Endpoint: DELETE /api/user?id=3
   =========================================================== */
export async function DELETE(req: Request) {
  try {
    // เช็ค Admin
    const authError = await checkAdminAuth();
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: Number(id) } });
    const session = await getServerSession(authOptions);
    const { userId, username, userRole } = getSessionUser(session ?? {});
    await writeAuditLog({ userId, username, userRole, action: AuditAction.USER_DELETE, entity: "User", entityId: id!, detail: { targetId: id }, req });
    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("[DELETE USER ERROR]", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

/* ===========================================================
   [ TOGGLE USER STATUS - เปิด/ปิดการใช้งานผู้ใช้ ]
   Endpoint: PATCH /api/user?id=3
   =========================================================== */
export async function PATCH(req: Request) {
  try {
    // เช็ค Admin
    const authError = await checkAdminAuth();
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // ดึงสถานะปัจจุบัน
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: { isActive: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Toggle สถานะ
    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        username: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      message: updatedUser.isActive ? "เปิดใช้งานผู้ใช้แล้ว" : "ปิดใช้งานผู้ใช้แล้ว",
      user: updatedUser,
    });
  } catch (error) {
    console.error("[TOGGLE USER STATUS ERROR]", error);
    return NextResponse.json({ error: "Failed to toggle user status" }, { status: 500 });
  }
}