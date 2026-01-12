import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      username: string;
      role?: string;
      initials?: string;
      company?: string;
      vendor?: string;
      phone?: string;
    };
  }

  interface User {
    id: string;
    username: string;
    role?: string;
    initials?: string;
    company?: string;
    vendor?: string;
    phone?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role?: string;
    initials?: string;
    company?: string;
    vendor?: string;
    phone?: string;
  }
}