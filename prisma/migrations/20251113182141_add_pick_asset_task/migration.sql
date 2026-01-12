-- CreateTable
CREATE TABLE "PickAssetTask" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "assetName" TEXT NOT NULL,
    "size" TEXT,
    "grade" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "isSecuritySet" BOOLEAN NOT NULL DEFAULT false,
    "warehouse" TEXT NOT NULL,
    "shopCode" TEXT,
    "shopName" TEXT,
    "startInstallDate" TIMESTAMP(3),
    "endInstallDate" TIMESTAMP(3),
    "q7b7" TEXT,
    "shopFocus" TEXT,
    "requesterName" TEXT,
    "requesterCompany" TEXT,
    "requesterPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "barcode" TEXT,
    "barcodeImageUrl" TEXT,
    "assetImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedBy" INTEGER,

    CONSTRAINT "PickAssetTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PickAssetTask_documentId_idx" ON "PickAssetTask"("documentId");

-- CreateIndex
CREATE INDEX "PickAssetTask_warehouse_idx" ON "PickAssetTask"("warehouse");

-- CreateIndex
CREATE INDEX "PickAssetTask_status_idx" ON "PickAssetTask"("status");

-- AddForeignKey
ALTER TABLE "PickAssetTask" ADD CONSTRAINT "PickAssetTask_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
