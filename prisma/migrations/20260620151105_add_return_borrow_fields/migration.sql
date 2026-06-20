-- AlterTable: add borrowDocNumber and destinationWarehouse to Document
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "borrowDocNumber" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "destinationWarehouse" TEXT;
