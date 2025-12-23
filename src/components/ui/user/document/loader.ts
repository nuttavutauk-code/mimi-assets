'use server'

import { prisma } from "@/lib/prisma";

export const getMe = async (email: string) => {
  try {
    if (!email) {
      return { status: 500, error: "Unauthorized" }
    }

    const user = await prisma.user.findUnique({
      where: { email },
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