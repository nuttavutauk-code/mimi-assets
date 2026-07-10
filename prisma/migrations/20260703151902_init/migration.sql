/*
  Warnings:

  - You are about to drop the column `transactionCategory` on the `AssetTransactionHistory` table. All the data in the column will be lost.
  - You are about to drop the column `transactionCategory` on the `SecuritySetTransaction` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."AssetTransactionHistory" DROP CONSTRAINT "AssetTransactionHistory_documentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SecuritySetTransaction" DROP CONSTRAINT "SecuritySetTransaction_documentId_fkey";

-- DropIndex
DROP INDEX "public"."User_email_key";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "statusAsset" TEXT NOT NULL DEFAULT 'Ready';

-- AlterTable
ALTER TABLE "AssetTransactionHistory" DROP COLUMN "transactionCategory",
ADD COLUMN     "budget" TEXT,
ADD COLUMN     "repair" VARCHAR(20),
ADD COLUMN     "shopType" TEXT,
ALTER COLUMN "documentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "borrowType" TEXT,
ADD COLUMN     "otherActivity" TEXT,
ADD COLUMN     "returnCondition" TEXT,
ADD COLUMN     "transactionStatus" TEXT,
ADD COLUMN     "transferDocImageUrl" TEXT;

-- AlterTable
ALTER TABLE "PickAssetTask" ADD COLUMN     "transactionStatus" TEXT;

-- AlterTable
ALTER TABLE "SecuritySetTransaction" DROP COLUMN "transactionCategory",
ADD COLUMN     "repair" VARCHAR(20),
ALTER COLUMN "documentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "shopType" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "TransferReceiveTask" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "pickAssetTaskId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "size" TEXT,
    "grade" TEXT,
    "fromWarehouse" TEXT NOT NULL,
    "toWarehouse" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "assetImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "receivedBy" INTEGER,

    CONSTRAINT "TransferReceiveTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferReceiveTask_documentId_idx" ON "TransferReceiveTask"("documentId");

-- CreateIndex
CREATE INDEX "TransferReceiveTask_toWarehouse_idx" ON "TransferReceiveTask"("toWarehouse");

-- CreateIndex
CREATE INDEX "TransferReceiveTask_status_idx" ON "TransferReceiveTask"("status");

-- CreateIndex
CREATE INDEX "TransferReceiveTask_pickAssetTaskId_idx" ON "TransferReceiveTask"("pickAssetTaskId");

-- AddForeignKey
ALTER TABLE "AssetTransactionHistory" ADD CONSTRAINT "AssetTransactionHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecuritySetTransaction" ADD CONSTRAINT "SecuritySetTransaction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferReceiveTask" ADD CONSTRAINT "TransferReceiveTask_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
