"use client";

import { useState } from "react";
import DocumentTemplateSelector from "@/components/ui/document/DocumentTemplateSelector";
import { downloadDocumentPages } from "@/lib/downloadDocument";

// ============ Shared mock blocks ============

const baseDoc = {
  docCode: "DOC-2026-00123",
  fullName: "นายทดสอบ ระบบ",
  company: "บริษัท ทดสอบ จำกัด",
  phone: "081-234-5678",
  note: "หมายเหตุตัวอย่างสำหรับ debug template",
  createdAt: new Date().toISOString(),
  approvedAt: new Date().toISOString(),
  createdBy: { vendor: "NEWLOOK" },
};

const sampleAssets = [
  { name: "LED TV 55\"", size: "55", grade: "A", kv: "KV-001", qty: 2, withdrawFor: "NEWLOOK", assignedBarcodes: ["BC-LED-001", "BC-LED-002"] },
  { name: "Soundbar HW-Q990C", size: "STD", grade: "A", kv: "KV-002", qty: 1, withdrawFor: "NEWLOOK", assignedBarcodes: ["BC-SB-001"] },
  { name: "Lightbox", size: "60*40*10(XX)", grade: "B", kv: "", qty: 3, withdrawFor: "PIMARN", assignedBarcodes: ["BC-LB-001", "BC-LB-002", "BC-LB-003"] },
];

const sampleSecuritySets = [
  { name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 2, withdrawFor: "NEWLOOK", assignedBarcodes: ["SEC-CB6-001", "SEC-CB6-002"] },
  { name: "CONTROLBOX 5 PORT (M-60000R) with power cable", qty: 0, withdrawFor: "" },
  { name: "Security Type C Ver.7.1", qty: 3, withdrawFor: "NEWLOOK" },
  { name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
];

// ของเยอะ — สำหรับทดสอบ multi-page (100 assets, qty=1 each)
const bigAssetSet = Array.from({ length: 100 }).map((_, i) => ({
  name: `LED TV ${50 + (i % 5)}"`,
  size: `${50 + (i % 5)}`,
  grade: i % 3 === 0 ? "A" : "B",
  kv: `KV-${String(i + 1).padStart(3, "0")}`,
  qty: 1,
  withdrawFor: i % 2 === 0 ? "NEWLOOK" : "PIMARN",
  assignedBarcodes: [`BC-BIG-${String(i + 1).padStart(3, "0")}`],
}));

const sampleShop = (suffix = "") => ({
  shopCode: `MCS00${suffix || 1}`,
  shopName: `ร้านตัวอย่าง ${suffix || 1}`,
  startInstallDate: new Date().toISOString(),
  endInstallDate: new Date(Date.now() + 86400000 * 7).toISOString(),
  q7b7: "Yes",
  shopFocus: "1. Flagship",
  assets: sampleAssets,
  securitySets: sampleSecuritySets,
});

// ============ Template-specific mock ============

const mocks: { key: string; label: string; doc: any }[] = [
  {
    key: "withdraw",
    label: "Withdraw (ใบเบิก)",
    doc: { ...baseDoc, documentType: "withdraw", shops: [sampleShop()] },
  },
  {
    key: "withdraw-big",
    label: "Withdraw (ของเยอะ → multi-page)",
    doc: {
      ...baseDoc,
      documentType: "withdraw",
      shops: [{ ...sampleShop(), assets: bigAssetSet }],
    },
  },
  {
    key: "other",
    label: "Other (ใบงานอื่น)",
    doc: { ...baseDoc, documentType: "other", shops: [sampleShop()] },
  },
  {
    key: "borrow",
    label: "Borrow (ใบยืม)",
    doc: { ...baseDoc, documentType: "borrow", borrowType: "ยืมไปใช้งานชั่วคราว", shops: [sampleShop()] },
  },
  {
    key: "borrowsecurity",
    label: "Borrow Security (ใบยืม Security)",
    doc: { ...baseDoc, documentType: "borrowsecurity", borrowType: "ยืมไปใช้งาน Security", shops: [sampleShop()] },
  },
  {
    key: "routing2shops",
    label: "Routing 2 Shops",
    doc: { ...baseDoc, documentType: "routing2shops", shops: [sampleShop("1"), sampleShop("2")] },
  },
  {
    key: "routing3shops",
    label: "Routing 3 Shops",
    doc: { ...baseDoc, documentType: "routing3shops", shops: [sampleShop("1"), sampleShop("2"), sampleShop("3")] },
  },
  {
    key: "routing4shops",
    label: "Routing 4 Shops",
    doc: { ...baseDoc, documentType: "routing4shops", shops: [sampleShop("1"), sampleShop("2"), sampleShop("3"), sampleShop("4")] },
  },
  {
    key: "transfer",
    label: "Transfer (ใบย้ายระหว่างโกดัง)",
    doc: {
      ...baseDoc,
      documentType: "transfer",
      transferType: "ย้ายทรัพย์สิน",
      operation: "ย้ายตามคำสั่ง",
      otherDetail: "",
      shops: [sampleShop()],
    },
  },
  {
    key: "return",
    label: "Return (ใบเก็บกลับ)",
    doc: {
      ...baseDoc,
      documentType: "return",
      returnCondition: "normal",
      shops: [sampleShop()],
    },
  },
  {
    key: "returnasset",
    label: "Return Asset (เก็บกลับ Asset)",
    doc: {
      ...baseDoc,
      documentType: "returnasset",
      returnCondition: "from_borrow",
      shops: [sampleShop()],
    },
  },
  {
    key: "shoptoshop",
    label: "Shop to Shop",
    doc: {
      ...baseDoc,
      documentType: "shoptoshop",
      shops: [
        { ...sampleShop("ต้นทาง") },
        { shopCode: "MCS999", shopName: "ร้านปลายทาง" },
      ],
    },
  },
  {
    key: "repair",
    label: "Repair (ใบแจ้งซ่อม)",
    doc: { ...baseDoc, documentType: "repair", shops: [sampleShop()] },
  },
];

export default function DebugTemplatesPage() {
  const [activeKey, setActiveKey] = useState<string>(mocks[0].key);
  const [zoom, setZoom] = useState(80);
  const [downloading, setDownloading] = useState(false);
  const active = mocks.find((m) => m.key === activeKey) || mocks[0];

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const result = await downloadDocumentPages("document-to-print", active.doc.docCode || active.key);
      if (!result.success) alert("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 min-h-screen">
      <div>
        <h1 className="text-2xl font-semibold">🛠 Document Template Debug</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ดู template จริงของแต่ละ documentType ใช้ mock data — ตามที่ render โดย{" "}
          <code>DocumentTemplateSelector</code>
        </p>
      </div>

      {/* Type selector */}
      <div className="flex flex-wrap gap-2">
        {mocks.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveKey(m.key)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition ${
              activeKey === m.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {downloading ? "กำลังสร้างรูป..." : "📥 ดาวน์โหลด PNG"}
        </button>
        <span className="text-xs text-muted-foreground">หลายหน้า = หลายไฟล์</span>
      </div>

      {/* Zoom control */}
      <div className="flex items-center gap-3 bg-white rounded-lg border px-3 py-2 w-fit">
        <span className="text-sm font-medium">Zoom</span>
        <button onClick={() => setZoom(Math.max(30, zoom - 10))} className="px-2 py-0.5 border rounded">
          −
        </button>
        <span className="text-sm w-12 text-center">{zoom}%</span>
        <button onClick={() => setZoom(Math.min(150, zoom + 10))} className="px-2 py-0.5 border rounded">
          +
        </button>
      </div>

      {/* Preview */}
      <div className="bg-gray-200 p-6 rounded-xl overflow-auto">
        <div
          className="mx-auto bg-white shadow-lg"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top center",
            width: "794px",
            minHeight: "1123px",
          }}
        >
          <DocumentTemplateSelector document={active.doc} />
        </div>
      </div>

      {/* Mock JSON preview */}
      <details className="bg-white border rounded-lg">
        <summary className="px-4 py-2 cursor-pointer text-sm font-medium">
          ดู mock data ของ {active.label}
        </summary>
        <pre className="text-xs p-4 overflow-auto bg-gray-50 max-h-80">
          {JSON.stringify(active.doc, null, 2)}
        </pre>
      </details>
    </div>
  );
}
