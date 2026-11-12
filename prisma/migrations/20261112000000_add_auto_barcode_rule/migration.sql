-- CreateTable
CREATE TABLE "AutoBarcodeRule" (
    "id" SERIAL NOT NULL,
    "assetName" TEXT NOT NULL,
    "warehouse1" TEXT NOT NULL,
    "warehouse2" TEXT,
    "isSecuritySet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoBarcodeRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutoBarcodeRule_assetName_key" ON "AutoBarcodeRule"("assetName");
