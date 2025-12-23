import { PrismaClient } from "@prisma/client";

// ป้องกันไม่ให้ PrismaClient ถูกสร้างซ้ำเวลารัน hot-reload (เฉพาะ dev)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // เปิด log เฉพาะ development เท่านั้น
    log: process.env.NODE_ENV === "development" 
      ? ["error", "warn"] 
      : ["error"],
  });

// ให้ TypeScript รู้ว่ามี prisma อยู่ใน global
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
