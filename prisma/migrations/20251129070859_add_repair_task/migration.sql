-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "operation" TEXT,
ADD COLUMN     "otherDetail" TEXT;

-- CreateTable
CREATE TABLE "RepairTask" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "size" TEXT,
    "grade" TEXT,
    "repairWarehouse" TEXT NOT NULL,
    "reporterName" TEXT,
    "reporterCompany" TEXT,
    "reporterPhone" TEXT,
    "reporterVendor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "repairStartDate" TIMESTAMP(3),
    "repairEndDate" TIMESTAMP(3),
    "transactionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedBy" INTEGER,

    CONSTRAINT "RepairTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepairTask_documentId_idx" ON "RepairTask"("documentId");

-- CreateIndex
CREATE INDEX "RepairTask_repairWarehouse_idx" ON "RepairTask"("repairWarehouse");

-- CreateIndex
CREATE INDEX "RepairTask_status_idx" ON "RepairTask"("status");

-- CreateIndex
CREATE INDEX "RepairTask_barcode_idx" ON "RepairTask"("barcode");

-- AddForeignKey
ALTER TABLE "RepairTask" ADD CONSTRAINT "RepairTask_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
