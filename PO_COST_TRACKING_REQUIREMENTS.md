# PO Cost Tracking — Project Requirements

> เมนูใหม่สำหรับ ADMIN ในระบบ MiMi Assets: อัปโหลด PDF (Cheil PO + Samsung PO + ใบเสนอราคา) → AI ดึงข้อมูล → ตรวจ/แก้ → สะสมเป็นตาราง → Export Excel
> อัปเดต: 2026-09-29

---

## 1. ภาพรวม

### 1.1 ปัญหา
การติดตามค่าใช้จ่ายของงาน PO ปัจจุบันต้องเปิด PDF 3 ใบต่อ job แล้วคีย์ข้อมูลลง Excel เอง ช้าและผิดพลาดง่าย

### 1.2 เป้าหมาย
- Admin อัปโหลด PDF 3 ใบของ 1 job → ระบบใช้ Claude (vision) อ่านและดึงข้อมูลให้อัตโนมัติ
- ตรวจ/แก้ข้อมูลก่อนบันทึก
- อัปโหลด job ถัดไปได้ต่อเนื่อง (stack) สะสมเป็นตารางเดียว
- Export เป็น Excel ตาม template 28 คอลัมน์

### 1.3 ขอบเขต
- **เป็นฟีเจอร์ใหม่ล้วน ไม่กระทบระบบเดิม** — ตารางใหม่, API namespace ใหม่ (`/api/po-tracking/*`), หน้าใหม่ (`/dashboard/admin-po-tracking`)
- แก้ไฟล์เดิมเพียง 3 จุด (เพิ่มบรรทัดเท่านั้น): `middleware.ts` (adminOnlyPaths), `src/app/dashboard/layout.tsx` (ADMIN_MENU), `src/lib/audit-log.ts` (AuditAction)
- สิทธิ์: **ADMIN เท่านั้น**

---

## 2. เอกสารที่ระบบรองรับ

ระบบรู้จักเอกสาร **3 ประเภทเท่านั้น** เอกสารอื่นให้ปฏิเสธพร้อมแจ้งเตือน

| ประเภท | ลักษณะที่ใช้ระบุ | ข้อมูลที่ดึง |
|---|---|---|
| **Cheil PO** | โลโก้ Cheil, หัว "Purchase Order", ผู้ออก Cheil (Thailand) Ltd. ส่งถึง vendor | P/O No., P/O Date, Job, Vendor, Subject, รายการ asset (description/qty/unit price/amount) |
| **Samsung PO** | หัว "BQMS Purchase Order", ผู้ซื้อ Thai Samsung Electronics, Vendor = CHEIL | P/O No., P/O Date, เลข Job ที่อ้างอิง (เช่น `PE THET..._THP26064167`) |
| **ใบเสนอราคา** | มีคำว่า "Quotation" หรือ "ใบเสนอราคา" | บริษัทผู้ออก, วันที่เอกสาร (Estimate Date / วันที่), รายการสินค้า |

**รูปแบบไฟล์:** อัปโหลดแยกไฟล์ละ 1 เอกสาร หรือรวมหลายเอกสารในไฟล์เดียวหลายหน้าก็ได้ (เช่น หน้า 1 Cheil PO, หน้า 2 Samsung PO, หน้า 3 ใบเสนอราคา) — AI แบ่งเอกสารตามหน้าให้เอง เอกสารใบเดียวที่ยาวหลายหน้านับเป็น 1 ใบ

**ข้อสังเกตสำคัญ:** ใบเสนอราคาบาง vendor (เช่น RICCO 65) มี text layer ของ PDF เพี้ยน ดึงข้อความตรงๆ ไม่ได้ → ระบบจึงส่ง PDF ให้ Claude อ่านแบบ vision (เห็นเป็นภาพ) ทุกเอกสาร

---

## 3. Workflow

```
[กดอัปโหลด Job]
   → ลากวาง PDF (สูงสุด 5 ไฟล์, .pdf, รวมไม่เกิน 9MB — แยกไฟล์หรือรวมไฟล์เดียวหลายหน้าก็ได้,
     เอกสาร/หน้าที่ไม่ใช่ 3 ประเภทจะถูกข้าม)
   → POST /api/po-tracking/extract
        ├─ Claude จำแนกประเภท + ดึงข้อมูลแต่ละไฟล์
        ├─ ตรวจว่าครบ Cheil PO / Samsung PO / ใบเสนอราคา อย่างละ 1 ใบ
        │     ไม่ครบ/ซ้ำ → แจ้ง error ระบุชัดว่าไฟล์ไหนเป็นอะไร
        │     เอกสารประเภทอื่น → ข้าม (แสดงว่า "ไม่รู้จัก")
        └─ แตกเป็นแถวตาม asset + ตรวจความสอดคล้อง → คืนแถวที่เสนอ + คำเตือน
   → หน้าตรวจสอบ (แก้ไขได้ทุกช่อง, แสดงคำเตือน)
   → [ยืนยันบันทึก] → POST /api/po-tracking/create
   → กลับหน้าอัปโหลดว่าง พร้อมรับ job ถัดไป (stack)
```

- **ไม่มีการเขียนไฟล์ PDF ลงดิสก์เลย** — ประมวลผลในหน่วยความจำแล้วทิ้งทันทีหลัง request จบ (ป้องกันพื้นที่ดิสก์บวมบน Lightsail)
- ยังไม่บันทึกลง DB จนกว่าผู้ใช้กดยืนยันในหน้าตรวจสอบ

---

## 4. การแตกแถว (1 job → N แถว)

ยึด **Cheil PO เป็นหลัก** — ถ้าใน Cheil PO มีรายละเอียดหลายงานในแถวเดียว ต้องแยกเป็นหลายแถว

ตัวอย่าง Cheil PO:
```
REPAIR CLOSE SALES TABLE AND STOOL
- REPAIR CLOSE SALES TABLE 6 UNITS  (6 UNITS X 3,500.00 = 21,000.00)
- REPAIR CLOSE SALES STOOL 12 UNITS (12 UNITS X 1,400.00 = 16,800.00)
```
ได้ 2 แถว:

| ASSET TYPE | ORDER QTY | Cost per unit | Total Cost |
|---|---|---|---|
| REPAIR CLOSE SALES TABLE 6 UNITS | 6 | 3,500 | 21,000 |
| REPAIR CLOSE SALES STOOL 12 UNITS | 12 | 1,400 | 16,800 |

แถวใน job เดียวกันใช้ค่าระดับ job ร่วมกัน (VENDOR, Job Type, ESTIMATE, SS PO, DATE, CH PO, DATE3, JOB NO.) และผูกกันด้วย `jobGroupId`

---

## 5. Mapping คอลัมน์ (28 คอลัมน์ ตามลำดับ template)

| # | คอลัมน์ | ที่มา | เงื่อนไข |
|---|---|---|---|
| 1 | No. | ว่าง | กรอกเอง |
| 2 | VENDOR | ใบเสนอราคา | ดูว่าผู้ออกเป็นบริษัทใดใน [รายชื่อ vendor](#6-รายชื่อ-vendor) แล้วใส่ชื่อตามลิสต์ |
| 3 | Job Type | Cheil PO | ดูข้อความหลัง `Subject:` ส่วนที่อยู่หลัง `:` ถัดไป หาคีย์เวิร์ดตาม [ลิสต์](#7-คีย์เวิร์ด-job-type) ใส่ตามตัวสะกดในลิสต์ |
| 4 | ASSET TYPE | Cheil PO (เทียบใบเสนอราคา + Samsung PO) | 1 แถวต่อ 1 รายการ asset |
| 5 | Asset Type2 | ว่าง | กรอกเอง |
| 6 | ORDER QTY | Cheil PO | จำนวนของรายการนั้น |
| 7 | ESTIMATE | ใบเสนอราคา | วันที่เอกสาร ฟอร์แมต `D/M/YYYY` เช่น `30/7/2026` |
| 8 | Total Cost | Cheil PO / ใบเสนอราคา | ราคารวมของรายการนั้น |
| 9 | Cost per unit | Cheil PO / ใบเสนอราคา | ราคาต่อหน่วยของรายการนั้น |
| 10 | New Production Unit Price | ว่าง | กรอกเอง |
| 11 | Saving cost per unit | ว่าง | กรอกเอง |
| 12 | Saving cost per unit (%) | ว่าง | กรอกเอง |
| 13 | Total New Production | ว่าง | กรอกเอง |
| 14 | Total Saving cost | ว่าง | กรอกเอง |
| 15 | SS PO | Samsung PO | เลข P/O เช่น `T26C5A0004121` |
| 16 | DATE | Samsung PO | วันที่ P/O ฟอร์แมต `D/M/YYYY` |
| 17 | Quarter | ว่าง | กรอกเอง (ไม่คำนวณอัตโนมัติ) |
| 18 | Month | ว่าง | กรอกเอง (ไม่คำนวณอัตโนมัติ) |
| 19 | CH PO | Cheil PO | เลข P/O เช่น `THPI2602642` |
| 20 | DATE3 | Cheil PO | วันที่ P/O ฟอร์แมต `D/M/YYYY` |
| 21 | JOB NO. | Cheil PO | field `Job` เช่น `THP26064167` |
| 22 | Done BY | ว่าง | กรอกเอง |
| 23 | ACTUAL LEADTIME | ว่าง | กรอกเอง |
| 24 | Targeting Leadtime | ว่าง | กรอกเอง |
| 25 | STATUS | ว่าง | กรอกเอง |
| 26 | PM | ว่าง | กรอกเอง |
| 27 | Sent Report to TSE | ว่าง | กรอกเอง |
| 28 | Remark 1 | ว่าง | กรอกเอง |

> หมายเหตุ: วันที่ในเอกสารมีหลายรูปแบบ (Cheil `13-08-2026` = วัน-เดือน, Samsung `8/11/2026` = เดือน/วัน แบบอเมริกัน มี `(11/08/2026)` กำกับ, ใบเสนอราคา `4/8/2026` = วัน/เดือน) — ให้ AI ตีความตามบริบทของเอกสารแต่ละประเภทแล้วแปลงเป็น `D/M/YYYY` เสมอ

---

## 6. รายชื่อ Vendor

```
THAIARUS, RICCO, NEWLOOK, LEGEND, TDT, NATTHAKIT, 9RAEK, Cheil PH,
WORKO PLUS, DOUBLE P, TNB, New Look, ONERX, Future, Neri,
Imaginative, AdRun, Double B
```
- จับคู่แบบไม่สนตัวพิมพ์เล็กใหญ่/ช่องว่าง/เครื่องหมาย (เช่น "New Look Design Co., Ltd" → `New Look`, "บริษัท ริคโค่ 65 จำกัด" / "RICCO 65" → `RICCO`)
- ถ้าจับคู่ไม่ได้ → เว้นว่าง + แสดงคำเตือนให้ผู้ใช้เลือกเอง
- เก็บเป็นค่าคงที่ใน `src/lib/po-tracking/constants.ts` แก้ไขเพิ่มได้ภายหลัง
- **ต้องยืนยัน:** ลิสต์มีทั้ง `NEWLOOK` และ `New Look` ซึ่งเป็นบริษัทเดียวกัน ปัจจุบันระบบเลือก `New Look` — ถ้าต้องการ `NEWLOOK` หรือเป็นคนละบริษัทกัน ให้แก้ลิสต์/prompt ใน `extract.ts`

## 7. คีย์เวิร์ด Job Type

```
Repair, Transportation, Production, Checking, Modify, Spare part
```
ตัวอย่าง: `Subject: 2026 TSE MX SHOP (3Q Bill-through) : REPAIR CLOSE SALES TABLE ...` → ข้อความหลัง `:` มี "REPAIR" → Job Type = `Repair`

---

## 8. การตรวจสอบโดย AI (คำเตือน)

คำเตือนแสดงในหน้าตรวจสอบ **ไม่บล็อกการบันทึก**:
- หา VENDOR ในลิสต์ไม่เจอ
- หา Job Type คีย์เวิร์ดไม่เจอ
- JOB NO. ใน Cheil PO ไม่ตรงกับเลขที่อ้างอิงใน Samsung PO / ใบเสนอราคา
- ยอดรวม Cheil PO (ก่อน VAT) ≠ ยอดรวม Samsung PO / ใบเสนอราคา
- Qty × Cost per unit ≠ Total Cost ในแถวใดแถวหนึ่ง
- จำนวนรายการ Cheil PO ไม่ตรงกับใบเสนอราคา
- ข้อสังเกตอื่นๆ ที่ AI พบระหว่างอ่านเอกสาร

---

## 9. หน้าจอ

### 9.1 หน้าหลัก `/dashboard/admin-po-tracking`
- เมนู "PO Cost Tracking" ใน sidebar ของ Admin
- ตารางแสดงทุกแถว 28 คอลัมน์ + ค้นหา (JOB NO./CH PO/SS PO/VENDOR/ASSET TYPE) + แบ่งหน้า
- ปุ่ม: **อัปโหลด Job**, **โหมดแก้ไข** (แก้ inline แล้วบันทึกเฉพาะช่องที่เปลี่ยน), **Export Excel**, ลบทั้ง job

### 9.2 Dialog อัปโหลด + ตรวจสอบ (dialog เดียว 2 ขั้น)
**ขั้นอัปโหลด**
- Drag & drop / คลิกเลือก PDF สูงสุด 5 ไฟล์ (รวม ≤ 9MB), เปิดดูไฟล์ในเบราว์เซอร์ได้ก่อนส่ง
- ระหว่างประมวลผลแสดงสถานะกำลังอ่านเอกสาร
- ถ้าเอกสารไม่ครบชุด แสดงประเภทที่ AI ตรวจพบของแต่ละไฟล์ + ข้อความ error

**ขั้นตรวจสอบ**
- แสดงประเภทเอกสารที่ AI ตรวจพบของแต่ละไฟล์ (กดดู PDF ได้)
- ตารางแถวที่เสนอ แก้ไขได้ทุกช่อง (VENDOR / Job Type มีตัวเลือกให้) เพิ่ม/ลบแถวได้
- กล่องคำเตือน
- ปุ่ม ยกเลิก / บันทึก / บันทึก + อัปโหลด job ถัดไป

---

## 10. สถาปัตยกรรม

### 10.1 ไฟล์ใหม่
```
prisma/schema.prisma                               (+ model PoTrackingRow)
prisma/migrations/20260929000000_add_po_tracking/  สร้างตาราง PoTrackingRow
src/lib/po-tracking/constants.ts                   คอลัมน์ 28 ช่อง, vendor, keyword, sanitize ข้อมูล
src/lib/po-tracking/extract.ts                     เรียก Claude (PDF → JSON) + แปลง error เป็นข้อความไทย
src/lib/po-tracking/mapping.ts                     แตกแถว + จับคู่ + ตรวจสอบ (pure function)
src/lib/po-tracking/search.ts                      เงื่อนไขค้นหา (ใช้ร่วม list/export)
src/app/api/po-tracking/route.ts                   GET list (?page, ?limit, ?q)
src/app/api/po-tracking/extract/route.ts           POST อ่าน PDF (ไม่บันทึก)
src/app/api/po-tracking/create/route.ts            POST บันทึกแถว
src/app/api/po-tracking/update/route.ts            PUT แก้ไข (เฉพาะช่องที่เปลี่ยน)
src/app/api/po-tracking/[jobGroupId]/route.ts      DELETE ลบทั้ง job
src/app/api/po-tracking/export/route.ts            GET Excel (?q)
src/app/dashboard/admin-po-tracking/page.tsx
src/components/ui/admin/po-tracking/AdminPoTracking.tsx   หน้าหลัก
src/components/ui/admin/po-tracking/PoJobDialog.tsx       อัปโหลด + ตรวจสอบ
src/components/ui/admin/po-tracking/PoRowsTable.tsx       ตาราง 28 คอลัมน์ (ใช้ร่วมกัน)
```

### 10.2 ไฟล์เดิมที่แก้ (เพิ่มบรรทัดเท่านั้น)
- `middleware.ts` — เพิ่ม `"/api/po-tracking"` ใน `adminOnlyPaths`
- `src/app/dashboard/layout.tsx` — เพิ่มเมนูใน `ADMIN_MENU`
- `src/lib/audit-log.ts` — เพิ่ม `PO_TRACKING_*` ใน `AuditAction`
- `package.json` — เพิ่ม `@anthropic-ai/sdk`

### 10.3 Database: `PoTrackingRow`
- `jobGroupId` (uuid) — ผูกแถวใน job เดียวกัน
- 28 ฟิลด์ตาม template: ตัวเลข (`orderQty`, `totalCost`, `costPerUnit`) เป็น `Float?` ที่เหลือเป็น `String?`
- `aiRaw` (Json) — ผลดิบจาก AI ไว้ตรวจสอบย้อนหลัง
- `createdById`, `createdAt`, `updatedAt`
- ไม่มี relation กับตารางเดิม (เก็บ `createdById` เป็น Int เฉยๆ เพื่อไม่แตะ model `User`)

### 10.4 AI
- SDK: `@anthropic-ai/sdk` (v0.128)
- Model: ตั้งผ่าน env `PO_TRACKING_MODEL` (default `claude-sonnet-5`; ถ้าอ่านใบเสนอราคาที่ text เพี้ยนได้ไม่แม่น ให้ลอง `claude-opus-5`)
- 1 API call ต่อไฟล์ — AI ตอบกลับเป็นรายการเอกสาร (`documents[]`) พร้อมช่วงหน้า (`pages`) ของแต่ละใบ แล้วระบบรวมเอกสารจากทุกไฟล์ก่อนตรวจว่าครบชุด
- ส่ง PDF เป็น `document` content block (base64) — ไม่ต้องแปลง PDF เป็นรูปเอง
- บังคับผลลัพธ์เป็น JSON ด้วย structured outputs (`output_config.format` = `json_schema`), effort `medium`
- เมื่อใช้ `claude-opus-5` เปิด `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) กันกรณี AI ปฏิเสธคำขอ
- เรียกทุกไฟล์แบบขนาน (Promise.all) — ~1 API call ต่อไฟล์

### 10.5 Environment
```
ANTHROPIC_API_KEY=sk-ant-...
PO_TRACKING_MODEL=claude-sonnet-5   # optional
ANTHROPIC_WORKSPACE_ID=wrkspc_...   # optional — ใส่เฉพาะเมื่อ API key ไม่ได้ผูกกับ workspace
```
ถ้าเจอ error `This API key is not scoped to a workspace` ให้สร้าง API key ใหม่ใน Console โดยเลือก workspace (แนะนำ) หรือใส่ `ANTHROPIC_WORKSPACE_ID`

### 10.6 Audit Log
`PO_TRACKING_EXTRACT`, `PO_TRACKING_CREATE`, `PO_TRACKING_UPDATE`, `PO_TRACKING_DELETE`, `PO_TRACKING_EXPORT`

---

## 11. Deploy (Lightsail)
1. ตั้ง `ANTHROPIC_API_KEY` ใน `.env` ของเซิร์ฟเวอร์
2. `npm install`
3. `npx prisma migrate deploy` (สร้างเฉพาะตาราง `PoTrackingRow` ไม่แตะตารางเดิม)
4. `npm run build && npm start` (หรือ restart process manager เดิม)
5. ถ้ามี reverse proxy (nginx) ให้ตั้ง `client_max_body_size` ≥ 10M และ `proxy_read_timeout` ≥ 120s เพราะการอ่าน PDF ด้วย AI ใช้เวลา ~10–60 วินาที

> หมายเหตุ: DB local มี column `transactionCategory` ใน `AssetTransactionHistory` / `SecuritySetTransaction` ที่ไม่อยู่ใน `schema.prisma` (drift) ทำให้ `prisma migrate dev` ขอ reset — ห้าม reset; ใช้ `migrate deploy` แทน และควรเพิ่ม column นี้ใน schema ให้ตรงกันภายหลัง

---

## 12. เกณฑ์การทดสอบ (Acceptance)
1. ADMIN เห็นเมนูใหม่, USER ไม่เห็น และเข้า URL/API ตรงไม่ได้ (403)
2. อัปโหลด `PO Cheil.pdf` + `PO Samsung.pdf` + `Quotation2.pdf` → ได้ 2 แถว:
   - VENDOR `New Look`, Job Type `Repair`, JOB NO. `THP26064167`
   - CH PO `THPI2602592`, DATE3 `13/8/2026`
   - SS PO `T26C5A0004079`, DATE `11/8/2026`
   - ESTIMATE `4/8/2026`
   - TABLE: 6 × 3,500 = 21,000 / STOOL: 12 × 1,400 = 16,800
3. ใบเสนอราคาที่ text เพี้ยน (`Quotation1.pdf` RICCO) ยังอ่านได้ → VENDOR `RICCO`, ESTIMATE `11/12/2025`
3b. อัปโหลด `samples/Combined_Job.pdf` (ไฟล์เดียว 3 หน้า = Cheil PO + Samsung PO + Quotation2) → ได้ผลเหมือนข้อ 2 และหน้าตรวจสอบแสดงประเภทเอกสารแยกตามหน้า
4. อัปโหลดชุดไม่ครบ/ซ้ำ/เอกสารอื่น → error ชัดเจน ไม่บันทึก
5. แก้ไข inline → บันทึกเฉพาะช่องที่เปลี่ยน
6. Export → 28 คอลัมน์ ลำดับตาม template ตัวเลขเป็น number
7. ไม่มีไฟล์ PDF ถูกเขียนลงดิสก์
8. ฟีเจอร์เดิมทำงานปกติ

---

### สถานะการทดสอบ (2026-09-29)
| ข้อ | ผล |
|---|---|
| 1 สิทธิ์ API | ✅ ไม่ login → 401, USER → 403 (list/create/export/delete) |
| 2 Mapping ชุดตัวอย่าง | ✅ ทดสอบ `buildRows` ด้วยค่าจาก PDF ตัวอย่าง ได้ 2 แถวตรงตามที่คาด — **ยังไม่ได้ทดสอบกับ AI จริง (ยังไม่มี API key)** |
| 3 ใบเสนอราคา RICCO | ⏳ รอ API key |
| 3b PDF รวมไฟล์เดียว 3 หน้า | ⏳ รอ API key (ไฟล์ทดสอบ `Review-doc/samples/Combined_Job.pdf` เตรียมไว้แล้ว) |
| 4 ชุดไม่ครบ / ไม่ใช่ PDF | ✅ error ชัดเจน (ส่วน AI แยกประเภทรอ API key) |
| 5 แก้ไข inline | ✅ อัปเดตเฉพาะช่องที่ส่ง, ช่องที่ไม่อนุญาต (`jobGroupId`, `id`) ถูกตัดทิ้ง |
| 6 Export | ✅ 28 คอลัมน์เรียงตรง template, ตัวเลขเป็น number, วันที่ `D/M/YYYY` |
| 7 ไม่เขียน PDF ลงดิสก์ | ✅ ไม่มีโค้ดเขียนไฟล์ |
| 8 ฟีเจอร์เดิม | ✅ แก้ไฟล์เดิมเฉพาะเพิ่มบรรทัด; UI ในเบราว์เซอร์ยังไม่ได้ทดสอบด้วยมือ |

### ปัญหาเดิมที่พบระหว่างทดสอบ (ไม่ได้เกิดจากฟีเจอร์นี้)
`middleware.ts` อยู่ที่ root แต่โปรเจกต์ใช้ `src/app` → Next.js ไม่เรียกใช้ middleware นี้ หน้า `/dashboard/admin-*` ทุกหน้า (รวมหน้าเดิม) จึงเปิดได้โดยไม่ login (ได้ 200) — ข้อมูลยังปลอดภัยเพราะ API แต่ละตัวเช็คสิทธิ์เอง และ layout redirect ฝั่ง client แต่ควรย้ายไป `src/middleware.ts` แล้วทดสอบทั้งระบบ

## 13. ต่อยอดในอนาคต (ยังไม่ทำ)
- จัดการรายชื่อ vendor / keyword ผ่านหน้า UI แทนการแก้โค้ด
- ตรวจ job ซ้ำ (JOB NO./CH PO ซ้ำกับที่มีอยู่)
- Export ตาม filter / ช่วงวันที่
- ใบเสนอราคาหลายใบต่อ 1 job
