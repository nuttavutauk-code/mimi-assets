"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import debounce from "lodash.debounce";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getMe } from "./loader";
import { Plus, Trash2, User, Store, Package, FileText, Save, CheckCircle, XCircle, Loader2, ArrowRightLeft, Settings } from "lucide-react";
import { toast } from "sonner";
import OtherActivitiesSelect, { OtherActivity } from "@/components/ui/admin/OtherActivitiesSelect";
import StatusSelect, { StatusOption } from "@/components/ui/admin/StatusSelect";

type AssetRow = {
  id: number;
  barcode: string;
  name: string;
  size: string;
  grade: string;
  qty: number;
  withdrawFor: string;
  useCustomSize?: boolean;
  customW?: string;
  customD?: string;
  customH?: string;
  customXX?: string;
};

const isCustomSizeAsset = (name: string) => {
  const lowerName = name.toLowerCase().replace(/\s+/g, '');
  return lowerName.includes("lightbox") || lowerName.includes("accwall");
};
type FormMode = "user" | "admin";

// ✅ ตัวเลือกประเภทการย้าย
const OPERATION_OPTIONS = ["ส่งคืนผู้ผลิต", "ส่งคืนโกดังเช่า", "อื่นๆ"];

const FormTransfer = ({ mode = "user" }: { mode?: FormMode }) => {
  const { data } = useSession();
  const router = useRouter();
  const params = useParams();
  const editIdFromUrl = Array.isArray(params.id) ? params.id[0] : params.id;
  const [isEdit, setIsEdit] = useState(!!editIdFromUrl);
  const [editId, setEditId] = useState<string | null>(editIdFromUrl || null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [docStatus, setDocStatus] = useState("");
  const assetIdCounter = useRef(1);

  const [assets, setAssets] = useState<AssetRow[]>([{ id: assetIdCounter.current++, barcode: "", name: "", size: "", grade: "", qty: 1, withdrawFor: "" }]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendors, setVendors] = useState<string[]>([]);
  const [formData, setFormData] = useState({ docNumber: "", fullName: "", company: "", phone: "", operation: "", otherDetail: "" });
  const [shopCode, setShopCode] = useState("");
  const [shopName, setShopName] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [note, setNote] = useState("");
  const [otherActivity, setOtherActivity] = useState<OtherActivity>("");
  const [transactionStatus, setTransactionStatus] = useState<StatusOption>("");
  const [barcodeSearchResults, setBarcodeSearchResults] = useState<{ barcode: string; assetName: string; size?: string }[]>([]);
  const [showBarcodeDropdown, setShowBarcodeDropdown] = useState<Record<number, boolean>>({});
  const [userVendor, setUserVendor] = useState<string>("");

  useEffect(() => { fetch("/api/vendor/list").then(r => r.json()).then(j => j.success && setVendors(j.vendors?.filter((v: string) => v.trim()) || [])); }, []);

  useEffect(() => {
    if (!editIdFromUrl || dataLoaded) return;
    setLoading(true);
    fetch(`/api/document/${editIdFromUrl}`).then(r => r.json()).then(json => {
      if (json.success) {
        const doc = json.document;
        setDocStatus(doc.status || "");
        setFormData({
          docNumber: doc.docCode,
          fullName: doc.fullName || "",
          company: doc.company || "",
          phone: doc.phone || "",
          operation: doc.operation || "",
          otherDetail: doc.otherDetail || ""
        });
        const shop = doc.shops?.[0];
        if (shop) {
          setShopCode(shop.shopCode || "");
          setShopName(shop.shopName || "");
          if (shop.startInstallDate) setTransferDate(new Date(shop.startInstallDate).toISOString().split('T')[0]);
          if (shop.assets?.length > 0) { setAssets(shop.assets.map((a: any, idx: number) => ({ id: idx + 1, barcode: a.barcode || "", name: a.name || "", size: a.size || "", grade: a.grade || "", qty: a.qty || 1, withdrawFor: a.withdrawFor || "" }))); }
        }
        setNote(doc.note || "");
      }
      setDataLoaded(true);
    }).finally(() => setLoading(false));
  }, [editIdFromUrl, dataLoaded]);

  useEffect(() => {
    if (dataLoaded || isEdit) return;
    getMe(data?.user?.email ?? '').then(me => {
      fetch("/api/document/generate").then(r => r.json()).then(json => {
        setFormData(prev => ({
          ...prev,
          docNumber: json.docCode || "",
          fullName: `${me?.user?.firstName || ""} ${me?.user?.lastName || ""}`.trim() || "",
          company: me?.user?.company || "",
          phone: me?.user?.phone || ""
        }));
        setUserVendor(me?.user?.vendor || "");
      });
    });
  }, [dataLoaded, isEdit]);

  const fetchBarcodes = async (q: string, rowId: number) => {
    // ✅ ล้าง name และ size เมื่อกำลังค้นหาใหม่ (ยกเว้น approved/rejected)
    if (docStatus !== "approved" && docStatus !== "rejected") {
      setAssets(p => p.map(a => a.id === rowId ? { ...a, name: "", size: "" } : a));
    }
    
    const res = await fetch(`/api/asset/searchByBarcode?query=${encodeURIComponent(q)}&balanceFilter=1&warehouse=${encodeURIComponent(userVendor)}`); const json = await res.json();
    const barcodes = json.assets || []; setBarcodeSearchResults(barcodes); setShowBarcodeDropdown(p => ({ ...p, [rowId]: true }));
  };
  const debouncedBarcode = useMemo(() => debounce(fetchBarcodes, 300), [userVendor]);

  const handleSubmit = async (action: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // ✅ Validate วันที่โอนย้าย
      if (!transferDate) {
        toast.error("กรุณาเลือกวันที่โอนย้าย");
        return;
      }
      
      // ✅ Validate operation
      if (!formData.operation) {
        toast.error("กรุณาเลือกประเภทการย้าย");
        return;
      }
      if (formData.operation === "อื่นๆ" && !formData.otherDetail.trim()) {
        toast.error("กรุณาระบุรายละเอียด (อื่นๆ)");
        return;
      }

      // ✅ Admin ต้องเลือกโกดังปลายทางก่อนอนุมัติ
      if (action === "approve" && mode === "admin") {
        if (!shopName || shopName.trim() === "") {
          toast.error("กรุณาเลือกโกดังปลายทางก่อนอนุมัติ");
          return;
        }
      }

      if (action === "approve" && editId) {
        // ✅ บันทึกข้อมูลก่อน (ใช้ shopName เป็น withdrawFor ของทุก Asset)
        const updatePayload = {
          documentType: "transfer",
          docCode: formData.docNumber,
          fullName: formData.fullName,
          company: formData.company,
          phone: formData.phone,
          operation: formData.operation,
          otherDetail: formData.otherDetail,
          note,
          status: "submitted",
          shops: [{ shopCode, shopName, startInstallDate: transferDate, assets: assets.map(a => ({ barcode: a.barcode, name: a.name, size: a.size, grade: a.grade, qty: a.qty, withdrawFor: shopName })) }]
        };
        const updateRes = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatePayload) });
        const updateR = await updateRes.json();
        if (!updateR.success) throw new Error(updateR.message);
        // ✅ จากนั้นค่อยอนุมัติ
        const res = await fetch("/api/document/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: parseInt(editId), otherActivity }) });
        const r = await res.json();
        if (!r.success) throw new Error(r.message);
        toast.success("อนุมัติสำเร็จ!");
        router.push("/dashboard/admin-list");
        return;
      }
      if (action === "reject" && editId) {
        const rejectPayload = {
          documentType: "transfer",
          docCode: formData.docNumber,
          fullName: formData.fullName,
          company: formData.company,
          phone: formData.phone,
          operation: formData.operation,
          otherDetail: formData.otherDetail,
          note,
          status: "rejected",
          shops: [{ shopCode, shopName, startInstallDate: transferDate, assets: assets.map(a => ({ barcode: a.barcode, name: a.name, size: a.size, grade: a.grade, qty: a.qty, withdrawFor: shopName })) }]
        };
        const res = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rejectPayload) });
        const r = await res.json();
        if (!r.success) throw new Error(r.message);
        toast.success("ปฏิเสธสำเร็จ!");
        router.push("/dashboard/admin-list");
        return;
      }
      const payload = {
        documentType: "transfer",
        docCode: formData.docNumber,
        fullName: formData.fullName,
        company: formData.company,
        phone: formData.phone,
        operation: formData.operation,
        otherDetail: formData.otherDetail,
        note,
        status: "submitted",
        shops: [{ shopCode, shopName, startInstallDate: transferDate, assets: assets.map(a => ({ barcode: a.barcode, name: a.name, size: a.size, grade: a.grade, qty: a.qty, withdrawFor: shopName })) }]
      };
      const res = await fetch(isEdit ? `/api/document/update/${editId}` : "/api/document/create", { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const r = await res.json(); if (!r.success) throw new Error(r.message);
      toast.success(isEdit ? "แก้ไขสำเร็จ!" : "บันทึกสำเร็จ!"); router.push(mode === "admin" ? "/dashboard/admin-list" : "/dashboard/user-list");
    } catch (e) { console.error(e); toast.error("เกิดข้อผิดพลาด"); }
    finally { setIsSubmitting(false); }
  };

  if (loading && isEdit) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const isReadOnly = docStatus === "approved" || docStatus === "rejected";

  return (
    <div className="space-y-4 sm:space-y-6">
      {isReadOnly && (
        <div className="glass-card p-4 border-l-4 border-amber-500 bg-amber-50/50">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-lg">⚠️</span>
            <p className="text-amber-800 font-medium">เอกสารนี้ได้รับการอนุมัติแล้ว ไม่สามารถแก้ไขได้</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="icon-container purple !w-10 !h-10"><ArrowRightLeft className="w-5 h-5" /></div>
        <div><h1 className="text-xl sm:text-2xl font-semibold">{isEdit ? "แก้ไขใบย้ายของ" : "ใบย้ายของ"}</h1><p className="text-sm text-muted-foreground">เลขที่ {formData.docNumber || "รอสร้าง"}</p></div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container blue !w-8 !h-8"><User className="w-4 h-4" /></div><h2 className="font-semibold">ข้อมูลผู้โอนย้าย</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="block text-xs text-muted-foreground mb-1">เลขที่เอกสาร</label><Input value={formData.docNumber} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">ชื่อ</label><Input value={formData.fullName} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">บริษัท</label><Input value={formData.company} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">เบอร์โทร</label><Input value={formData.phone} readOnly className="glass-input bg-black/5" /></div>
        </div>
      </div>

      {/* ✅ ประเภทการย้าย */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-container cyan !w-8 !h-8"><Settings className="w-4 h-4" /></div>
          <h2 className="font-semibold">ประเภทการย้าย <span className="text-red-500">*</span></h2>
        </div>
        <div className="flex flex-wrap gap-6">
          {OPERATION_OPTIONS.map((label) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formData.operation === label}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFormData((p) => ({ ...p, operation: label }));
                  } else {
                    setFormData((p) => ({ ...p, operation: "" }));
                  }
                }}
                disabled={isReadOnly}
                className="border-2 border-gray-400 data-[state=checked]:border-primary"
              />
              <span className="text-sm font-medium">{label}</span>
              {label === "อื่นๆ" && formData.operation === "อื่นๆ" && (
                <Input
                  placeholder="ระบุรายละเอียด..."
                  value={formData.otherDetail}
                  onChange={(e) => setFormData((p) => ({ ...p, otherDetail: e.target.value }))}
                  className="glass-input w-48 ml-2"
                  disabled={isReadOnly}
                />
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container green !w-8 !h-8"><Store className="w-4 h-4" /></div><h2 className="font-semibold">โกดังปลายทาง</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">โกดังปลายทาง</label>
            <Select value={shopName} onValueChange={(v) => { setShopName(v); setShopCode(""); }} disabled={isReadOnly}>
              <SelectTrigger className="glass-input"><SelectValue placeholder="เลือกโกดังปลายทาง" /></SelectTrigger>
              <SelectContent>{vendors.filter(v => v?.trim()).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">วันที่โอนย้าย <span className="text-red-500">*</span></label>
            <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} disabled={isReadOnly} className="glass-input" />
          </div>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><div className="icon-container orange !w-8 !h-8"><Package className="w-4 h-4" /></div><h2 className="font-semibold">Asset</h2><span className="text-xs text-muted-foreground">({assets.length}/4)</span></div>
          {!isReadOnly && assets.length < 4 && <button onClick={() => setAssets([...assets, { id: assetIdCounter.current++, barcode: "", name: "", size: "", grade: "", qty: 1, withdrawFor: "" }])} className="glass-button px-3 py-2 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />เพิ่ม</button>}
        </div>
        <div className="space-y-3">
          {assets.map((asset) => (
            <div key={asset.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3 relative">
                  <label className="block text-xs text-muted-foreground mb-1">Barcode</label>
                  <Input value={asset.barcode || ""} onChange={(e) => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, barcode: e.target.value } : a)); debouncedBarcode(e.target.value, asset.id); }} onFocus={() => { fetchBarcodes(asset.barcode || "", asset.id); }} onBlur={() => setTimeout(() => setShowBarcodeDropdown(p => ({ ...p, [asset.id]: false })), 200)} disabled={isReadOnly} placeholder="สแกน Barcode..." className="glass-input" />
                  {showBarcodeDropdown[asset.id] && barcodeSearchResults.length > 0 && <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">{barcodeSearchResults.map(b => <div key={b.barcode} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, barcode: b.barcode, name: b.assetName, size: b.size || "" } : a)); setShowBarcodeDropdown(p => ({ ...p, [asset.id]: false })); }}><span className="font-mono text-primary">{b.barcode}</span> - {b.assetName}</div>)}</div>}
                </div>
                <div className="sm:col-span-4"><label className="block text-xs text-muted-foreground mb-1">Asset Name</label><Input value={asset.name || ""} readOnly className="glass-input bg-black/5" /></div>
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">Size</label><Input value={asset.size || ""} readOnly className="glass-input bg-black/5" /></div>
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">จำนวน</label><Input type="number" value={1} readOnly className="glass-input text-center bg-black/5" /></div>
                {assets.length > 1 && !isReadOnly && <div className="flex items-end"><button onClick={() => setAssets(p => p.filter(a => a.id !== asset.id))} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 className="w-4 h-4" /></button></div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container gray !w-8 !h-8"><FileText className="w-4 h-4" /></div><h2 className="font-semibold">หมายเหตุ</h2></div>
        <Input placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} disabled={isReadOnly} className="glass-input" />
      </div>

      {mode === "admin" && <OtherActivitiesSelect value={otherActivity} onChange={setOtherActivity} />}

      {/* Status - Admin only (บังคับเลือก) */}
      {mode === "admin" && <StatusSelect value={transactionStatus} onChange={setTransactionStatus} />}

      {!isReadOnly && (
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
          {mode === "admin" ? (
            <>
              <button disabled={isSubmitting} onClick={() => handleSubmit("approve")} className="gradient-button px-8 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"><CheckCircle className="w-4 h-4" />{isSubmitting ? "กำลังดำเนินการ..." : "อนุมัติ"}</button>
              <button disabled={isSubmitting} onClick={() => handleSubmit("reject")} className="px-8 py-3 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600 disabled:opacity-50"><XCircle className="w-4 h-4" />ปฏิเสธ</button>
            </>
          ) : (
            <button disabled={isSubmitting} onClick={() => handleSubmit("save")} className="gradient-button px-10 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" />{isSubmitting ? "กำลังบันทึก..." : (isEdit ? "บันทึกการแก้ไข" : "บันทึก")}</button>
          )}
        </div>
      )}
    </div>
  );
};

export default FormTransfer;