import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding User...");

  // อ่านไฟล์ JSON
  const rawData = fs.readFileSync("prisma/data/User.json", "utf-8");
  const users = JSON.parse(rawData);

  // เคลียร์ข้อมูลเก่า
  await prisma.user.deleteMany();

  // Insert ใหม่ทั้งหมด
  for (const u of users) {
    const { id, ...rest } = u;   // ไม่ใช้ id เดิม

    await prisma.user.create({
      data: rest,
    });
  }

  console.log("🎉 User Seed Completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
