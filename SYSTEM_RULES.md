# SYSTEM RULES — MiMi Assets

เอกสารรวมกฎ/เงื่อนไขทั้งหมดของระบบ ใช้ตรวจสอบ logic การบันทึก `AssetTransactionHistory`, `SecuritySetTransaction` และตารางที่เกี่ยวข้อง

อัปเดต: 2026-05-16

---

## 1. โครงสร้างข้อมูลหลัก

### 1.1 AssetTransactionHistory (4 บล็อก)

| บล็อก | คอลัมน์ |
|---|---|
| Asset info | `barcode`, `assetName`, `startWarranty`, `endWarranty`, `cheilPO`, `budget`, `size`, `grade` |
| IN leg | `warehouseIn`, `inStockDate`, `unitIn`, `fromVendor`, `mcsCodeIn`, `fromShop`, `remarkIn` |
| OUT leg | `outDate`, `unitOut`, `toVendor`, `status`, `shopType`, `mcsCodeOut`, `toShop`, `remarkOut` |
| Auto logic | `assetStatus`, `balance`, `transactionCategory` + 13 WK cols |

### 1.2 ค่า enum สำคัญ

- `assetStatus`: `NEW`, `USED`, `REFURBISHED`, `REFURBISH`, `-`
- `balance`: `1` = มีของในสต๊อก, `0` = ออกไปแล้ว
- `Asset.statusAsset`: `Ready`, `NO Barcode`
- `Role`: `ADMIN`, `USER`

### 1.3 documentType ที่รองรับ

| Type | คำอธิบาย | flow |
|---|---|---|
| `withdraw` | เบิกของ | Picker |
| `routing2shops`, `routing3shops`, `routing4shops` | ย้ายของระหว่างร้าน N ร้าน | Picker |
| `withdrawother` | เบิกอื่นๆ | Picker |
| `other` | งานอื่น | Picker |
| `transfer` | ย้ายระหว่างโกดัง | Picker + Receive |
| `borrow`, `borrowsecurity` | ยืม | Picker |
| `return`, `returnasset` | เก็บของกลับ | Direct approve |
| `shoptoshop` | ย้ายร้าน-ร้าน | Direct approve |
| `repair` | ส่งซ่อม | Direct approve + Repair complete |

---

## 2. กฎการสร้าง Transaction (CREATE)

### 2.1 IN-leg เท่านั้น (balance=1)

| Endpoint | Trigger | assetStatus | WK column | remarkIn |
|---|---|---|---|---|
| `POST /api/asset/import` | Admin upload Excel ของใหม่ | `NEW` | `newInStock` | `New Asset add to WH` |
| `POST /api/asset/import-used` | Admin upload ของมือสอง | `USED` | — | `Import Asset USED` |
| `POST /api/asset/import-refurbished` | Admin upload ของซ่อมแล้ว | `REFURBISHED` | — | `Import Asset REFURBISHED` |
| `POST /api/repair-asset/complete` | ช่างซ่อมเสร็จ | `REFURBISH` | `refurbishedInStock` | `ซ่อมเสร็จ` |
| `POST /api/receive-transfer/complete` | โกดังปลายทางรับโอน | `-` | `wkInForRepair` | จาก `document.operation` |
| `POST /api/document/approve` (return/returnasset) | Admin อนุมัติใบเก็บกลับ | `USED` | `wkIn` หรือ `return` | — |

**กฎ return WK column** (`returnasset` / `return`):
- `document.returnCondition === "from_borrow"` → ลง `return`
- อื่น → ลง `wkIn`
- ถ้า `document.otherActivity` มีค่า → override ไป column ตามกฎ otherActivity (ข้อ 5)

### 2.2 IN + OUT พร้อมกัน (balance=0, 1 row)

`POST /api/document/approve` documentType=`shoptoshop`:
- `inStockDate` = `outDate` = `sourceShop.startInstallDate`
- `wkIn` + `wkOut` สัปดาห์เดียวกัน
- `assetStatus: "-"`, `transactionCategory: "-"`

### 2.3 Legacy import (รองรับทุก field)

`POST /api/database/import`:
- อ่านทุก field จาก Excel ตรง รวม WK 13 ตัว
- **กฎบังคับ**: ทุกแถวยกเว้นแถวสุดท้ายต่อ barcode ต้องมี OUT data
- สร้าง Asset อัตโนมัติจากแถวล่าสุดของแต่ละ barcode (`statusAsset: "Ready"`)

---

## 3. กฎการ OUT (UPDATE balance=1 → 0)

### 3.1 Picker workflow (2-step)

documentType ที่ต้องผ่าน Picker: `withdraw`, `routing2shops`, `routing3shops`, `routing4shops`, `withdrawother`, `other`, `transfer`, `borrow`, `borrowsecurity`

| Step | Endpoint | Action |
|---|---|---|
| 1 | `POST /api/document/approve` | สร้าง `PickAssetTask` (status=`pending`) ยังไม่แตะ transaction |
| 2 | `POST /api/pick-asset/complete` | หา row `barcode + balance=1` → update OUT-leg |

**กฎ Picker เห็นงาน**: เฉพาะ `PickAssetTask.warehouse === picker.vendor`

**WK column mapping ตอน OUT**:
| documentType | WK column |
|---|---|
| `withdraw`, `routing2shops`, `routing3shops`, `routing4shops`, `withdrawother` | `wkOut` |
| `transfer` | `wkOutForRepair` |
| `borrow`, `borrowsecurity` | `borrow` |

**Field ที่ set ตอน OUT**:
- `outDate` = เวลา Picker complete
- `unitOut: 1`
- `toVendor` = `documentCreator.vendor`
- `status` = `document.transactionStatus` (Admin เลือกตอน approve)
- `shopType` = จาก `Shop` table หรือ `"NO MCS"`
- `mcsCodeOut`, `toShop` = จาก task
- `remarkOut` = `document.operation` / `borrowType` / `otherDetail`
- `balance: 0`
- `assetStatus: "-"`

### 3.2 Direct approve (ไม่ผ่าน Picker)

DIRECT_TRANSACTION_TYPES = `["return", "returnasset", "shoptoshop", "repair"]`

**repair branch**:
- หา row `barcode + balance=1` ล่าสุด (order desc by id) → update OUT-leg
- `status: "SEND TO REPAIR"`
- `remarkOut: "ส่งซ่อม"`
- WK column = `repair`
- สร้าง `RepairTask` คู่ (status=`pending`)

### 3.3 รับโอน reject (revert OUT)

`POST /api/receive-transfer/complete` (status=`rejected`):
- หา OUT row (`barcode + balance=0`, order desc by id)
- Revert: `balance: 1`, เคลียร์ OUT fields, `remarkOut: "ปฏิเสธ: {rejectReason}"`
- `wkOutForRepair: null`

---

## 4. กฎ Revert / Edit

### 4.1 ลบเอกสาร = Reset (ไม่ลบ row)

`DELETE /api/document/delete/[id]`:
- `documentId → null`
- OUT fields → `null`: `outDate`, `unitOut`, `toVendor`, `status`, `shopType`, `mcsCodeOut`, `toShop`, `remarkOut`
- WK OUT cols → `null`: `wkOut`, `wkOutForRepair`, `borrow`, `outToRentalWarehouse`, `inToRentalWarehouse`, `discarded`, `adjustError`
- `balance → 1`
- Cascade delete: `PickAssetTask`, `RepairTask`, `TransferReceiveTask`, `DocumentShop`, `DocumentAsset`, `DocumentSecuritySet`

### 4.2 แก้ barcode หลัง pick เสร็จ

`POST /api/pick-asset/edit-barcode`:
- เงื่อนไข: `PickAssetTask.status === "completed"` + barcode ใหม่ต้องอยู่ใน table มี `balance=1`
- Revert barcode เก่า (`balance=1`, เคลียร์ OUT)
- Transfer OUT-leg data ไป barcode ใหม่ (`balance=0`)
- Update `PickAssetTask.barcode`

### 4.3 แก้ field ทั่วไป (`database/update`)

`POST /api/database/update` — **whitelist เท่านั้น**:

แก้ได้: `assetName`, `size`, `grade`, `toVendor`, `fromVendor`, `toShop`, `fromShop`, `mcsCodeOut`, `mcsCodeIn`, `remarkIn`, `remarkOut`, `status`, `shopType`, `cheilPO`, `startWarranty`, `endWarranty`, `wkOut`, `wkIn`, `wkOutForRepair`, `wkInForRepair`

**แก้ไม่ได้**: `barcode`, `balance`, `assetStatus`, `transactionCategory`, IN-leg date fields

ค่า `"-"` → ถูกแปลงเป็น `null` อัตโนมัติ

### 4.4 แก้ NO Barcode → Ready

`POST /api/asset/update-nobarcode`:
- เงื่อนไข: `Asset.statusAsset === "NO Barcode"` เท่านั้น
- ถ้าเปลี่ยน barcode → `updateMany()` ใน transaction history เปลี่ยน barcode ทุก row
- Asset.statusAsset → `"Ready"`

---

## 5. กฎ otherActivity (override WK column)

ถ้า `document.otherActivity` มีค่า ขณะ OUT หรือ IN — **override** WK column ปกติ:

| otherActivity | WK column |
|---|---|
| `outToRentalWarehouse` | `outToRentalWarehouse` |
| `inToRentalWarehouse` | `inToRentalWarehouse` |
| `discarded` | `discarded` |
| `adjustError` | `adjustError` |

ใช้ใน: `POST /api/pick-asset/complete`, `POST /api/document/approve` (return/returnasset)

---

## 6. กฎ WK Column Mapping (สรุปครบ)

| WK column | ลงเมื่อ | source endpoint |
|---|---|---|
| `newInStock` | import ของใหม่ | `asset/import` |
| `refurbishedInStock` | ซ่อมเสร็จกลับสต๊อก | `repair-asset/complete` |
| `wkOut` | เบิกออกปกติ + shoptoshop OUT | `pick-asset/complete`, `approve(shoptoshop)` |
| `wkIn` | คืนของกลับ stock (return ปกติ) + shoptoshop IN | `approve(return/shoptoshop)` |
| `borrow` | ยืม (borrow/borrowsecurity) OUT | `pick-asset/complete` |
| `return` | คืนของจากการยืม (`returnCondition=from_borrow`) | `approve(return)` |
| `repair` | ส่งซ่อม OUT | `approve(repair)` |
| `wkOutForRepair` | ย้ายระหว่างโกดัง OUT | `pick-asset/complete(transfer)` |
| `wkInForRepair` | ย้ายระหว่างโกดัง IN | `receive-transfer/complete` |
| `outToRentalWarehouse` | otherActivity override | `pick-asset/complete`, `approve` |
| `inToRentalWarehouse` | otherActivity override | `pick-asset/complete`, `approve` |
| `discarded` | otherActivity override | `pick-asset/complete`, `approve` |
| `adjustError` | otherActivity override | `pick-asset/complete`, `approve` |

Format: `"2025 WK 23"` (`getWeekNumber()`)

---

## 7. กฎ SecuritySetTransaction (ตารางคู่ขนาน)

### 7.1 รองรับ 3 ประเภท

| Asset Name | Barcode | qty |
|---|---|---|
| `CONTROLBOX 6 PORT (M-60000R) with power cable` | มี | 1 ต่อ row |
| `Security Type C Ver.7.1` | ไม่มี | aggregate ได้ |
| `Security Type C Ver.7.0` | ไม่มี | aggregate ได้ |

### 7.2 CREATE

- `approve(return/returnasset)`:
  - CONTROLBOX มี barcode → 1 row
  - CONTROLBOX ไม่มี barcode → qty rows (barcode=null)
  - Type C → 1 row `unitIn=qty`
- `pick-asset/complete` (Type C only) → สร้าง OUT row ตรง (ไม่มี IN match)

### 7.3 UPDATE OUT

- `pick-asset/complete` (CONTROLBOX) → หา `barcode + balance=1` → set OUT-leg

### 7.4 Revert

- `document/delete` → updateMany() เคลียร์ OUT, `balance=1`, `documentId=null` (เหมือน Asset)

---

## 8. กฎ workflow tables คู่ขนาน

### 8.1 PickAssetTask

- สร้างที่ `approve` (เฉพาะ documentType ที่ต้อง pick)
- `warehouse` = ใช้กรอง Picker ตาม `vendor`
- `status`: `pending` → `picking` → `completed` หรือ `cancelled`
- ถ้า `cancelled` ที่ `pick-asset/complete`: ลด `DocumentAsset.qty` หรือลบถ้า `qty ≤ 0`

### 8.2 RepairTask

- สร้างที่ `approve(repair)` หลัง update transaction OUT
- `status`: `pending` → `repairing` → `completed`
- `repair-asset/complete` → ตั้ง `completedAt`, `repairEndDate`, สร้าง IN transaction

### 8.3 TransferReceiveTask

- สร้างที่ `pick-asset/complete` (documentType=`transfer`) สำหรับโกดังปลายทาง
- `status`: `pending` → `received` หรือ `rejected`
- `receive-transfer/complete` ต้องไม่มี task `pending` เหลือก่อนปิดงาน

---

## 9. กฎพิเศษ / Edge cases

### 9.1 NOBC- prefix

`approve(return/returnasset)` ([route.ts:467-488](src/app/api/document/approve/route.ts#L467)):
- ถ้า barcode ขึ้นต้น `"NOBC-"` และยังไม่มีใน Asset table
- สร้าง Asset ใหม่อัตโนมัติ `statusAsset: "NO Barcode"`

### 9.2 Security Type C ข้าม barcode check

`pick-asset/complete:184` — Security Type C ไม่ require barcode

### 9.3 Custom size update

`pick-asset/complete:461-472` — Lightbox / ACC WALL format `W*D*H` → update `Asset.size`

### 9.4 Vendor filter

- Picker เห็นเฉพาะ task `warehouse === user.vendor`
- Repairer เห็นเฉพาะ `repairWarehouse === user.vendor`

### 9.5 ค่า default

- `Asset.statusAsset` default `"Ready"`
- `AssetTransactionHistory.balance` default `1`
- `User.isActive` default `true`
- `User.role` default `USER`
- `PickAssetTask.status` default `"pending"`
- `PickAssetTask.qty` default `1`
- `PickAssetTask.isSecuritySet` default `false`

---

## 10. Invariants (กฎต้องห้ามผิด)

1. **balance integrity**: `balance` เปลี่ยนได้แค่ใน OUT update (`1→0`) และ revert (`0→1`) — ห้ามแก้มือผ่าน `database/update`
2. **barcode immutability**: `barcode` แก้ได้เฉพาะผ่าน `asset/update-nobarcode` หรือ `pick-asset/edit-barcode`
3. **delete = reset, not delete**: `document/delete` ใช้ `SetNull` ไม่ลบ row จริง (รักษา audit trail)
4. **legacy import row order**: ทุกแถวยกเว้นแถวสุดท้ายต่อ barcode ต้องมี OUT data
5. **transaction history immutable fields**: `barcode`, `balance`, `assetStatus`, `transactionCategory`, IN-leg dates — ไม่เปิด API ให้แก้
6. **Direct vs Picker dispatch**: documentType ต้อง map ตรงกับ DIRECT_TRANSACTION_TYPES หรือ NEEDS_PICK_ASSET_TYPES — ไม่ทับซ้อน
7. **OUT requires IN**: Picker flow ต้องเจอ row `barcode + balance=1` ก่อนทำ OUT — ถ้าไม่เจอ = error
8. **TransferReceive ต้องครบ**: `receive-transfer/complete` ทุก task ต้อง decided (received/rejected) ก่อนปิด

---

## 11. AuditLog (ตาราง audit แยก)

ตาราง `AuditLog` บันทึก action ทั่วไป (ไม่ใช่ transaction):
- `action`: `DOCUMENT_CREATE`, `DOCUMENT_APPROVE`, `USER_LOGIN`, etc.
- `entity`: `Document`, `Asset`, `User`, `Shop`
- `entityId`, `detail` (Json), `ipAddress`, `userAgent`
- snapshot: `username`, `userRole` ตอนทำรายการ

---

## 12. Endpoint Map (อ้างอิงเร็ว)

| Endpoint | Write target | Op |
|---|---|---|
| `POST /api/asset/import` | AssetTransactionHistory, SecuritySetTransaction, Asset | CREATE batch |
| `POST /api/asset/import-used` | AssetTransactionHistory, Asset | CREATE |
| `POST /api/asset/import-refurbished` | AssetTransactionHistory, Asset | CREATE |
| `POST /api/asset/update-nobarcode` | AssetTransactionHistory, Asset | UPDATE |
| `POST /api/database/import` | AssetTransactionHistory, Asset, Document | CREATE legacy |
| `POST /api/database/update` | AssetTransactionHistory | UPDATE (whitelist) |
| `POST /api/document/approve` | AssetTransactionHistory, SecuritySetTransaction, PickAssetTask, RepairTask, Asset | CREATE / UPDATE |
| `DELETE /api/document/delete/[id]` | AssetTransactionHistory, SecuritySetTransaction, Document* | REVERT |
| `POST /api/pick-asset/complete` | AssetTransactionHistory, SecuritySetTransaction, TransferReceiveTask, DocumentAsset, Asset | UPDATE / CREATE |
| `POST /api/pick-asset/edit-barcode` | AssetTransactionHistory, PickAssetTask | UPDATE swap |
| `POST /api/repair-asset/complete` | AssetTransactionHistory, RepairTask | CREATE IN |
| `POST /api/receive-transfer/complete` | AssetTransactionHistory, TransferReceiveTask | CREATE IN / REVERT OUT |
