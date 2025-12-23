-- CreateTable
CREATE TABLE "LibrarySIS" (
    "id" SERIAL NOT NULL,
    "barcode" TEXT,
    "assetName" TEXT,
    "assetType" TEXT,
    "dimension" TEXT,
    "warehouse" TEXT,
    "pictureUrl" TEXT,
    "status" TEXT,
    "remark" TEXT,
    "digit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibrarySIS_pkey" PRIMARY KEY ("id")
);
