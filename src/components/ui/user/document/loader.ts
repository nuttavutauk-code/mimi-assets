'use server'

import { prisma } from "@/lib/prisma";

export const getMe = async (userId: string) => {
  try {
    const id = Number(userId);
    if (!userId || Number.isNaN(id)) {
      return { status: 500, error: "Unauthorized" }
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        company: true,
        phone: true,
        initials: true,
        vendor: true,
      },
    });

    if (!user) {
      return { status: 500, error: "User not found" }
    }

    return { user, status: 200 }
  } catch (err) {
    console.error("[GET_USER_ME_ERROR]", err);
    return { status: 500, error: "Server error" }
  }
}