"use client";

import { useSession } from "next-auth/react";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import debounce from "lodash.debounce";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getMe } from "./loader";
import { Plus, Trash2, User, Store, Package, FileText, Save, CheckCircle, XCircle, Loader2, RotateCcw, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import OtherActivitiesSelect, { OtherActivity } from "@/components/ui/admin/OtherActivitiesSelect";
import StatusSelect, { StatusOption } from "@/components/ui/admin/StatusSelect";

type ShopItem = { mcsCode: string; shopName: string };
type AssetRow = { id: number; barcode: string; name: string; size: string; grade: string; qty: number };
type FormMode = "user" | "admin";

const FormReturnAsset = ({ mode = "user" }: { mode?: FormMode }) => {
  const { data } = useSession();
  const router = useRouter();
  const params = useParams();
  const editIdFromUrl = Array.isArray(params.id) ? params.id[0] : params.id;
  const [isEdit] = useState(!!editIdFromUrl);
  const [editId] = useState<string | null>(editIdFromUrl || null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [docStatus, setDocStatus] = useState("");
  const assetIdCounter = useRef(1);

  const [assets, setAssets] = useState<AssetRow[]>([{ id: assetIdCounter.current++, barcode: "", name: "", size: "", grade: "", qty: 1 }]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ docNumber: "", fullName: "", company: "", phone: "" });
  const [noMcs, setNoMcs] = useState(false);
  const [shopCode, setShopCode] = useState("");
  const [shopName, setShopName] = useState("");
  const [searchResults, setSearchResults] = useState<ShopItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [returnCondition, setReturnCondition] = useState<"normal" | "from_borrow" | "">("");
  const [note, setNote] = useState("");
  const [otherActivity, setOtherActivity] = useState<OtherActivity>("");
  const [transactionStatus, setTransactionStatus] = useState<StatusOption>("");
  const [barcodeSearchResults, setBarcodeSearchResults] = useState<{ barcode: string; assetName: string; size?: string }[]>([]);
  const [showBarcodeDropdown, setShowBarcodeDropdown] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!editIdFromUrl || dataLoaded) return;
    setLoading(true);
    fetch(`/api/document/${editIdFromUrl}`).then(r => r.json()).then(json => {
      if (json.success) {
        const doc = json.document;
        setDocStatus(doc.status || "");
        setFormData({ docNumber: doc.docCode, fullName: doc.fullName || "", company: doc.company || "", phone: doc.phone || "" });
        const shop = doc.shops?.[0];
        if (shop) {
          setShopCode(shop.shopCode || ""); setShopName(shop.shopName || "");
          if (shop.startInstallDate) setReturnDate(new Date(shop.startInstallDate).toISOString().split('T')[0]);
          if (shop.assets?.length > 0) setAssets(shop.assets.map((a: any, idx: number) => ({ id: idx + 1, barcode: a.barcode || "", name: a.name || "", size: a.size || "", grade: a.grade || "", qty: a.qty || 1 })));
        }
        setNote(doc.note || "");
        // ✅ Load returnCondition
        if (doc.returnCondition) setReturnCondition(doc.returnCondition);
      }
      setDataLoaded(true);
    }).finally(() => setLoading(false));
  }, [editIdFromUrl, dataLoaded]);

  useEffect(() => {
    if (dataLoaded || isEdit) return;
    getMe(data?.user?.email ?? '').then(me => {
      fetch("/api/document/generate").then(r => r.json()).then(json => {
        setFormData({ docNumber: json.docCode || "", fullName: `${me?.user?.firstName || ""} ${me?.user?.lastName || ""}`.trim() || "", company: me?.user?.company || "", phone: me?.user?.phone || "" });
      });
    });
  }, [dataLoaded, isEdit]);

  const searchShop = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    const res = await fetch(`/api/shop/search?query=${encodeURIComponent(q)}&status=OPEN`); const json = await res.json();
    const list = Array.isArray(json?.shops) ? json.shops : []; setSearchResults(list); setShowDropdown(list.length > 0);
  }, []);
  const debouncedSearch = useMemo(() => debounce(searchShop, 300), [searchShop]);

  const fetchBarcodes = async (q: string, rowId: number) => {
    // ✅ ล้าง name และ size เมื่อกำลังค้นหาใหม่
    setAssets(p => p.map(a => a.id === rowId ? { ...a, name: "", size: "" } : a));
    
    // ✅ ใช้ searchByBarcode API + balanceFilter=0 (ค้นหาเฉพาะ Barcode ที่ออกไปแล้ว ถึงจะคืนได้)
    const res = await fetch(`/api/asset/searchByBarcode?query=${encodeURIComponent(q)}&balanceFilter=0`); const json = await res.json();
    const barcodes = json.assets || []; 
    setBarcodeSearchResults(barcodes); 
    setShowBarcodeDropdown(p => ({ ...p, [rowId]: true }));
  };
  const debouncedBarcode = useMemo(() => debounce(fetchBarcodes, 300), []);

  const handleSubmit = async (action: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // ✅ Validation เงื่อนไขการเก็บกลับ
      if (!returnCondition) {
        toast.error("กรุณาเลือกเงื่อนไขการเก็บกลับ");
        return;
      }
      if (action === "approve" && editId) {
        // ✅ บันทึกข้อมูลก่อน
        const updatePayload = { documentType: "return", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, returnCondition, status: "submitted", shops: [{ shopCode, shopName, startInstallDate: returnDate, assets: assets.map(a => ({ barcode: a.barcode, name: a.name, size: a.size, grade: a.grade, qty: a.qty })) }] };
        const updateRes = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatePayload) });
        const updateR = await updateRes.json();
        if (!updateR.success) throw new Error(updateR.message);
        // ✅ จากนั้นค่อยอนุมัติ
        const res = await fetch("/api/document/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: parseInt(editId), otherActivity }) }); const r = await res.json(); if (!r.success) throw new Error(r.message); toast.success("อนุมัติสำเร็จ!"); router.push("/dashboard/admin-list"); return;
      }
      if (action === "reject" && editId) { const res = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected", note }) }); const r = await res.json(); if (!r.success) throw new Error(r.message); toast.success("ปฏิเสธสำเร็จ!"); router.push("/dashboard/admin-list"); return; }
      const payload = { documentType: "return", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, returnCondition, status: "submitted", shops: [{ shopCode, shopName, startInstallDate: returnDate, assets: assets.map(a => ({ barcode: a.barcode, name: a.name, size: a.size, grade: a.grade, qty: a.qty })) }] };
      const res = await fetch(isEdit ? `/api/document/update/${editId}` : "/api/document/create", { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const r = await res.json(); if (!r.success) throw new Error(r.message);
      toast.success(isEdit ? "แก้ไขสำเร็จ!" : "บันทึกสำเร็จ!"); router.push(mode === "admin" ? "/dashboard/admin-list" : "/dashboard/user-list");
    } catch (e) { toast.error("เกิดข้อผิดพลาด"); }
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
        <div className="icon-container green !w-10 !h-10"><RotateCcw className="w-5 h-5" /></div>
        <div><h1 className="text-xl sm:text-2xl font-semibold">{isEdit ? "แก้ไขใบเก็บ Asset กลับ" : "ใบเก็บ Asset กลับ"}</h1><p className="text-sm text-muted-foreground">เลขที่ {formData.docNumber || "รอสร้าง"}</p></div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container blue !w-8 !h-8"><User className="w-4 h-4" /></div><h2 className="font-semibold">ข้อมูลผู้เก็บ</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="block text-xs text-muted-foreground mb-1">เลขที่เอกสาร</label><Input value={formData.docNumber} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">ชื่อ</label><Input value={formData.fullName} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">บริษัท</label><Input value={formData.company} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">เบอร์โทร</label><Input value={formData.phone} readOnly className="glass-input bg-black/5" /></div>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container purple !w-8 !h-8"><ClipboardList className="w-4 h-4" /></div><h2 className="font-semibold">เงื่อนไขการเก็บกลับ</h2></div>
        <RadioGroup value={returnCondition} onValueChange={(v: "normal" | "from_borrow") => setReturnCondition(v)} className="flex gap-6">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="normal" id="return-normal" />
            <Label htmlFor="return-normal" className="cursor-pointer">เก็บกลับปกติ</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="from_borrow" id="return-from-borrow" />
            <Label htmlFor="return-from-borrow" className="cursor-pointer">เก็บกลับจากการยืม</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container cyan !w-8 !h-8"><Store className="w-4 h-4" /></div><h2 className="font-semibold">ข้อมูล Shop</h2></div>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex items-center gap-2"><Checkbox checked={noMcs} onCheckedChange={(c) => { setNoMcs(!!c); if (c) { setShopCode(""); setShopName(""); } }} /><label className="text-sm font-medium">NO MCS</label></div>
            <div className="flex-1 relative">
              <label className="block text-xs text-muted-foreground mb-1">MCS Code</label>
              <Input value={shopCode} onChange={(e) => { setShopCode(e.target.value); debouncedSearch(e.target.value); }} onFocus={() => searchResults.length > 0 && setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 200)} disabled={noMcs} placeholder="พิมพ์ MCS Code..." className="glass-input" />
              {showDropdown && searchResults.length > 0 && <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">{searchResults.map(s => <div key={s.mcsCode} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => { setShopCode(s.mcsCode); setShopName(s.shopName); setShowDropdown(false); }}><span className="text-primary font-medium">{s.mcsCode}</span> - {s.shopName}</div>)}</div>}
            </div>
            <div className="flex-[2]"><label className="block text-xs text-muted-foreground mb-1">Shop Name</label><Input value={shopName} onChange={(e) => setShopName(e.target.value)} disabled={!noMcs} placeholder="ชื่อ Shop" className="glass-input" /></div>
          </div>
          <div className="max-w-xs"><label className="block text-xs text-muted-foreground mb-1">วันที่คืน</label><Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="glass-input" /></div>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><div className="icon-container orange !w-8 !h-8"><Package className="w-4 h-4" /></div><h2 className="font-semibold">Asset</h2><span className="text-xs text-muted-foreground">({assets.length}/5)</span></div>
          {assets.length < 5 && <button onClick={() => setAssets([...assets, { id: assetIdCounter.current++, barcode: "", name: "", size: "", grade: "", qty: 1 }])} className="glass-button px-3 py-2 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />เพิ่ม</button>}
        </div>
        <div className="space-y-3">
          {assets.map((asset) => (
            <div key={asset.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3 relative">
                  <label className="block text-xs text-muted-foreground mb-1">Barcode</label>
                  <Input value={asset.barcode} onChange={(e) => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, barcode: e.target.value } : a)); debouncedBarcode(e.target.value, asset.id); }} onFocus={() => { fetchBarcodes(asset.barcode, asset.id); }} onBlur={() => setTimeout(() => setShowBarcodeDropdown(p => ({ ...p, [asset.id]: false })), 200)} placeholder="สแกน Barcode..." className="glass-input" />
                  {showBarcodeDropdown[asset.id] && barcodeSearchResults.length > 0 && <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">{barcodeSearchResults.map(b => <div key={b.barcode} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, barcode: b.barcode, name: b.assetName, size: b.size || "" } : a)); setShowBarcodeDropdown(p => ({ ...p, [asset.id]: false })); }}><span className="font-mono text-primary">{b.barcode}</span> - {b.assetName}</div>)}</div>}
                </div>
                <div className="sm:col-span-3"><label className="block text-xs text-muted-foreground mb-1">Asset Name</label><Input value={asset.name} readOnly className="glass-input bg-black/5" /></div>
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">Size</label><Input value={asset.size} readOnly className="glass-input bg-black/5" /></div>
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">Grade</label><Select value={asset.grade} onValueChange={(v) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, grade: v } : a))}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger><SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="AB">AB</SelectItem><SelectItem value="B">B</SelectItem><SelectItem value="BC">BC</SelectItem><SelectItem value="C">C</SelectItem><SelectItem value="CD">CD</SelectItem><SelectItem value="D">D</SelectItem></SelectContent></Select></div>
                <div className="sm:col-span-1"><label className="block text-xs text-muted-foreground mb-1">จำนวน</label><Input value="1" readOnly className="glass-input bg-black/5 text-center" /></div>
                {assets.length > 1 && <div className="flex items-end"><button onClick={() => setAssets(p => p.filter(a => a.id !== asset.id))} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 className="w-4 h-4" /></button></div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container gray !w-8 !h-8"><FileText className="w-4 h-4" /></div><h2 className="font-semibold">หมายเหตุ</h2></div>
        <Input placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} className="glass-input" />
      </div>

      {mode === "admin" && <OtherActivitiesSelect value={otherActivity} onChange={setOtherActivity} />}

      {/* Status - Admin only (บังคับเลือก) */}
      {mode === "admin" && <StatusSelect value={transactionStatus} onChange={setTransactionStatus} />}

      {!isReadOnly && (
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
          {mode === "admin" ? (
            <><button disabled={isSubmitting} onClick={() => handleSubmit("approve")} className="gradient-button px-8 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"><CheckCircle className="w-4 h-4" />{isSubmitting ? "กำลังดำเนินการ..." : "อนุมัติ"}</button><button disabled={isSubmitting} onClick={() => handleSubmit("reject")} className="px-8 py-3 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600 disabled:opacity-50"><XCircle className="w-4 h-4" />ปฏิเสธ</button></>
          ) : (
            <button disabled={isSubmitting} onClick={() => handleSubmit("save")} className="gradient-button px-10 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" />{isSubmitting ? "กำลังบันทึก..." : (isEdit ? "บันทึกการแก้ไข" : "บันทึก")}</button>
          )}
        </div>
      )}
    </div>
  );
};

export default FormReturnAsset;