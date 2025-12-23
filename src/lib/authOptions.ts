import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.username || !credentials?.password) {
            throw new Error("Missing credentials");
          }

          // 🔹 ดึงข้อมูล user จาก Prisma
          const user = await prisma.user.findUnique({
            where: { username: credentials.username },
          });

          if (!user) {
            throw new Error("User not found");
          }

          // 🔹 ตรวจสอบรหัสผ่าน
          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) {
            throw new Error("Invalid password");
          }

          // ✅ ส่งข้อมูลที่ต้องการเก็บใน token กลับไป
          return {
            id: String(user.id),
            name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
            email: user.email,
            username: user.username,
            company: user.company ?? "",
            vendor: user.vendor ?? "",
            phone: user.phone ?? "",
            role: user.role ?? "USER",
            initials: user.initials ?? "",
          };
        } catch (error: any) {
          console.error("[AUTHORIZE_ERROR]", error);
          throw new Error("Authentication failed");
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    // ✅ เขียนข้อมูลเพิ่มลงใน JWT token
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.username = user.username;
        token.company = user.company;
        token.vendor = user.vendor;
        token.phone = user.phone;
        token.initials = user.initials;
      }
      return token;
    },

    // ✅ เพิ่มข้อมูลลงใน session
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.username = token.username as string;
        session.user.company = token.company as string;
        session.user.vendor = token.vendor as string;
        session.user.phone = token.phone as string;
        session.user.initials = token.initials as string;
      }
      return session;
    },

    // ✅ redirect หลัง login สำเร็จ
    async redirect({ url, baseUrl }) {
      // ให้ไปหน้า dashboard ทุกครั้ง
      return `${baseUrl}/dashboard`;
    },
  },

  // ✅ ตั้งค่า custom หน้า login
  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};