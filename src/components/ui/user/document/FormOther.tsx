"use client";

import { useSession } from "next-auth/react";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import debounce from "lodash.debounce";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getMe } from "./loader";
import { Plus, Trash2, User, Store, Package, FileText, Save, CheckCircle, XCircle, Loader2, MoreHorizontal, Shield } from "lucide-react";
import { toast } from "sonner";
import OtherActivitiesSelect, { OtherActivity } from "@/components/ui/admin/OtherActivitiesSelect";
import StatusSelect, { StatusOption } from "@/components/ui/admin/StatusSelect";

type ShopItem = { mcsCode: string; shopName: string };
type AssetRow = {
  id: number;
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
type SecuritySet = { id: number; name: string; qty: number; withdrawFor: string };
type FormMode = "user" | "admin";

const FormOther = ({ mode = "user" }: { mode?: FormMode }) => {
  const { data } = useSession();
  const router = useRouter();
  const params = useParams();
  const editIdFromUrl = Array.isArray(params.id) ? params.id[0] : params.id;
  const [isEdit] = useState(!!editIdFromUrl);
  const [editId] = useState<string | null>(editIdFromUrl || null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [docStatus, setDocStatus] = useState("");
  const assetIdCounter = useRef(1);

  const [assets, setAssets] = useState<AssetRow[]>([{ id: assetIdCounter.current++, name: "", size: "", grade: "", qty: 1, withdrawFor: "" }]);
  const defaultSecuritySets: SecuritySet[] = [
    { id: 1, name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 0, withdrawFor: "" },
    { id: 2, name: "Security Type C Ver.7.1", qty: 0, withdrawFor: "" },
    { id: 3, name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
  ];
  const [securitySets, setSecuritySets] = useState<SecuritySet[]>(defaultSecuritySets);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendors, setVendors] = useState<string[]>([]);
  const [formData, setFormData] = useState({ docNumber: "", fullName: "", company: "", phone: "" });
  const [noMcs, setNoMcs] = useState(false);
  const [shopCode, setShopCode] = useState("");
  const [shopName, setShopName] = useState("");
  const [searchResults, setSearchResults] = useState<ShopItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [q7b7, setQ7b7] = useState("");
  const [shopFocus, setShopFocus] = useState("");
  const [note, setNote] = useState("");
  const [otherActivity, setOtherActivity] = useState<OtherActivity>("");
  const [transactionStatus, setTransactionStatus] = useState<StatusOption>("");
  const [assetSearchResults, setAssetSearchResults] = useState<string[]>([]);
  const [sizeOptions, setSizeOptions] = useState<Record<number, string[]>>({});
  const [showAssetDropdown, setShowAssetDropdown] = useState<Record<number, boolean>>({});

  useEffect(() => { fetch("/api/vendor/list").then(r => r.json()).then(j => j.success && setVendors(j.vendors?.filter((v: string) => v.trim()) || [])); }, []);

  useEffect(() => {
    if (!editIdFromUrl || dataLoaded) return;
    setLoading(true);
    fetch(`/api/document/${editIdFromUrl}`).then(r => r.json()).then(async json => {
      if (json.success) {
        const doc = json.document;
        setDocStatus(doc.status || "");
        setFormData({ docNumber: doc.docCode, fullName: doc.fullName || "", company: doc.company || "", phone: doc.phone || "" });
        const shop = doc.shops?.[0];
        if (shop) {
          setShopCode(shop.shopCode || ""); setShopName(shop.shopName || "");
          if (shop.startInstallDate) setStartDate(new Date(shop.startInstallDate).toISOString().split('T')[0]);
          if (shop.endInstallDate) setEndDate(new Date(shop.endInstallDate).toISOString().split('T')[0]);
          setQ7b7(shop.q7b7 || "");
          setShopFocus(shop.shopFocus || "");
          if (shop.assets?.length > 0) {
            const loadedAssets = shop.assets.map((a: any, idx: number) => ({ id: idx + 1, name: a.name || "", size: a.size || "", grade: a.grade || "", qty: a.qty || 1, withdrawFor: a.withdrawFor || "" }));
            setAssets(loadedAssets);
            // ✅ โหลด size options สำหรับแต่ละ asset
            loadedAssets.forEach(async (asset: any) => {
              if (asset.name) {
                try {
                  const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(asset.name)}`);
                  const sizeJson = await res.json();
                  setSizeOptions(p => ({ ...p, [asset.id]: sizeJson.sizes || [] }));
                } catch (err) { console.error("Error loading sizes:", err); }
              }
            });
          }
          if (shop.securitySets?.length > 0) setSecuritySets(defaultSecuritySets.map(def => { const found = shop.securitySets.find((s: any) => s.name === def.name); return found ? { ...def, qty: found.qty || 0, withdrawFor: found.withdrawFor || "" } : def; }));
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

  const fetchAssetNames = async (q: string, rowId: number) => {
    if (!q) { setAssetSearchResults([]); setShowAssetDropdown(p => ({ ...p, [rowId]: false })); return; }
    const res = await fetch(`/api/asset/search?query=${encodeURIComponent(q)}`); const json = await res.json();
    const names = json.assets?.map((a: any) => a.assetName).filter(Boolean) ?? []; setAssetSearchResults(names); setShowAssetDropdown(p => ({ ...p, [rowId]: true }));
  };
  const debouncedAsset = useMemo(() => debounce(fetchAssetNames, 300), []);

  const fetchSizes = async (name: string, rowId: number) => {
    const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(name)}`); const json = await res.json();
    setSizeOptions(p => ({ ...p, [rowId]: json.sizes || [] }));
  };

  const handleSubmit = async (action: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // ✅ Validation: ต้องเลือกวันที่โอนย้าย
      if (!startDate) {
        toast.error("กรุณาเลือกวันที่โอนย้าย");
        return;
      }

      // ✅ Validation: ต้องมี Asset หรือ Security Set อย่างน้อย 1 รายการ
      const hasAsset = assets.some(a => a.name.trim());
      const hasSecuritySet = securitySets.some(s => s.qty > 0);
      if (!hasAsset && !hasSecuritySet) {
        toast.error("กรุณาเพิ่ม Asset หรือ Security Set อย่างน้อย 1 รายการ");
        return;
      }

      // ✅ Admin ต้องเลือกโกดังครบทุก Asset ก่อนอนุมัติ
      if (action === "approve" && mode === "admin") {
        const missingAssetWarehouse = assets.filter(a => a.name.trim()).some(a => !a.withdrawFor || a.withdrawFor.trim() === "");
        const missingSecurityWarehouse = securitySets.filter(s => s.qty > 0).some(s => !s.withdrawFor || s.withdrawFor.trim() === "");
        if (missingAssetWarehouse || missingSecurityWarehouse) {
          toast.error("กรุณาเลือกโกดังให้ครบทุกรายการก่อนอนุมัติ");
          return;
        }
      }

      if (action === "approve" && editId) {
        // ✅ บันทึกข้อมูลก่อน (รวมถึง withdrawFor ที่ Admin เลือก)
        const updatePayload = { documentType: "other", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "submitted", shops: [{ shopCode, shopName, startInstallDate: startDate, endInstallDate: endDate, q7b7, shopFocus, assets: assets.map(a => ({ name: a.name, size: a.size, grade: a.grade, qty: a.qty, withdrawFor: a.withdrawFor })), securitySets: securitySets.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor })) }] };
        const updateRes = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatePayload) });
        const updateR = await updateRes.json();
        if (!updateR.success) throw new Error(updateR.message);
        // ✅ จากนั้นค่อยอนุมัติ
        const res = await fetch("/api/document/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: parseInt(editId), otherActivity }) }); const r = await res.json(); if (!r.success) throw new Error(r.message); toast.success("อนุมัติสำเร็จ!"); router.push("/dashboard/admin-list"); return;
      }
      if (action === "reject" && editId) {
        const rejectPayload = { documentType: "other", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "rejected", shops: [{ shopCode, shopName, startInstallDate: startDate, endInstallDate: endDate, q7b7, shopFocus, assets: assets.map(a => ({ name: a.name, size: a.size, grade: a.grade, qty: a.qty, withdrawFor: a.withdrawFor })), securitySets: securitySets.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor })) }] };
        const res = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rejectPayload) }); const r = await res.json(); if (!r.success) throw new Error(r.message); toast.success("ปฏิเสธสำเร็จ!"); router.push("/dashboard/admin-list"); return;
      }
      const payload = { documentType: "other", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "submitted", shops: [{ shopCode, shopName, startInstallDate: startDate, endInstallDate: endDate, q7b7, shopFocus, assets: assets.map(a => ({ name: a.name, size: a.size, grade: a.grade, qty: a.qty, withdrawFor: a.withdrawFor })), securitySets: securitySets.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor })) }] };
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
        <div className="icon-container gray !w-10 !h-10"><MoreHorizontal className="w-5 h-5" /></div>
        <div><h1 className="text-xl sm:text-2xl font-semibold">{isEdit ? "แก้ไขใบเบิกของอื่นๆ" : "ใบเบิกของอื่นๆ"}</h1><p className="text-sm text-muted-foreground">เลขที่ {formData.docNumber || "รอสร้าง"}</p></div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container blue !w-8 !h-8"><User className="w-4 h-4" /></div><h2 className="font-semibold">ข้อมูลผู้เบิก</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="block text-xs text-muted-foreground mb-1">เลขที่เอกสาร</label><Input value={formData.docNumber} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">ชื่อ</label><Input value={formData.fullName} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">บริษัท</label><Input value={formData.company} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">เบอร์โทร</label><Input value={formData.phone} readOnly className="glass-input bg-black/5" /></div>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container green !w-8 !h-8"><Store className="w-4 h-4" /></div><h2 className="font-semibold">ข้อมูล Shop</h2></div>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><label className="block text-xs text-muted-foreground mb-1">วันที่โอนย้าย <span className="text-red-500">*</span></label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="glass-input" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">วันที่สิ้นสุด</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="glass-input" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Q7B7</label><Select value={q7b7} onValueChange={setQ7b7}><SelectTrigger className="glass-input"><SelectValue placeholder="Yes / No" /></SelectTrigger><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent></Select></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Shop Focus</label><Select value={shopFocus} onValueChange={setShopFocus}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือกกลุ่ม" /></SelectTrigger><SelectContent><SelectItem value="1. Flagship">1. Flagship</SelectItem><SelectItem value="2. A Series (High to Flagship) 10K+">2. A Series (High to Flagship) 10K+</SelectItem><SelectItem value="3. A Series (Mid to High) 7-10K">3. A Series (Mid to High) 7-10K</SelectItem><SelectItem value="4. A Series (Mass) ~7K">4. A Series (Mass) ~7K</SelectItem><SelectItem value="5. A Series (Entry) < 5K">5. A Series (Entry) &lt; 5K</SelectItem></SelectContent></Select></div>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><div className="icon-container orange !w-8 !h-8"><Package className="w-4 h-4" /></div><h2 className="font-semibold">Asset</h2><span className="text-xs text-muted-foreground">({assets.length}/4)</span></div>
          {assets.length < 4 && <button onClick={() => setAssets([...assets, { id: assetIdCounter.current++, name: "", size: "", grade: "", qty: 1, withdrawFor: "" }])} className="glass-button px-3 py-2 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />เพิ่ม</button>}
        </div>
        <div className="space-y-3">
          {assets.map((asset) => (
            <div key={asset.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4 relative">
                  <label className="block text-xs text-muted-foreground mb-1">Asset Name</label>
                  <Input value={asset.name} onChange={(e) => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, name: e.target.value } : a)); debouncedAsset(e.target.value, asset.id); }} onFocus={() => assetSearchResults.length > 0 && setShowAssetDropdown(p => ({ ...p, [asset.id]: true }))} onBlur={() => setTimeout(() => setShowAssetDropdown(p => ({ ...p, [asset.id]: false })), 200)} placeholder="พิมพ์ชื่อ Asset..." className="glass-input" />
                  {showAssetDropdown[asset.id] && assetSearchResults.length > 0 && <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">{assetSearchResults.map(n => <div key={n} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, name: n } : a)); fetchSizes(n, asset.id); setShowAssetDropdown(p => ({ ...p, [asset.id]: false })); }}>{n}</div>)}</div>}
                </div>
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">Size</label><Select value={asset.useCustomSize ? "ไม่มีsize" : asset.size} onValueChange={(v) => { if (v === "ไม่มีsize") { setAssets(p => p.map(a => a.id === asset.id ? { ...a, size: "", useCustomSize: true, customW: "", customD: "", customH: "", customXX: "" } : a)); } else { setAssets(p => p.map(a => a.id === asset.id ? { ...a, size: v, useCustomSize: false, customW: undefined, customD: undefined, customH: undefined, customXX: undefined } : a)); } }}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger><SelectContent>{(sizeOptions[asset.id] || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                {asset.useCustomSize && isCustomSizeAsset(asset.name) && (<div className="sm:col-span-12 mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200"><label className="block text-xs text-amber-700 font-medium mb-2">กรอกขนาด (W*D*H(XX))</label><div className="grid grid-cols-4 gap-2"><Input value={asset.customW || ""} onChange={(e) => { const newW = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customW: newW, size: `${newW}*${a.customD || ""}*${a.customH || ""}(${a.customXX || ""})` })); }} placeholder="W" className="glass-input text-center" /><Input value={asset.customD || ""} onChange={(e) => { const newD = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customD: newD, size: `${a.customW || ""}*${newD}*${a.customH || ""}(${a.customXX || ""})` })); }} placeholder="D" className="glass-input text-center" /><Input value={asset.customH || ""} onChange={(e) => { const newH = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customH: newH, size: `${a.customW || ""}*${a.customD || ""}*${newH}(${a.customXX || ""})` })); }} placeholder="H" className="glass-input text-center" /><Input value={asset.customXX || ""} onChange={(e) => { const newXX = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customXX: newXX, size: `${a.customW || ""}*${a.customD || ""}*${a.customH || ""}(${newXX})` })); }} placeholder="XX" className="glass-input text-center" /></div></div>)}
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">จำนวน</label><Input type="number" min={1} value={asset.qty} onChange={(e) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, qty: Math.max(1, +e.target.value) } : a))} placeholder="1" className="glass-input text-center" /></div>
                {mode === "admin" && <div className="sm:col-span-3"><label className="block text-xs text-muted-foreground mb-1">โกดัง</label><Select value={asset.withdrawFor} onValueChange={(v) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, withdrawFor: v } : a))}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger><SelectContent>{vendors.filter(v => v?.trim()).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>}
                {assets.length > 1 && <div className="flex items-end"><button onClick={() => setAssets(p => p.filter(a => a.id !== asset.id))} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 className="w-4 h-4" /></button></div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container purple !w-8 !h-8"><Shield className="w-4 h-4" /></div><h2 className="font-semibold">Security Set</h2></div>
        <div className="space-y-3">
          {securitySets.map((set) => (
            <div key={set.id} className="p-4 rounded-xl bg-black/2 border border-black/5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6"><label className="block text-xs text-muted-foreground mb-1">Security Name</label><Input value={set.name} readOnly className="glass-input bg-black/5" /></div>
              <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">จำนวน</label><Input type="number" min={0} value={set.qty} onChange={(e) => { const newQty = Math.max(0, +e.target.value); const defaultVendor = vendors.find(v => v === "NEWLOOK") || vendors[0] || ""; setSecuritySets(p => p.map(s => s.id === set.id ? { ...s, qty: newQty, withdrawFor: newQty > 0 && !s.withdrawFor && defaultVendor ? defaultVendor : (newQty === 0 ? "" : s.withdrawFor) } : s)); }} placeholder="0" className="glass-input text-center" /></div>
              {mode === "admin" && <div className="sm:col-span-4"><label className="block text-xs text-muted-foreground mb-1">โกดัง</label><Select value={set.withdrawFor} onValueChange={(v) => setSecuritySets(p => p.map(s => s.id === set.id ? { ...s, withdrawFor: v } : s))}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger><SelectContent>{vendors.filter(v => v?.trim()).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>}
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

export default FormOther;