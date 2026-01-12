/*
  Warnings:

  - Added the required column `documentType` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "company" TEXT,
ADD COLUMN     "documentType" TEXT NOT NULL,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" TEXT;

-- CreateTable
CREATE TABLE "DocumentShop" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "shopCode" TEXT,
    "shopName" TEXT,
    "startInstallDate" TIMESTAMP(3),
    "endInstallDate" TIMESTAMP(3),
    "q7b7" TEXT,
    "shopFocus" TEXT,

    CONSTRAINT "DocumentShop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAsset" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT,
    "kv" TEXT,
    "qty" INTEGER NOT NULL,
    "withdrawFor" TEXT,

    CONSTRAINT "DocumentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSecuritySet" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "withdrawFor" TEXT,

    CONSTRAINT "DocumentSecuritySet_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DocumentShop" ADD CONSTRAINT "DocumentShop_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAsset" ADD CONSTRAINT "DocumentAsset_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "DocumentShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSecuritySet" ADD CONSTRAINT "DocumentSecuritySet_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "DocumentShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
