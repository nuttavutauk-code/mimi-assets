-- CreateTable
CREATE TABLE "LibrarySES" (
    "id" SERIAL NOT NULL,
    "category" TEXT,
    "imageUrl" TEXT,
    "assetName" TEXT NOT NULL,
    "code" TEXT,
    "barcode" TEXT,
    "dimensionMm" TEXT,
    "status" TEXT,
    "remark" TEXT,
    "digit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibrarySES_pkey" PRIMARY KEY ("id")
);
