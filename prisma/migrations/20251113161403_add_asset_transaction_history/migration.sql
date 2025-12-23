-- CreateTable
CREATE TABLE "AssetTransactionHistory" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "barcode" VARCHAR(50) NOT NULL,
    "assetName" TEXT NOT NULL,
    "startWarranty" TEXT,
    "endWarranty" TEXT,
    "cheilPO" TEXT,
    "size" TEXT,
    "grade" TEXT,
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
    "assetStatus" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 1,
    "transactionCategory" TEXT,
    "wkOut" VARCHAR(20),
    "wkIn" VARCHAR(20),
    "wkOutForRepair" VARCHAR(20),
    "wkInForRepair" VARCHAR(20),
    "newInStock" VARCHAR(20),
    "refurbishedInStock" VARCHAR(20),
    "borrow" VARCHAR(20),
    "return" VARCHAR(20),
    "outToRentalWarehouse" VARCHAR(20),
    "inToRentalWarehouse" VARCHAR(20),
    "discarded" VARCHAR(20),
    "adjustError" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" INTEGER,

    CONSTRAINT "AssetTransactionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetTransactionHistory_documentId_idx" ON "AssetTransactionHistory"("documentId");

-- CreateIndex
CREATE INDEX "AssetTransactionHistory_barcode_idx" ON "AssetTransactionHistory"("barcode");

-- CreateIndex
CREATE INDEX "AssetTransactionHistory_inStockDate_idx" ON "AssetTransactionHistory"("inStockDate");

-- CreateIndex
CREATE INDEX "AssetTransactionHistory_outDate_idx" ON "AssetTransactionHistory"("outDate");

-- CreateIndex
CREATE INDEX "AssetTransactionHistory_assetStatus_idx" ON "AssetTransactionHistory"("assetStatus");

-- CreateIndex
CREATE INDEX "AssetTransactionHistory_balance_idx" ON "AssetTransactionHistory"("balance");

-- AddForeignKey
ALTER TABLE "AssetTransactionHistory" ADD CONSTRAINT "AssetTransactionHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
