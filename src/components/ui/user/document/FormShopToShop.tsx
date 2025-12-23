"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import debounce from "lodash.debounce";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getMe } from "./loader";
import { Plus, Trash2, User, Store, Package, FileText, Save, CheckCircle, XCircle, Loader2, ArrowLeftRight, Shield } from "lucide-react";
import { toast } from "sonner";
import OtherActivitiesSelect, { OtherActivity } from "@/components/ui/admin/OtherActivitiesSelect";

type ShopItem = { mcsCode: string; shopName: string };
type AssetRow = { id: number; barcode: string; name: string; size: string; grade: string; qty: number };
type SecuritySet = { id: number; name: string; qty: number; withdrawFor: string };
type FormMode = "user" | "admin";

const FormShopToShop = ({ mode = "user" }: { mode?: FormMode }) => {
  const { data } = useSession();
  const router = useRouter(); const params = useParams();
  const editIdFromUrl = Array.isArray(params.id) ? params.id[0] : params.id;
  const [isEdit] = useState(!!editIdFromUrl); const [editId] = useState<string | null>(editIdFromUrl || null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [docStatus, setDocStatus] = useState(""); const assetIdCounter = useRef(1);

  const [assets, setAssets] = useState<AssetRow[]>([{ id: assetIdCounter.current++, barcode: "", name: "", size: "", grade: "", qty: 1 }]);
  const [securitySets, setSecuritySets] = useState<SecuritySet[]>([{ id: 1, name: "CONTROLBOX 6 PORT", qty: 0, withdrawFor: "" }, { id: 2, name: "Security Type C Ver.7.1", qty: 0, withdrawFor: "" }, { id: 3, name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" }]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ docNumber: "", fullName: "", company: "", phone: "" });
  const [noMcsFrom, setNoMcsFrom] = useState(false); const [shopCodeFrom, setShopCodeFrom] = useState(""); const [shopNameFrom, setShopNameFrom] = useState("");
  const [noMcsTo, setNoMcsTo] = useState(false); const [shopCodeTo, setShopCodeTo] = useState(""); const [shopNameTo, setShopNameTo] = useState("");
  const [searchResults, setSearchResults] = useState<ShopItem[]>([]); const [showDropdown, setShowDropdown] = useState<"from" | "to" | null>(null);
  const [transferDate, setTransferDate] = useState(""); const [note, setNote] = useState(""); const [otherActivity, setOtherActivity] = useState<OtherActivity>("");
  const [barcodeResults, setBarcodeResults] = useState<{ barcode: string; assetName: string; size?: string }[]>([]); const [showBarcode, setShowBarcode] = useState<Record<number, boolean>>({});

  useEffect(() => { fetch("/api/vendor/list").then(r => r.json()).then(j => j.success && setVendors(j.vendors?.filter((v: string) => v.trim()) || [])); }, []);

  useEffect(() => {
    if (!editIdFromUrl || dataLoaded) return;
    setLoading(true);
    fetch(`/api/document/${editIdFromUrl}`).then(r => r.json()).then(json => {
      if (json.success) {
        const doc = json.document;
        setDocStatus(doc.status || "");
        setFormData({ docNumber: doc.docCode, fullName: doc.fullName || "", company: doc.company || "", phone: doc.phone || "" });
        if (doc.shops?.[0]) { setShopCodeFrom(doc.shops[0].shopCode || ""); setShopNameFrom(doc.shops[0].shopName || ""); if (doc.shops[0].startInstallDate) setTransferDate(new Date(doc.shops[0].startInstallDate).toISOString().split('T')[0]); if (doc.shops[0].assets?.length > 0) setAssets(doc.shops[0].assets.map((a: any, i: number) => ({ id: i + 1, barcode: a.barcode || "", name: a.name || "", size: a.size || "", grade: a.grade || "", qty: a.qty || 1 }))); }
        if (doc.shops?.[1]) { setShopCodeTo(doc.shops[1].shopCode || ""); setShopNameTo(doc.shops[1].shopName || ""); }
        setNote(doc.note || "");
      }
      setDataLoaded(true);
    }).finally(() => setLoading(false));
  }, [editIdFromUrl, dataLoaded]);

  useEffect(() => { if (dataLoaded || isEdit) return; getMe(data?.user?.email ?? '').then(me => { fetch("/api/document/generate").then(r => r.json()).then(json => { setFormData({ docNumber: json.docCode || "", fullName: `${me?.user?.firstName || ""} ${me?.user?.lastName || ""}`.trim() || "", company: me?.user?.company || "", phone: me?.user?.phone || "" }); }); }); }, [dataLoaded, isEdit]);

  const searchShop = async (q: string) => { if (!q || q.length < 2) { setSearchResults([]); setShowDropdown(null); return; } const res = await fetch(`/api/shop/search?query=${encodeURIComponent(q)}&status=OPEN`); const json = await res.json(); const list = Array.isArray(json?.shops) ? json.shops : []; setSearchResults(list); if (list.length > 0) setShowDropdown; };
  const debouncedSearch = useMemo(() => debounce(searchShop, 300), []);

  // ✅ ค้นหา Barcode ที่อยู่ใน Shop ต้นทาง
  const fetchBarcodes = async (q: string, rowId: number) => { 
    // ล้าง name และ size เมื่อกำลังค้นหาใหม่
    setAssets(p => p.map(a => a.id === rowId ? { ...a, name: "", size: "" } : a));
    
    if (!shopCodeFrom) { 
      setBarcodeResults([]); 
      setShowBarcode(p => ({ ...p, [rowId]: false })); 
      return; 
    }
    // ✅ ใช้ searchByBarcode API + mcsCode เพื่อค้นหา Barcode ที่อยู่ใน Shop ต้นทาง
    const res = await fetch(`/api/asset/searchByBarcode?query=${encodeURIComponent(q)}&mcsCode=${encodeURIComponent(shopCodeFrom)}`); 
    const json = await res.json(); 
    const barcodes = json.assets || []; 
    setBarcodeResults(barcodes); 
    setShowBarcode(p => ({ ...p, [rowId]: true })); 
  };
  const debouncedBarcode = useMemo(() => debounce(fetchBarcodes, 300), [shopCodeFrom]);

  const handleSubmit = async (action: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (action === "approve" && editId) {
        // ✅ บันทึกข้อมูลก่อน
        const updatePayload = { documentType: "shop-to-shop", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "submitted", shops: [{ shopCode: shopCodeFrom, shopName: shopNameFrom, startInstallDate: transferDate, assets: assets.map(a => ({ barcode: a.barcode, name: a.name, size: a.size, grade: a.grade, qty: a.qty })), securitySets: securitySets.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty })) }, { shopCode: shopCodeTo, shopName: shopNameTo }] };
        const updateRes = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatePayload) });
        const updateR = await updateRes.json();
        if (!updateR.success) throw new Error(updateR.message);
        // ✅ จากนั้นค่อยอนุมัติ
        await fetch("/api/document/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: parseInt(editId), otherActivity }) }); toast.success("อนุมัติสำเร็จ!"); router.push("/dashboard/admin-list"); return;
      }
      if (action === "reject" && editId) { await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected", note }) }); toast.success("ปฏิเสธสำเร็จ!"); router.push("/dashboard/admin-list"); return; }
      const payload = { documentType: "shop-to-shop", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "submitted", shops: [{ shopCode: shopCodeFrom, shopName: shopNameFrom, startInstallDate: transferDate, assets: assets.map(a => ({ barcode: a.barcode, name: a.name, size: a.size, grade: a.grade, qty: a.qty })), securitySets: securitySets.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty })) }, { shopCode: shopCodeTo, shopName: shopNameTo }] };
      await fetch(isEdit ? `/api/document/update/${editId}` : "/api/document/create", { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
      <div className="flex items-center gap-2"><div className="icon-container cyan !w-10 !h-10"><ArrowLeftRight className="w-5 h-5" /></div><div><h1 className="text-xl sm:text-2xl font-semibold">{isEdit ? "แก้ไข" : "ใบย้ายของ"} Shop to Shop</h1><p className="text-sm text-muted-foreground">เลขที่ {formData.docNumber || "รอสร้าง"}</p></div></div>

      <div className="glass-card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><div className="icon-container blue !w-8 !h-8"><User className="w-4 h-4" /></div><h2 className="font-semibold">ข้อมูลผู้ทำรายการ</h2></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><div><label className="block text-xs text-muted-foreground mb-1">เลขที่</label><Input value={formData.docNumber} readOnly className="glass-input bg-black/5" /></div><div><label className="block text-xs text-muted-foreground mb-1">ชื่อ</label><Input value={formData.fullName} readOnly className="glass-input bg-black/5" /></div><div><label className="block text-xs text-muted-foreground mb-1">บริษัท</label><Input value={formData.company} readOnly className="glass-input bg-black/5" /></div><div><label className="block text-xs text-muted-foreground mb-1">เบอร์โทร</label><Input value={formData.phone} readOnly className="glass-input bg-black/5" /></div></div></div>

      <div className="glass-card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><div className="icon-container green !w-8 !h-8"><Store className="w-4 h-4" /></div><h2 className="font-semibold">Shop ต้นทาง</h2></div><div className="flex flex-col sm:flex-row gap-4"><div className="flex items-center gap-2"><Checkbox checked={noMcsFrom} onCheckedChange={(c) => { setNoMcsFrom(!!c); if (c) { setShopCodeFrom(""); setShopNameFrom(""); } }} /><label className="text-sm">NO MCS</label></div><div className="flex-1 relative"><label className="block text-xs text-muted-foreground mb-1">MCS Code</label><Input value={shopCodeFrom} onChange={(e) => { setShopCodeFrom(e.target.value); debouncedSearch(e.target.value); setShowDropdown("from"); }} onFocus={() => searchResults.length > 0 && setShowDropdown("from")} onBlur={() => setTimeout(() => setShowDropdown(null), 200)} disabled={noMcsFrom} placeholder="MCS Code" className="glass-input" />{showDropdown === "from" && searchResults.length > 0 && <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">{searchResults.map(s => <div key={s.mcsCode} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => { setShopCodeFrom(s.mcsCode); setShopNameFrom(s.shopName); setShowDropdown(null); }}><span className="text-primary font-medium">{s.mcsCode}</span> - {s.shopName}</div>)}</div>}</div><div className="flex-[2]"><label className="block text-xs text-muted-foreground mb-1">ชื่อ Shop</label><Input value={shopNameFrom} onChange={(e) => setShopNameFrom(e.target.value)} disabled={!noMcsFrom} placeholder="ชื่อ Shop" className="glass-input" /></div></div></div>

      <div className="glass-card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><div className="icon-container orange !w-8 !h-8"><Store className="w-4 h-4" /></div><h2 className="font-semibold">Shop ปลายทาง</h2></div><div className="flex flex-col sm:flex-row gap-4"><div className="flex items-center gap-2"><Checkbox checked={noMcsTo} onCheckedChange={(c) => { setNoMcsTo(!!c); if (c) { setShopCodeTo(""); setShopNameTo(""); } }} /><label className="text-sm">NO MCS</label></div><div className="flex-1 relative"><label className="block text-xs text-muted-foreground mb-1">MCS Code</label><Input value={shopCodeTo} onChange={(e) => { setShopCodeTo(e.target.value); debouncedSearch(e.target.value); setShowDropdown("to"); }} onFocus={() => searchResults.length > 0 && setShowDropdown("to")} onBlur={() => setTimeout(() => setShowDropdown(null), 200)} disabled={noMcsTo} placeholder="MCS Code" className="glass-input" />{showDropdown === "to" && searchResults.length > 0 && <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">{searchResults.map(s => <div key={s.mcsCode} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => { setShopCodeTo(s.mcsCode); setShopNameTo(s.shopName); setShowDropdown(null); }}><span className="text-primary font-medium">{s.mcsCode}</span> - {s.shopName}</div>)}</div>}</div><div className="flex-[2]"><label className="block text-xs text-muted-foreground mb-1">ชื่อ Shop</label><Input value={shopNameTo} onChange={(e) => setShopNameTo(e.target.value)} disabled={!noMcsTo} placeholder="ชื่อ Shop" className="glass-input" /></div></div><div className="mt-4 max-w-xs"><label className="block text-xs text-muted-foreground mb-1">วันที่โอน</label><Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="glass-input" /></div></div>

      <div className="glass-card p-4 sm:p-5"><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><div className="icon-container purple !w-8 !h-8"><Package className="w-4 h-4" /></div><h2 className="font-semibold">Asset</h2><span className="text-xs text-muted-foreground">({assets.length}/4)</span></div>{assets.length < 4 && <button onClick={() => setAssets([...assets, { id: assetIdCounter.current++, barcode: "", name: "", size: "", grade: "", qty: 1 }])} className="glass-button px-3 py-2 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />เพิ่ม</button>}</div><div className="space-y-3">{assets.map(asset => (<div key={asset.id} className="p-4 rounded-xl bg-black/2 border border-black/5 grid grid-cols-1 sm:grid-cols-12 gap-3"><div className="sm:col-span-3 relative"><label className="block text-xs text-muted-foreground mb-1">Barcode</label><Input value={asset.barcode} onChange={(e) => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, barcode: e.target.value } : a)); debouncedBarcode(e.target.value, asset.id); }} onFocus={() => { fetchBarcodes(asset.barcode, asset.id); }} onBlur={() => setTimeout(() => setShowBarcode(p => ({ ...p, [asset.id]: false })), 200)} placeholder="Barcode" className="glass-input" />{showBarcode[asset.id] && barcodeResults.length > 0 && <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">{barcodeResults.map(b => <div key={b.barcode} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, barcode: b.barcode, name: b.assetName, size: b.size || "" } : a)); setShowBarcode(p => ({ ...p, [asset.id]: false })); }}>{b.barcode} - {b.assetName}</div>)}</div>}</div><div className="sm:col-span-4"><label className="block text-xs text-muted-foreground mb-1">Asset Name</label><Input value={asset.name} readOnly placeholder="Asset Name" className="glass-input bg-black/5" /></div><div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">Size</label><Input value={asset.size} readOnly placeholder="Size" className="glass-input bg-black/5" /></div><div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">จำนวน</label><Input type="number" min={1} value={asset.qty} onChange={(e) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, qty: Math.max(1, +e.target.value) } : a))} className="glass-input text-center" /></div>{assets.length > 1 && <div className="flex items-end"><button onClick={() => setAssets(p => p.filter(a => a.id !== asset.id))} className="p-2 rounded-lg bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button></div>}</div>))}</div></div>

      <div className="glass-card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><div className="icon-container red !w-8 !h-8"><Shield className="w-4 h-4" /></div><h2 className="font-semibold">Security Set</h2></div><div className="space-y-3">{securitySets.map(set => (<div key={set.id} className="p-4 rounded-xl bg-black/2 border border-black/5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"><div className="sm:col-span-6"><label className="block text-xs text-muted-foreground mb-1">Security Name</label><Input value={set.name} readOnly className="glass-input bg-black/5" /></div><div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">จำนวน</label><Input type="number" min={0} value={set.qty} onChange={(e) => { const newQty = Math.max(0, +e.target.value); const defaultVendor = vendors.find(v => v === "NEWLOOK") || vendors[0] || ""; setSecuritySets(p => p.map(s => s.id === set.id ? { ...s, qty: newQty, withdrawFor: newQty > 0 && !s.withdrawFor && defaultVendor ? defaultVendor : (newQty === 0 ? "" : s.withdrawFor) } : s)); }} className="glass-input text-center" /></div>{mode === "admin" && <div className="sm:col-span-4"><label className="block text-xs text-muted-foreground mb-1">โกดัง</label><Select value={set.withdrawFor} onValueChange={(v) => setSecuritySets(p => p.map(s => s.id === set.id ? { ...s, withdrawFor: v } : s))}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger><SelectContent>{vendors.filter(v => v?.trim()).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>}</div>))}</div></div>

      <div className="glass-card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><div className="icon-container gray !w-8 !h-8"><FileText className="w-4 h-4" /></div><h2 className="font-semibold">หมายเหตุ</h2></div><Input placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} className="glass-input" /></div>

      {mode === "admin" && <OtherActivitiesSelect value={otherActivity} onChange={setOtherActivity} />}

      {!isReadOnly && (<div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">{mode === "admin" ? (<><button disabled={isSubmitting} onClick={() => handleSubmit("approve")} className="gradient-button px-8 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"><CheckCircle className="w-4 h-4" />{isSubmitting ? "กำลังดำเนินการ..." : "อนุมัติ"}</button><button disabled={isSubmitting} onClick={() => handleSubmit("reject")} className="px-8 py-3 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600 disabled:opacity-50"><XCircle className="w-4 h-4" />ปฏิเสธ</button></>) : (<button disabled={isSubmitting} onClick={() => handleSubmit("save")} className="gradient-button px-10 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" />{isSubmitting ? "กำลังบันทึก..." : (isEdit ? "บันทึกการแก้ไข" : "บันทึก")}</button>)}</div>)}
    </div>
  );
};
export default FormShopToShop;