/*
  Warnings:

  - You are about to drop the column `assetType` on the `Asset` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "assetType",
ADD COLUMN     "cheilPO" TEXT,
ADD COLUMN     "endWarranty" TIMESTAMP(3),
ADD COLUMN     "startWarranty" TIMESTAMP(3);
