# MiMi Assets — โครงสร้างโปรเจค (Project Structure)

> สรุปโครงสร้างของระบบจัดการสินทรัพย์ MiMi Assets แบบละเอียด ครอบคลุมฐานข้อมูล หน้าเว็บ และ API
> วันที่สรุป: 2026-05-16

---

## 1. ภาพรวม (Overview)

ระบบบริหารจัดการ Asset / Security Set ระหว่างโกดัง (warehouse) และร้านค้า (shop)
รองรับการทำเอกสารหลายประเภท (เบิก / ส่งคืน / ย้าย / ยืม / ซ่อม) พร้อมระบบติดตามประวัติ
การเคลื่อนไหวของ Asset แบบครบวงจร (Transaction History)

### Tech Stack

| ชั้น | เทคโนโลยี |
|------|-----------|
| Framework | Next.js 15 (App Router) + Turbopack |
| Language | TypeScript |
| UI | React 19, Radix UI, Tailwind CSS v4, Lucide Icons, Framer Motion |
| Auth | NextAuth.js v4 (CredentialsProvider + JWT) |
| ORM / DB | Prisma 6 + PostgreSQL |
| Form / Export | xlsx (Excel), html2canvas, dom-to-image-more |
| Util | bcryptjs, date-fns, lodash.debounce, sonner (toast) |

### Role

- `ADMIN` — เห็นทุกหน้า อนุมัติเอกสาร จัดการ User / Shop / Asset / Library / Database
- `USER` — สร้างเอกสาร ทำงาน Pick Asset / Repair Asset / รับโอนย้าย ดู Library

---

## 2. โครงสร้างฐานข้อมูล (Database Schema)

ฐานข้อมูล PostgreSQL จัดการผ่าน Prisma — ไฟล์ schema: [prisma/schema.prisma](prisma/schema.prisma)

### 2.1 ตารางหลัก (Core Tables)

#### User
ผู้ใช้ของระบบ (Admin / User)

| ฟิลด์ | ชนิด | คำอธิบาย |
|------|------|----------|
| id | Int (PK) | auto-increment |
| username | String (unique) | ชื่อผู้ใช้ |
| email | String | อีเมล |
| password | String | bcrypt hash |
| firstName / lastName | String? | ชื่อ-สกุล |
| company | String? | บริษัท |
| vendor | String? | Vendor (จับคู่กับ `Asset.warehouse`) |
| phone | String? | เบอร์โทร |
| initials | String? | อักษรย่อ |
| role | Role enum | ADMIN / USER |
| isActive | Boolean | เปิด/ปิดการใช้งาน |
| createdAt / updatedAt | DateTime | timestamp |

ความสัมพันธ์: `documents: Document[]`

---

#### Shop
รายการร้านค้าในระบบ

| ฟิลด์ | ชนิด |
|------|------|
| id (PK), mcsCode (unique), shopName, region, state, shopType, status, createdAt, updatedAt | — |

---

#### Asset
สินทรัพย์ (ตัวจริง มี barcode)

| ฟิลด์ | คำอธิบาย |
|------|----------|
| id (PK), barcode (unique) | — |
| assetName, size | — |
| warehouse | โกดังที่เก็บ (ต้องตรงกับ `User.vendor`) |
| startWarranty, endWarranty | เก็บเป็น String |
| cheilPO | เลขที่ PO |
| statusAsset | `Ready` หรือ `NO Barcode` |
| createdAt, updatedAt | — |

Index: `barcode`, `warehouse`

---

#### LibrarySES / LibrarySIS
แค็ตตาล็อกอ้างอิงประเภทสินค้า

- **LibrarySES**: category, imageUrl, assetName, code, barcode, dimensionMm, status, remark
- **LibrarySIS**: barcode, assetName, assetType, dimension, warehouse, pictureUrl, status, remark, digit

---

### 2.2 ตารางเอกสาร (Document Tables)

#### Document
ใบเอกสารหลัก รองรับ 11 ประเภท (`documentType`)

ประเภทเอกสาร:
- `withdraw` — เบิก Asset
- `routing2shops` / `routing3shops` / `routing4shops` — ใบ Routing 2-4 ร้าน
- `borrow` — ยืม Asset
- `borrowsecurity` — ยืม Security Set
- `returnasset` — คืน Asset
- `shoptoshop` — ย้ายร้านสู่ร้าน
- `transfer` — ใบย้ายของ
- `other` — อื่นๆ
- `repair` — ใบซ่อม (admin สร้าง)

ฟิลด์เด่น:
- `docCode` (unique) เช่น `DP25011701`
- `status` — draft / submitted / approved / rejected
- `approvedAt` — วันที่อนุมัติ
- `operation` / `otherDetail` — สำหรับ transfer
- `borrowType` — `EVENT` / `TEMP SHOP`
- `returnCondition` — `normal` / `from_borrow`
- `otherActivity` — `outToRentalWarehouse`, `inToRentalWarehouse`, `discarded`, `adjustError`
- `transactionStatus` — Shop, Discarded, Repairing, Send to Rental warehouse ฯลฯ
- `transferDocImageUrl` — รูปเอกสารใบย้ายของ

ความสัมพันธ์: shops, transactions, pickTasks, repairTasks, securitySetTransactions, transferReceiveTasks

---

#### DocumentShop
ข้อมูลร้านที่อยู่ในใบเอกสาร (1:N กับ Document)

ฟิลด์: shopCode, shopName, startInstallDate, endInstallDate, q7b7, shopFocus
ความสัมพันธ์: `assets: DocumentAsset[]`, `securitySets: DocumentSecuritySet[]`

#### DocumentAsset
รายการ Asset ในร้านของเอกสาร

ฟิลด์: name, size, kv, qty, withdrawFor, barcode, grade

#### DocumentSecuritySet
รายการ Security Set ในร้านของเอกสาร

ฟิลด์: name, qty, withdrawFor, barcode (สำหรับ CONTROLBOX)

---

### 2.3 ตาราง Task (งานที่ต้องทำ)

#### PickAssetTask
งานหยิบของ — Picker ต้องกรอก barcode + รูปถ่าย

ฟิลด์เด่น:
- `assetName, size, grade, qty, isSecuritySet`
- `warehouse` — โกดังที่ต้อง pick (กรองให้ picker ที่ตรง vendor)
- ข้อมูลร้าน: shopCode, shopName, startInstallDate, endInstallDate, q7b7, shopFocus
- ข้อมูลผู้เบิก: requesterName, requesterCompany, requesterPhone
- `transactionStatus` — บันทึกลง Transaction History
- `status` — pending / picking / completed
- `barcode, barcodeImageUrl, assetImageUrl` — ผลการ pick
- `completedAt, completedBy`

#### RepairTask
งานซ่อม

ฟิลด์เด่น:
- barcode, assetName, size, grade
- `repairWarehouse` — โกดังซ่อม
- ข้อมูลผู้แจ้งซ่อม: reporterName, reporterCompany, reporterPhone, reporterVendor
- `status` — pending / repairing / completed
- `repairStartDate, repairEndDate`
- `transactionId` — เชื่อมกับ AssetTransactionHistory (สำหรับอัปเดตขา OUT)

#### TransferReceiveTask
งานรับของโอนย้าย (เกิดต่อจาก PickAssetTask ใน flow transfer)

ฟิลด์เด่น:
- `pickAssetTaskId` — อ้างอิงงาน Pick ต้นทาง
- barcode, assetName, size, grade
- `fromWarehouse, toWarehouse`
- `status` — pending / received / rejected
- `rejectReason, assetImageUrl`
- `receivedAt, receivedBy`

---

### 2.4 ตารางประวัติการเคลื่อนไหว (Transaction History)

#### AssetTransactionHistory
ประวัติการเคลื่อนไหวของ Asset (36+ คอลัมน์) แบ่งเป็น 4 กลุ่ม

**1) Asset Info (8 col)**: barcode, assetName, startWarranty, endWarranty, cheilPO, budget, size, grade

**2) ขา IN (7 col)**: warehouseIn, inStockDate, unitIn, fromVendor, mcsCodeIn, fromShop, remarkIn

**3) ขา OUT (7 col)**: outDate, unitOut, toVendor, status, shopType, mcsCodeOut, toShop, remarkOut

**4) Auto by Logic (13 col)**:
- `assetStatus` — NEW / USED / REFURBISHED (auto)
- `balance` — 1 = มีของ, 0 = ออกไปแล้ว (auto)
- คอลัมน์สถิติรายสัปดาห์ Format `"2025 WK 23"`:
  wkOut, wkIn, wkOutForRepair, wkInForRepair, newInStock, refurbishedInStock,
  borrow, return, repair, outToRentalWarehouse, inToRentalWarehouse, discarded, adjustError

Metadata: createdAt, updatedAt, approvedAt, approvedBy
Index: documentId, barcode, inStockDate, outDate, assetStatus, balance

#### SecuritySetTransaction
โครงสร้างใกล้เคียง `AssetTransactionHistory` แต่สำหรับ Security Set

รองรับเฉพาะ 3 Asset Names:
1. `CONTROLBOX 6 PORT (M-60000R) with power cable` (มี Barcode)
2. `Security Type C Ver.7.1` (ไม่มี Barcode)
3. `Security Type C Ver.7.0` (ไม่มี Barcode)

มี `docCode` เป็นคอลัมน์แรก
Index: documentId, docCode, barcode, assetName, inStockDate, outDate, balance

---

### 2.5 ตารางตรวจสอบ (Audit)

#### AuditLog
บันทึกการทำรายการของผู้ใช้

| ฟิลด์ | คำอธิบาย |
|------|----------|
| id, userId, username, userRole | snapshot ผู้ใช้ |
| action | DOCUMENT_CREATE / DOCUMENT_APPROVE / USER_LOGIN ฯลฯ |
| entity | Document / Asset / User / Shop |
| entityId | ID ของ entity |
| detail (Json) | ข้อมูลเพิ่ม เช่น docCode, barcode |
| ipAddress, userAgent | — |
| createdAt | — |

Index: userId, action, entity, createdAt

---

### 2.6 ความสัมพันธ์โดยรวม (ER สรุป)

```
User ───< Document ───< DocumentShop ───< DocumentAsset
                   │                  └─< DocumentSecuritySet
                   ├──< PickAssetTask ──< TransferReceiveTask
                   ├──< RepairTask
                   ├──< AssetTransactionHistory
                   └──< SecuritySetTransaction

Asset (standalone, lookup by barcode)
Shop  (standalone, lookup by mcsCode)
LibrarySES / LibrarySIS (catalog)
AuditLog (cross-cutting log)
```

---

## 3. โครงสร้างหน้าเว็บ (Page Structure)

ไฟล์เริ่มต้น: [src/app/](src/app/) (App Router)

### 3.1 หน้าสาธารณะ (Public)

| Path | ไฟล์ | คำอธิบาย |
|------|------|----------|
| `/` | [src/app/page.tsx](src/app/page.tsx) | Landing / redirect |
| `/login` | [src/app/login/page.tsx](src/app/login/page.tsx) | หน้าเข้าสู่ระบบ |

### 3.2 หน้า Preview เอกสาร (สำหรับ download/print PDF)

ทุกไฟล์อยู่ใต้ `/src/app/preview-document-*`

| Path | ใช้กับเอกสาร |
|------|--------------|
| `/preview-document` | withdraw |
| `/preview-document-routing` | routing 2 ร้าน |
| `/preview-document-routing-3shops` | routing 3 ร้าน |
| `/preview-document-routing-4shops` | routing 4 ร้าน |
| `/preview-document-borrow` | borrow |
| `/preview-document-borrow-only` | borrow security |
| `/preview-document-return` | return asset |
| `/preview-document-shop-to-shop` | shop to shop |
| `/preview-document-transfer` | transfer |
| `/preview-document-other` | other |
| `/preview-document-repair` | repair |

---

### 3.3 Dashboard (ต้อง Login)

Layout หลัก: [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx)
มี Sidebar แยกเมนูตาม `role` (ADMIN / USER)

#### หน้าหลัก
- `/dashboard` — แดชบอร์ด ([src/app/dashboard/page.tsx](src/app/dashboard/page.tsx))

---

#### 3.3.1 เมนู USER

| เมนู | Path | ไฟล์ |
|------|------|------|
| แดชบอร์ด | `/dashboard` | dashboard/page.tsx |
| สร้างเอกสาร | `/dashboard/user-document` | [user-document/page.tsx](src/app/dashboard/user-document/page.tsx) |
| รายการเอกสาร | `/dashboard/user-list` | [user-list/page.tsx](src/app/dashboard/user-list/page.tsx) |
| Pick Asset | `/dashboard/user-pick` | [user-pick/page.tsx](src/app/dashboard/user-pick/page.tsx) |
| รับของโอนย้าย | `/dashboard/receive-transfer` | [receive-transfer/page.tsx](src/app/dashboard/receive-transfer/page.tsx) |
| Repair Asset | `/dashboard/repair-asset` | [repair-asset/page.tsx](src/app/dashboard/repair-asset/page.tsx) |
| **Group: คลังข้อมูล** | | |
| ↳ Library SES | `/dashboard/library-ses` | [library-ses/page.tsx](src/app/dashboard/library-ses/page.tsx) |
| ↳ Library SIS | `/dashboard/library-sis` | [library-sis/page.tsx](src/app/dashboard/library-sis/page.tsx) |

**หน้าฟอร์มสร้างเอกสาร (USER) — Dynamic `[id]`:**

| ประเภท | Path |
|--------|------|
| Withdraw | `/dashboard/user-document/withdraw/[id]` |
| Routing 2 ร้าน | `/dashboard/user-document/routing2shops/[id]` |
| Routing 3 ร้าน | `/dashboard/user-document/routing3shops/[id]` |
| Routing 4 ร้าน | `/dashboard/user-document/routing4shops/[id]` |
| Borrow | `/dashboard/user-document/borrow/[id]` |
| Borrow Security | `/dashboard/user-document/borrow-security/[id]` |
| Return Asset | `/dashboard/user-document/return-asset/[id]` |
| Shop to Shop | `/dashboard/user-document/shop-to-shop/[id]` |
| Transfer | `/dashboard/user-document/transfer/[id]` |
| Other | `/dashboard/user-document/other/[id]` |
| Repair | `/dashboard/user-document/repair/[id]` |

**หน้า Pick / Receive (USER):**
- `/dashboard/user-pick/[id]` — รายละเอียดงาน Pick
- `/dashboard/receive-transfer/[id]` — รายละเอียดงานรับโอนย้าย

**หน้าแก้ไขเอกสารแยก (USER):**
- `/user/document/edit/[id]` — แก้ไขเอกสาร
- `/user/list` — รายการเอกสารแบบเก่า

---

#### 3.3.2 เมนู ADMIN

| เมนู | Path | ไฟล์ |
|------|------|------|
| แดชบอร์ด | `/dashboard` | dashboard/page.tsx |
| รายการเอกสาร | `/dashboard/admin-list` | [admin-list/page.tsx](src/app/dashboard/admin-list/page.tsx) |
| Database | `/dashboard/admin-database` | [admin-database/page.tsx](src/app/dashboard/admin-database/page.tsx) |
| Database Security Set | `/dashboard/admin-database-security-set` | [admin-database-security-set/page.tsx](src/app/dashboard/admin-database-security-set/page.tsx) |
| **Group: ดูรายการทำงาน** | | |
| ↳ Pick Asset | `/dashboard/admin-pick` | [admin-pick/page.tsx](src/app/dashboard/admin-pick/page.tsx) |
| ↳ รับของโอนย้าย | `/dashboard/admin-receive-transfer` | [admin-receive-transfer/page.tsx](src/app/dashboard/admin-receive-transfer/page.tsx) |
| ↳ Repair Asset | `/dashboard/admin-repair-asset` | [admin-repair-asset/page.tsx](src/app/dashboard/admin-repair-asset/page.tsx) |
| **Group: จัดการระบบ** | | |
| ↳ User | `/dashboard/admin-user` | [admin-user/page.tsx](src/app/dashboard/admin-user/page.tsx) |
| ↳ Shop | `/dashboard/admin-shop` | [admin-shop/page.tsx](src/app/dashboard/admin-shop/page.tsx) |
| ↳ Asset | `/dashboard/admin-asset` | [admin-asset/page.tsx](src/app/dashboard/admin-asset/page.tsx) |
| ↳ Library SES | `/dashboard/admin-library-ses` | [admin-library-ses/page.tsx](src/app/dashboard/admin-library-ses/page.tsx) |
| ↳ Library SIS | `/dashboard/admin-library-sis` | [admin-library-sis/page.tsx](src/app/dashboard/admin-library-sis/page.tsx) |
| Audit Log | `/dashboard/admin-audit-log` | [admin-audit-log/page.tsx](src/app/dashboard/admin-audit-log/page.tsx) |

**หน้า Admin Document (ดู/อนุมัติ) — Dynamic `[id]`:**

| ประเภท | Path |
|--------|------|
| Withdraw | `/dashboard/admin-document/withdraw/[id]` |
| Routing 2 ร้าน | `/dashboard/admin-document/routing2shops/[id]` |
| Routing 3 ร้าน | `/dashboard/admin-document/routing3shops/[id]` |
| Routing 4 ร้าน | `/dashboard/admin-document/routing4shops/[id]` |
| Borrow | `/dashboard/admin-document/borrow/[id]` |
| Borrow Security | `/dashboard/admin-document/borrow-security/[id]` |
| Return Asset | `/dashboard/admin-document/return-asset/[id]` |
| Shop to Shop | `/dashboard/admin-document/shop-to-shop/[id]` |
| Transfer | `/dashboard/admin-document/transfer/[id]` |
| Other | `/dashboard/admin-document/other/[id]` |
| Repair | `/dashboard/admin-document/repair/[id]` |

**หน้าทำงาน Admin (Detail):**
- `/dashboard/admin-pick/[id]` — รายละเอียดงาน Pick
- `/dashboard/admin-receive-transfer/[id]` — รายละเอียดงานรับโอนย้าย

---

## 4. โครงสร้าง API (Route Handlers)

ทุกไฟล์อยู่ใต้ `src/app/api/*/route.ts`

### 4.1 Auth
| Method+Path | คำอธิบาย |
|-------------|----------|
| POST `/api/auth/[...nextauth]` | NextAuth handler |
| POST `/api/login` | login |
| POST `/api/user/login` / `/api/user/logout` | session control |
| GET `/api/user/me` | ดึงผู้ใช้ปัจจุบัน |

### 4.2 User
- `GET/POST /api/user` — รายการ / สร้าง
- `GET/PUT/DELETE /api/user/[id]` — รายตัว

### 4.3 Document
- `GET /api/document/list` — รายการเอกสารของ user
- `GET /api/document/list-all` — รายการทั้งหมด (admin)
- `GET /api/document/detail/[id]` — รายละเอียด
- `POST /api/document/create` — สร้าง
- `PUT /api/document/update/[id]` — แก้ไข
- `POST /api/document/approve` — อนุมัติ
- `POST /api/document/reject` — ปฏิเสธ
- `DELETE /api/document/delete/[id]` — ลบ
- `POST /api/document/generate` — สร้าง docCode
- `GET /api/document` — generic

### 4.4 Pick Asset
- `GET /api/pick-asset/all-tasks` — admin ดูทั้งหมด
- `GET /api/pick-asset/my-tasks` — user ดูของตัวเอง
- `GET /api/pick-asset/task/[id]` — รายตัว
- `POST /api/pick-asset/complete` — Picker ทำเสร็จ
- `POST /api/pick-asset/cancel` — ยกเลิก
- `POST /api/pick-asset/update-barcode` — อัปเดต barcode
- `POST /api/pick-asset/edit-barcode` — แก้ไข barcode
- `POST /api/pick-asset/[id]/update-image` — อัปเดตรูป
- `GET /api/pick-asset/available-barcodes` — barcode ว่างในโกดัง

### 4.5 Repair / Transfer
- `GET /api/repair-asset/tasks` / `/all-tasks` — รายการ
- `POST /api/repair-asset/complete` — ซ่อมเสร็จ
- `GET /api/receive-transfer` / `/all-tasks` / `/[id]` — รายการ / รายตัว
- `POST /api/receive-transfer/complete` — รับเสร็จ

### 4.6 Asset
- `GET /api/asset` — รายการ
- `GET /api/asset/search` / `/searchByBarcode` — ค้นหา
- `GET /api/asset/sizes` / `/names` — dropdown
- `GET /api/asset/warehouse` — โกดัง
- `GET /api/asset/export` — Excel export
- `POST /api/asset/import` / `/import-used` / `/import-refurbished` — Excel import
- `POST /api/asset/generate-nobc` — gen barcode
- `POST /api/asset/update-nobarcode` — อัปเดต no-barcode

### 4.7 Shop
- `GET/POST /api/shop` — list / create
- `GET /api/shop/search` — ค้นหา
- `GET /api/shop/export` / `POST /api/shop/import` — Excel
- `POST /api/shop/toggle-status` — toggle active

### 4.8 Database / Security Set
- `GET /api/database` — รายการ Transaction History
- `GET /api/database/export` — Excel export
- `POST /api/database/import` — Excel import
- `POST /api/database/update` — แก้ไขรายการ
- `GET /api/database-security-set` — Security Set transactions
- `GET /api/database-security-set/export` — export
- `POST /api/database-security-set/update` — แก้ไข

### 4.9 Library / Vendor / Upload
- `GET /api/library/ses` / `sis` — ดึงรายการ
- `GET /api/library/get-image` — ดึงรูป
- `POST /api/library/ses/import` / `sis/import` — Excel import
- `POST /api/library/ses/upload-images` / `sis/upload-images` — อัปโหลดรูป
- `POST /api/upload/image` — อัปโหลดรูปทั่วไป
- `GET /api/vendor/list` — รายการ vendor

### 4.10 Dashboard / Audit
- `GET /api/dashboard` — สถิติแดชบอร์ด
- `GET /api/audit-log` — รายการ log (filterable: action, entity, username, date)

---

## 5. โครงสร้าง Component

ไฟล์อยู่ใต้ [src/components/ui/](src/components/ui/)

### 5.1 UI Primitive (Radix-based)
button, card, badge, dialog, alert-dialog, select, checkbox, radio-group, tabs, table, scroll-area, label, input, SimplePagination

### 5.2 Admin Component
[src/components/ui/admin/](src/components/ui/admin/)
- AdminList, AdminUserManage, AdminShopManage, AdminAssetManage
- AdminDatabase, AdminDatabaseSecuritySet
- AdminPickAsset, AdminRepairAsset, AdminReceiveTransfer
- AdminLibrarySES, AdminLibrarySIS
- AdminAuditLog
- OtherActivitiesSelect, TransactionStatusSelect, StatusSelect

### 5.3 User Component
[src/components/ui/user/](src/components/ui/user/)
- UserList, UserDocument, UserPickAsset
- UserLibrarySES, UserLibrarySIS
- Pickassetdetail, SidebarGroupUser

### 5.4 Document Forms
[src/components/ui/user/document/](src/components/ui/user/document/)
- FormWithdrawAsset, FormReturnAsset
- FormRouting2Shops / 3Shops / 4Shops
- FormBorrow, FormBorrowSecurity
- FormShopToShop, FormTransfer, FormOther, FormRepair

### 5.5 Document Tools
[src/components/ui/document/](src/components/ui/document/)
- DocumentDownload (สร้าง PDF/รูปจาก preview)
- DocumentTemplateSelector
- PreviewApproveModal
- ImageUploadDialog, BulkImageUploader

---

## 6. Library / Helper

ไฟล์อยู่ใต้ [src/lib/](src/lib/)

| ไฟล์ | หน้าที่ |
|------|---------|
| [prisma.ts](src/lib/prisma.ts) | Prisma Client singleton |
| [auth.ts](src/lib/auth.ts) | NextAuth config + `events.signIn` audit |
| [authOptions.ts](src/lib/authOptions.ts) | Options แยก |
| [auth-helpers.ts](src/lib/auth-helpers.ts) | Helper สำหรับตรวจ session ใน route |
| [audit-log.ts](src/lib/audit-log.ts) | `writeAuditLog()`, `getSessionUser()`, `AuditAction` constants |
| [downloadDocument.ts](src/lib/downloadDocument.ts) | สร้างไฟล์เอกสารสำหรับ download |
| [image-compress.ts](src/lib/image-compress.ts) | บีบอัดรูปก่อน upload |
| [email.ts](src/lib/email.ts) | ส่งอีเมล |
| [utils.ts](src/lib/utils.ts) | `cn()` (Tailwind merge) ฯลฯ |

---

## 7. Flow การทำงานหลัก

### 7.1 Flow เบิก/อนุมัติ
```
USER สร้างเอกสาร (draft → submitted)
   → ADMIN เปิดดูในหน้า admin-document/<type>/[id]
   → ADMIN อนุมัติ → /api/document/approve
       ├── สร้าง PickAssetTask (async) — สำหรับเอกสารที่ต้อง pick
       └── หรือบันทึก AssetTransactionHistory โดยตรง
```

### 7.2 Flow Pick Asset
```
ADMIN approve → PickAssetTask (status=pending)
   → Picker (USER ที่ vendor ตรง warehouse) เห็นใน /dashboard/user-pick
   → Picker เปิด [id] → กรอก barcode + ถ่ายรูป
   → /api/pick-asset/complete → สร้าง AssetTransactionHistory ขา OUT
```

### 7.3 Flow Transfer
```
PickAssetTask completed (transfer doc)
   → สร้าง TransferReceiveTask (status=pending)
   → ผู้รับเปิด /dashboard/receive-transfer/[id]
   → กดยืนยัน → /api/receive-transfer/complete → สร้าง Transaction ขา IN
```

### 7.4 Flow Repair
```
ADMIN สร้างใบ repair → RepairTask (status=pending)
   → Picker (โกดังซ่อม) ทำซ่อมเสร็จ → /api/repair-asset/complete
   → อัปเดต AssetTransactionHistory ขา OUT (repair) + สร้าง IN
```

### 7.5 Flow Audit
ทุก action สำคัญเรียก `writeAuditLog()` → บันทึก `AuditLog` (silent, ไม่ block request)
- DOCUMENT_CREATE / SUBMIT / APPROVE / REJECT / UPDATE / DELETE
- PICK_TASK_COMPLETE / CANCEL
- REPAIR_TASK_COMPLETE
- TRANSFER_RECEIVE_COMPLETE
- USER_CREATE / UPDATE / DELETE / LOGIN
- SHOP_TOGGLE_STATUS
- ASSET_IMPORT_NEW / DATABASE_IMPORT

---

## 8. ไฟล์ Migration (Prisma)

ไฟล์อยู่ใต้ [prisma/migrations/](prisma/migrations/) — 22 migration ครอบคลุม
init users → library SES/SIS → shop → asset (+warranty, PO, warehouse) → document
→ document-shop relations → AssetTransactionHistory → PickAssetTask → RepairTask
→ SecuritySetTransaction → audit log

---

## 9. คำสั่งสำคัญ

```powershell
# Dev
npm run dev              # next dev --turbopack

# Build / Start
npm run build
npm start

# Prisma
npx prisma migrate dev   # apply migration ใน dev
npx prisma migrate deploy # apply ใน prod
npx prisma generate      # gen client
npx prisma studio        # เปิด DB GUI

# Lint
npm run lint
```

---

> สรุปจากการสแกน schema, page tree, API tree และ layout sidebar ในวันที่ 2026-05-16
