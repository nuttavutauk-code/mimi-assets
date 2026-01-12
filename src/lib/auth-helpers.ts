import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export type AuthResult = {
  session: any;
  response?: never;
} | {
  session?: never;
  response: NextResponse;
};

/**
 * ตรวจสอบว่า user login แล้วหรือยัง
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return {
      response: NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  
  return { session };
}

/**
 * ตรวจสอบว่าเป็น Admin หรือไม่
 */
export async function requireAdmin(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return {
      response: NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  
  if (session.user.role !== "ADMIN") {
    return {
      response: NextResponse.json(
        { success: false, message: "Forbidden: Admin only" },
        { status: 403 }
      ),
    };
  }
  
  return { session };
}
