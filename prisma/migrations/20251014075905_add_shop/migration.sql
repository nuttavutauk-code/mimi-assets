-- CreateTable
CREATE TABLE "Shop" (
    "id" SERIAL NOT NULL,
    "mcsCode" TEXT NOT NULL,
    "shopName" TEXT,
    "region" TEXT,
    "state" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_mcsCode_key" ON "Shop"("mcsCode");
