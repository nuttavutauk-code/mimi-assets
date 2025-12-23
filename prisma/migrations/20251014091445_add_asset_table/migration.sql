-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "barcode" TEXT NOT NULL,
    "assetName" TEXT,
    "assetType" TEXT,
    "size" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_barcode_key" ON "Asset"("barcode");
