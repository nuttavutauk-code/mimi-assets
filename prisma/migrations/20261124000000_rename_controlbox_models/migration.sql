-- เปลี่ยนชื่อรุ่น CONTROLBOX (data-only)
-- 5 PORT ทุกรูปแบบ (M-50000R, M-60000R, M-5000LD) -> M-5000L
-- 6 PORT ทุกรูปแบบ (M-60000R) -> M-6000BS

-- AutoBarcodeRule.assetName เป็น UNIQUE: ลบแถวซ้ำในกลุ่มเดียวกันก่อน เก็บแถวที่ updatedAt ล่าสุด
DELETE FROM "AutoBarcodeRule" WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "updatedAt" DESC, "id" DESC) AS rn
    FROM "AutoBarcodeRule" WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 5 PORT%'
  ) t WHERE t.rn > 1
);
DELETE FROM "AutoBarcodeRule" WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "updatedAt" DESC, "id" DESC) AS rn
    FROM "AutoBarcodeRule" WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 6 PORT%'
  ) t WHERE t.rn > 1
);

UPDATE "SecuritySetTransaction" SET "assetName" = 'CONTROLBOX 5 PORT (M-5000L) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 5 PORT%' AND "assetName" <> 'CONTROLBOX 5 PORT (M-5000L) with power cable';
UPDATE "SecuritySetTransaction" SET "assetName" = 'CONTROLBOX 6 PORT (M-6000BS) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 6 PORT%' AND "assetName" <> 'CONTROLBOX 6 PORT (M-6000BS) with power cable';

UPDATE "DocumentSecuritySet" SET "name" = 'CONTROLBOX 5 PORT (M-5000L) with power cable' WHERE UPPER(TRIM("name")) LIKE 'CONTROLBOX 5 PORT%' AND "name" <> 'CONTROLBOX 5 PORT (M-5000L) with power cable';
UPDATE "DocumentSecuritySet" SET "name" = 'CONTROLBOX 6 PORT (M-6000BS) with power cable' WHERE UPPER(TRIM("name")) LIKE 'CONTROLBOX 6 PORT%' AND "name" <> 'CONTROLBOX 6 PORT (M-6000BS) with power cable';

UPDATE "PickAssetTask" SET "assetName" = 'CONTROLBOX 5 PORT (M-5000L) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 5 PORT%' AND "assetName" <> 'CONTROLBOX 5 PORT (M-5000L) with power cable';
UPDATE "PickAssetTask" SET "assetName" = 'CONTROLBOX 6 PORT (M-6000BS) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 6 PORT%' AND "assetName" <> 'CONTROLBOX 6 PORT (M-6000BS) with power cable';

UPDATE "DocumentAsset" SET "name" = 'CONTROLBOX 5 PORT (M-5000L) with power cable' WHERE UPPER(TRIM("name")) LIKE 'CONTROLBOX 5 PORT%' AND "name" <> 'CONTROLBOX 5 PORT (M-5000L) with power cable';
UPDATE "DocumentAsset" SET "name" = 'CONTROLBOX 6 PORT (M-6000BS) with power cable' WHERE UPPER(TRIM("name")) LIKE 'CONTROLBOX 6 PORT%' AND "name" <> 'CONTROLBOX 6 PORT (M-6000BS) with power cable';

UPDATE "Asset" SET "assetName" = 'CONTROLBOX 5 PORT (M-5000L) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 5 PORT%' AND "assetName" <> 'CONTROLBOX 5 PORT (M-5000L) with power cable';
UPDATE "Asset" SET "assetName" = 'CONTROLBOX 6 PORT (M-6000BS) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 6 PORT%' AND "assetName" <> 'CONTROLBOX 6 PORT (M-6000BS) with power cable';

UPDATE "AssetTransactionHistory" SET "assetName" = 'CONTROLBOX 5 PORT (M-5000L) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 5 PORT%' AND "assetName" <> 'CONTROLBOX 5 PORT (M-5000L) with power cable';
UPDATE "AssetTransactionHistory" SET "assetName" = 'CONTROLBOX 6 PORT (M-6000BS) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 6 PORT%' AND "assetName" <> 'CONTROLBOX 6 PORT (M-6000BS) with power cable';

UPDATE "RepairTask" SET "assetName" = 'CONTROLBOX 5 PORT (M-5000L) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 5 PORT%' AND "assetName" <> 'CONTROLBOX 5 PORT (M-5000L) with power cable';
UPDATE "RepairTask" SET "assetName" = 'CONTROLBOX 6 PORT (M-6000BS) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 6 PORT%' AND "assetName" <> 'CONTROLBOX 6 PORT (M-6000BS) with power cable';

UPDATE "TransferReceiveTask" SET "assetName" = 'CONTROLBOX 5 PORT (M-5000L) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 5 PORT%' AND "assetName" <> 'CONTROLBOX 5 PORT (M-5000L) with power cable';
UPDATE "TransferReceiveTask" SET "assetName" = 'CONTROLBOX 6 PORT (M-6000BS) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 6 PORT%' AND "assetName" <> 'CONTROLBOX 6 PORT (M-6000BS) with power cable';

UPDATE "LibrarySES" SET "assetName" = 'CONTROLBOX 5 PORT (M-5000L) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 5 PORT%' AND "assetName" <> 'CONTROLBOX 5 PORT (M-5000L) with power cable';
UPDATE "LibrarySES" SET "assetName" = 'CONTROLBOX 6 PORT (M-6000BS) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 6 PORT%' AND "assetName" <> 'CONTROLBOX 6 PORT (M-6000BS) with power cable';

UPDATE "LibrarySIS" SET "assetName" = 'CONTROLBOX 5 PORT (M-5000L) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 5 PORT%' AND "assetName" <> 'CONTROLBOX 5 PORT (M-5000L) with power cable';
UPDATE "LibrarySIS" SET "assetName" = 'CONTROLBOX 6 PORT (M-6000BS) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 6 PORT%' AND "assetName" <> 'CONTROLBOX 6 PORT (M-6000BS) with power cable';

UPDATE "AutoBarcodeRule" SET "assetName" = 'CONTROLBOX 5 PORT (M-5000L) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 5 PORT%' AND "assetName" <> 'CONTROLBOX 5 PORT (M-5000L) with power cable';
UPDATE "AutoBarcodeRule" SET "assetName" = 'CONTROLBOX 6 PORT (M-6000BS) with power cable' WHERE UPPER(TRIM("assetName")) LIKE 'CONTROLBOX 6 PORT%' AND "assetName" <> 'CONTROLBOX 6 PORT (M-6000BS) with power cable';
