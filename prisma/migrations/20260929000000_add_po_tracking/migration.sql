-- CreateTable
CREATE TABLE "PoTrackingRow" (
    "id" SERIAL NOT NULL,
    "jobGroupId" VARCHAR(50) NOT NULL,
    "no" TEXT,
    "vendor" TEXT,
    "jobType" TEXT,
    "assetType" TEXT,
    "assetType2" TEXT,
    "orderQty" DOUBLE PRECISION,
    "estimate" TEXT,
    "totalCost" DOUBLE PRECISION,
    "costPerUnit" DOUBLE PRECISION,
    "newProductionUnitPrice" TEXT,
    "savingCostPerUnit" TEXT,
    "savingCostPerUnitPct" TEXT,
    "totalNewProduction" TEXT,
    "totalSavingCost" TEXT,
    "ssPo" TEXT,
    "ssPoDate" TEXT,
    "quarter" TEXT,
    "month" TEXT,
    "chPo" TEXT,
    "chPoDate" TEXT,
    "jobNo" TEXT,
    "doneBy" TEXT,
    "actualLeadtime" TEXT,
    "targetingLeadtime" TEXT,
    "status" TEXT,
    "pm" TEXT,
    "sentReportToTse" TEXT,
    "remark1" TEXT,
    "aiRaw" JSONB,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoTrackingRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PoTrackingRow_jobGroupId_idx" ON "PoTrackingRow"("jobGroupId");
CREATE INDEX "PoTrackingRow_jobNo_idx" ON "PoTrackingRow"("jobNo");
CREATE INDEX "PoTrackingRow_chPo_idx" ON "PoTrackingRow"("chPo");
CREATE INDEX "PoTrackingRow_ssPo_idx" ON "PoTrackingRow"("ssPo");
CREATE INDEX "PoTrackingRow_createdAt_idx" ON "PoTrackingRow"("createdAt");
