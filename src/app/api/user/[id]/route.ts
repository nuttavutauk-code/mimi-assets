import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
   [ GET USER BY ID - ดึงข้อมูลผู้ใช้ตาม ID ]
   Endpoint: GET /api/user/[id]
   =========================================================== */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authError = await checkAdminAuth();
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status });
    }

    const id = Number(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
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
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[GET USER ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

/* ===========================================================
   [ UPDATE USER - แก้ไขข้อมูลผู้ใช้ ]
   Endpoint: PUT /api/user/[id]
   =========================================================== */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authError = await checkAdminAuth();
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status });
    }

    const id = Number(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const body = await req.json();

    // เข้ารหัส password ถ้ามีส่งมา
    if (body.password) {
      body.password = await bcrypt.hash(body.password, 10);
    } else {
      delete body.password;
    }

    // สร้าง initials อัตโนมัติ ถ้าไม่ได้ส่งมา
    if (!body.initials) {
      body.initials =
        ((body.firstName?.[0] || "") + (body.lastName?.[0] || "")).toUpperCase();
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: body,
    });

    const { password, ...result } = updatedUser;
    return NextResponse.json(result);
  } catch (error) {
    console.error("[UPDATE USER ERROR]", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/* ===========================================================
   [ DELETE USER - ลบผู้ใช้ ]
   Endpoint: DELETE /api/user/[id]
   =========================================================== */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authError = await checkAdminAuth();
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status });
    }

    const id = Number(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("[DELETE USER ERROR]", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
