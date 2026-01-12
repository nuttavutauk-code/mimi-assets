-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "warehouse" TEXT;

-- AlterTable
ALTER TABLE "DocumentAsset" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "grade" TEXT;

-- CreateIndex
CREATE INDEX "Asset_warehouse_idx" ON "Asset"("warehouse");
