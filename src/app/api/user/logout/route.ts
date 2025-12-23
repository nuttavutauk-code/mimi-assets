import { NextResponse } from "next/server";
import { deleteCookie } from "cookies-next";

export async function POST() {
  try {
    // ❌ ลบ cookie ทั้งหมดที่เกี่ยวข้อง
    const response = NextResponse.json({ message: "Logged out successfully" });
    response.cookies.set("amn-token", "", { maxAge: 0 });
    response.cookies.set("amn-role", "", { maxAge: 0 });
    response.cookies.set("amn-username", "", { maxAge: 0 });

    return response;
  } catch (error) {
    console.error("[LOGOUT ERROR]", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
