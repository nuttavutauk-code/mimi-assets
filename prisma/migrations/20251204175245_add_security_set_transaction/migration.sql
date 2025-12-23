-- CreateTable
CREATE TABLE "SecuritySetTransaction" (
    "id" SERIAL NOT NULL,
    "docCode" VARCHAR(50) NOT NULL,
    "documentId" INTEGER NOT NULL,
    "assetName" TEXT NOT NULL,
    "barcode" VARCHAR(50),
    "warehouseIn" TEXT,
    "inStockDate" TIMESTAMP(3),
    "unitIn" INTEGER,
    "fromVendor" TEXT,
    "mcsCodeIn" TEXT,
    "fromShop" TEXT,
    "remarkIn" TEXT,
    "outDate" TIMESTAMP(3),
    "unitOut" INTEGER,
    "toVendor" TEXT,
    "status" TEXT,
    "mcsCodeOut" TEXT,
    "toShop" TEXT,
    "remarkOut" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" INTEGER,

    CONSTRAINT "SecuritySetTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecuritySetTransaction_documentId_idx" ON "SecuritySetTransaction"("documentId");

-- CreateIndex
CREATE INDEX "SecuritySetTransaction_docCode_idx" ON "SecuritySetTransaction"("docCode");

-- CreateIndex
CREATE INDEX "SecuritySetTransaction_barcode_idx" ON "SecuritySetTransaction"("barcode");

-- CreateIndex
CREATE INDEX "SecuritySetTransaction_assetName_idx" ON "SecuritySetTransaction"("assetName");

-- CreateIndex
CREATE INDEX "SecuritySetTransaction_inStockDate_idx" ON "SecuritySetTransaction"("inStockDate");

-- CreateIndex
CREATE INDEX "SecuritySetTransaction_outDate_idx" ON "SecuritySetTransaction"("outDate");

-- CreateIndex
CREATE INDEX "SecuritySetTransaction_balance_idx" ON "SecuritySetTransaction"("balance");

-- AddForeignKey
ALTER TABLE "SecuritySetTransaction" ADD CONSTRAINT "SecuritySetTransaction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
