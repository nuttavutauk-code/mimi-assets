// scripts/create-pick-tasks.ts
// สคริปต์สำหรับสร้าง PickAssetTasks ด้วยมือ (สำหรับทดสอบ)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createPickTasksManually(documentId: number) {
    try {
        console.log(`🔍 Fetching document ${documentId}...`);

        // ดึงข้อมูลเอกสาร
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: {
                shops: {
                    include: {
                        assets: true,
                        securitySets: true,
                    },
                },
            },
        });

        if (!document) {
            console.error("❌ Document not found!");
            return;
        }

        console.log(`✅ Found document: ${document.docCode}`);
        console.log(`📋 Shops: ${document.shops.length}`);

        let tasksCreated = 0;

        // Loop ผ่านแต่ละ Shop
        for (const shop of document.shops) {
            console.log(`\n🏪 Shop: ${shop.shopName}`);
            console.log(`   Assets: ${shop.assets.length}`);
            console.log(`   Security Sets: ${shop.securitySets.length}`);

            // สร้าง Tasks สำหรับ Assets
            for (const asset of shop.assets) {
                console.log(`\n   📦 Creating tasks for: ${asset.name}`);
                console.log(`      - Qty: ${asset.qty}`);
                console.log(`      - Withdraw From: ${asset.withdrawFor}`);

                // สร้าง Task เท่ากับจำนวน qty
                for (let i = 0; i < asset.qty; i++) {
                    const task = await prisma.pickAssetTask.create({
                        data: {
                            documentId: document.id,

                            // ข้อมูล Asset
                            assetName: asset.name,
                            size: asset.size || null,
                            qty: 1,
                            isSecuritySet: false,

                            // โกดังที่ต้อง Pick
                            warehouse: asset.withdrawFor || "Unknown",

                            // ข้อมูล Shop
                            shopCode: shop.shopCode,
                            shopName: shop.shopName,
                            startInstallDate: shop.startInstallDate,
                            endInstallDate: shop.endInstallDate,
                            q7b7: shop.q7b7,
                            shopFocus: shop.shopFocus,

                            // ข้อมูลผู้เบิก
                            requesterName: document.fullName,
                            requesterCompany: document.company,
                            requesterPhone: document.phone,

                            // สถานะ
                            status: "pending",
                        },
                    });

                    console.log(`      ✅ Created task #${task.id} (${i + 1}/${asset.qty})`);
                    tasksCreated++;
                }
            }

            // สร้าง Tasks สำหรับ Security Sets
            for (const security of shop.securitySets) {
                console.log(`\n   🔒 Creating tasks for: ${security.name}`);
                console.log(`      - Qty: ${security.qty}`);
                console.log(`      - Withdraw From: ${security.withdrawFor}`);

                for (let i = 0; i < security.qty; i++) {
                    const task = await prisma.pickAssetTask.create({
                        data: {
                            documentId: document.id,
                            assetName: security.name,
                            qty: 1,
                            isSecuritySet: true,
                            warehouse: security.withdrawFor || "Unknown",
                            shopCode: shop.shopCode,
                            shopName: shop.shopName,
                            startInstallDate: shop.startInstallDate,
                            endInstallDate: shop.endInstallDate,
                            q7b7: shop.q7b7,
                            shopFocus: shop.shopFocus,
                            requesterName: document.fullName,
                            requesterCompany: document.company,
                            requesterPhone: document.phone,
                            status: "pending",
                        },
                    });

                    console.log(`      ✅ Created task #${task.id} (${i + 1}/${security.qty})`);
                    tasksCreated++;
                }
            }
        }

        console.log(`\n🎉 Successfully created ${tasksCreated} pick tasks!`);

        // แสดงสรุป
        const allTasks = await prisma.pickAssetTask.findMany({
            where: { documentId },
        });

        console.log("\n📊 Summary:");
        const groupByWarehouse = allTasks.reduce((acc: any, task) => {
            acc[task.warehouse] = (acc[task.warehouse] || 0) + 1;
            return acc;
        }, {});

        for (const [warehouse, count] of Object.entries(groupByWarehouse)) {
            console.log(`   ${warehouse}: ${count} tasks`);
        }
    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

// รัน: npx tsx scripts/create-pick-tasks.ts
const documentId = parseInt(process.argv[2] || "0");

if (documentId === 0) {
    console.log("Usage: npx tsx scripts/create-pick-tasks.ts <documentId>");
    console.log("Example: npx tsx scripts/create-pick-tasks.ts 5");
    process.exit(1);
}

createPickTasksManually(documentId);