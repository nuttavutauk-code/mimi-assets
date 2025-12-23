"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import debounce from "lodash.debounce";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getMe } from "./loader";
import { Plus, Trash2, User, Store, Package, FileText, Save, CheckCircle, XCircle, Loader2, HandCoins, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import OtherActivitiesSelect, { OtherActivity } from "@/components/ui/admin/OtherActivitiesSelect";
import StatusSelect, { StatusOption } from "@/components/ui/admin/StatusSelect";

type ShopItem = { mcsCode: string; shopName: string };
type AssetRow = {
  id: number;
  name: string;
  size: string;
  kv: string;
  qty: number;
  withdrawFor: string;
  autoWarehouse?: boolean;
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
type SubmitAction = "save" | "approve" | "reject";

// ✅ ตัวเลือกประเภทการยืม
const BORROW_TYPE_OPTIONS = ["EVENT", "TEMP SHOP"];

const FormBorrow = ({ mode = "user" }: { mode?: FormMode }) => {
  const { data } = useSession();
  const router = useRouter();
  const params = useParams();
  const editIdFromUrl = Array.isArray(params.id) ? params.id[0] : params.id;

  const [isEdit, setIsEdit] = useState(!!editIdFromUrl);
  const [editId, setEditId] = useState<string | null>(editIdFromUrl || null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [docStatus, setDocStatus] = useState("");
  const assetIdCounter = useRef(1);

  const [assets, setAssets] = useState<AssetRow[]>([{ id: assetIdCounter.current++, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendors, setVendors] = useState<string[]>([]);
  const [formData, setFormData] = useState({ docNumber: "", fullName: "", company: "", phone: "" });
  const [noMcs, setNoMcs] = useState(false);
  const [shopCode, setShopCode] = useState("");
  const [shopName, setShopName] = useState("");
  const [searchResults, setSearchResults] = useState<ShopItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [startInstallDate, setStartInstallDate] = useState("");
  const [endInstallDate, setEndInstallDate] = useState("");
  const [q7b7, setQ7b7] = useState("");
  const [shopFocus, setShopFocus] = useState("");
  const [note, setNote] = useState("");
  const [otherActivity, setOtherActivity] = useState<OtherActivity>("");
  const [transactionStatus, setTransactionStatus] = useState<StatusOption>("");
  const [assetSearchResults, setAssetSearchResults] = useState<string[]>([]);
  const [sizeOptions, setSizeOptions] = useState<Record<number, string[]>>({});
  const [showAssetDropdown, setShowAssetDropdown] = useState<Record<number, boolean>>({});
  const [borrowType, setBorrowType] = useState("");

  useEffect(() => {
    const fetchVendors = async () => {
      const res = await fetch("/api/vendor/list");
      const json = await res.json();
      if (json.vendors) setVendors(json.vendors?.filter((v: string) => v.trim() !== "") || []);
    };
    fetchVendors();
  }, []);

  useEffect(() => {
    if (!editIdFromUrl || dataLoaded) return;
    const loadExisting = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/document/${editIdFromUrl}`);
        const json = await res.json();
        if (json.success) {
          const doc = json.document;
          setDocStatus(doc.status || "");
          setFormData({ docNumber: doc.docCode, fullName: doc.fullName || "", company: doc.company || "", phone: doc.phone || "" });
          const shop = doc.shops?.[0];
          if (shop) {
            setShopCode(shop.shopCode || "");
            setShopName(shop.shopName || "");
            if (shop.startInstallDate) setStartInstallDate(new Date(shop.startInstallDate).toISOString().split('T')[0]);
            if (shop.endInstallDate) setEndInstallDate(new Date(shop.endInstallDate).toISOString().split('T')[0]);
            setQ7b7(shop.q7b7 || "");
            setShopFocus(shop.shopFocus || "");
            if (shop.assets?.length > 0) {
              const loadedAssets = shop.assets.map((a: any, idx: number) => ({ id: idx + 1, name: a.name || "", size: a.size || "", kv: a.kv || "", qty: a.qty || 1, withdrawFor: a.withdrawFor || "" }));
              setAssets(loadedAssets);
              assetIdCounter.current = shop.assets.length + 1;
              // ✅ โหลด size options สำหรับแต่ละ asset
              loadedAssets.forEach(async (asset: any) => {
                if (asset.name) {
                  try {
                    const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(asset.name)}`);
                    const json = await res.json();
                    setSizeOptions(p => ({ ...p, [asset.id]: json.sizes || [] }));
                  } catch (err) { console.error("Error loading sizes:", err); }
                }
              });
            }
          }
          setNote(doc.note || "");
          setBorrowType(doc.borrowType || "");
          setTransactionStatus(doc.transactionStatus || "");
        }
        setDataLoaded(true);
      } catch (err) { console.error(err); toast.error("โหลดข้อมูลไม่สำเร็จ"); }
      finally { setLoading(false); }
    };
    loadExisting();
  }, [editIdFromUrl, dataLoaded]);

  // ✅ Fixed: Load user data using session email
  useEffect(() => {
    if (isEdit || dataLoaded || !data?.user) return;
    const initForm = async () => {
      setLoading(true);
      try {
        const me = await getMe(data?.user?.email ?? "");
        const { user } = me;
        const docRes = await fetch("/api/document/generate");
        const { docCode } = await docRes.json();
        setFormData({
          docNumber: docCode || "",
          fullName: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
          company: user?.company || "",
          phone: user?.phone || "",
        });
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    initForm();
  }, [data, isEdit, dataLoaded]);

  // ✅ Fixed: Shop search with correct API param "query"
  const fetchShops = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (query.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const res = await fetch(`/api/shop/search?query=${encodeURIComponent(query)}&status=OPEN`, { signal: controller.signal });
      const json = await res.json();
      const list: ShopItem[] = Array.isArray(json?.shops) ? json.shops : [];
      const q = query.toLowerCase();
      const filtered = list.filter((s) => s.mcsCode?.toLowerCase().includes(q));
      setSearchResults(filtered);
      setShowDropdown(filtered.length > 0);
    } catch (err) { if ((err as any)?.name !== "AbortError") console.error(err); }
  }, []);

  const debouncedSearch = useMemo(() => debounce(fetchShops, 300), [fetchShops]);

  // ✅ Fixed: Asset search with correct API param "query"
  const fetchAssetNames = async (query: string, rowId: number) => {
    if (!query || query.trim().length < 2) { setAssetSearchResults([]); setShowAssetDropdown(p => ({ ...p, [rowId]: false })); return; }
    try {
      const res = await fetch(`/api/asset/search?query=${encodeURIComponent(query)}`);
      const json = await res.json();
      const names = json.assets?.map((a: any) => a.assetName).filter(Boolean) ?? [];
      setAssetSearchResults(names);
      setShowAssetDropdown(p => ({ ...p, [rowId]: true }));
    } catch (err) { console.error(err); }
  };

  const debouncedAssetSearch = useMemo(() => debounce(fetchAssetNames, 300), []);

  const fetchSizesByAssetName = async (assetName: string, rowId: number) => {
    try {
      const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(assetName)}`);
      const json = await res.json();
      setSizeOptions(p => ({ ...p, [rowId]: json.sizes || [] }));
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (action: SubmitAction) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // ✅ Validate borrowType
      if (!borrowType) {
        toast.error("กรุณาเลือกประเภทการยืม");
        return;
      }

      // ✅ Admin ต้องเลือก Status ก่อนอนุมัติ
      if (action === "approve" && mode === "admin" && !transactionStatus) {
        toast.error("กรุณาเลือก Status ก่อนอนุมัติ");
        return;
      }

      // ✅ Admin ต้องเลือกโกดังครบทุก Asset ก่อนอนุมัติ
      if (action === "approve" && mode === "admin") {
        const missingWarehouse = assets.some(a => !a.withdrawFor || a.withdrawFor.trim() === "");
        if (missingWarehouse) {
          toast.error("กรุณาเลือกโกดังให้ครบทุกรายการก่อนอนุมัติ");
          return;
        }
      }

      if (action === "approve" && isEdit && editId) {
        // ✅ บันทึกข้อมูลก่อน (รวมถึง withdrawFor ที่ Admin เลือก)
        const updatePayload = {
          documentType: "borrow", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "submitted",
          borrowType,
          transactionStatus: transactionStatus || null,
          shops: [{ shopCode, shopName, startInstallDate, endInstallDate, q7b7, shopFocus, assets: assets.map(a => ({ name: a.name, size: a.size || null, kv: a.kv || null, qty: a.qty, withdrawFor: a.withdrawFor })) }],
        };
        const updateRes = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatePayload) });
        const updateResult = await updateRes.json();
        if (!updateResult.success) throw new Error(updateResult.message);
        // ✅ จากนั้นค่อยอนุมัติ
        const res = await fetch("/api/document/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: parseInt(editId), otherActivity: otherActivity || null }) });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        toast.success("อนุมัติสำเร็จ!"); router.push("/dashboard/admin-list"); return;
      }
      if (action === "reject" && isEdit && editId) {
        const res = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected", note }) });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        toast.success("ปฏิเสธสำเร็จ!"); router.push("/dashboard/admin-list"); return;
      }
      const payload = {
        documentType: "borrow", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "submitted",
        borrowType,
        shops: [{ shopCode, shopName, startInstallDate, endInstallDate, q7b7, shopFocus, assets: assets.map(a => ({ name: a.name, size: a.size || null, kv: a.kv || null, qty: a.qty, withdrawFor: a.withdrawFor })) }],
      };
      const apiUrl = isEdit ? `/api/document/update/${editId}` : "/api/document/create";
      const res = await fetch(apiUrl, { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      toast.success(isEdit ? "แก้ไขสำเร็จ!" : "บันทึกสำเร็จ!"); router.push(mode === "admin" ? "/dashboard/admin-list" : "/dashboard/user-list");
    } catch (error) { console.error(error); toast.error("เกิดข้อผิดพลาด"); }
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="icon-container cyan !w-10 !h-10"><HandCoins className="w-5 h-5" /></div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{isEdit ? "แก้ไขใบยืม Asset" : "ใบยืม Asset"}</h1>
              <p className="text-sm text-muted-foreground">เลขที่ {formData.docNumber || "รอสร้าง"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ข้อมูลผู้ยืม */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container blue !w-8 !h-8"><User className="w-4 h-4" /></div><h2 className="font-semibold text-foreground">ข้อมูลผู้ยืม</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="block text-xs font-medium text-muted-foreground mb-1">เลขที่เอกสาร</label><Input value={formData.docNumber} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1">ชื่อผู้ยืม</label><Input value={formData.fullName} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1">บริษัท</label><Input value={formData.company} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1">เบอร์โทรศัพท์</label><Input value={formData.phone} readOnly className="glass-input bg-black/5" /></div>
        </div>
      </div>

      {/* ✅ ประเภทการยืม */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-container purple !w-8 !h-8"><ClipboardList className="w-4 h-4" /></div>
          <h2 className="font-semibold text-foreground">ประเภทการยืม</h2>
          <span className="text-red-500">*</span>
        </div>
        <div className="flex flex-wrap gap-6">
          {BORROW_TYPE_OPTIONS.map((label) => (
            <div key={label} className="flex items-center gap-2">
              <Checkbox
                id={`borrow-${label}`}
                checked={borrowType === label}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setBorrowType(label);
                  } else {
                    setBorrowType("");
                  }
                }}
                disabled={isReadOnly}
                className="border-2 border-gray-400 data-[state=checked]:border-primary"
              />
              <label htmlFor={`borrow-${label}`} className="text-sm font-medium cursor-pointer">{label}</label>
            </div>
          ))}
        </div>
      </div>

      {/* ข้อมูล Shop */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container green !w-8 !h-8"><Store className="w-4 h-4" /></div><h2 className="font-semibold text-foreground">ข้อมูล Shop</h2></div>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex items-center gap-2"><Checkbox id="nomcs" checked={noMcs} onCheckedChange={(c) => { setNoMcs(!!c); if (c) { setShopCode(""); setShopName(""); } }} /><label htmlFor="nomcs" className="text-sm font-medium cursor-pointer">NO MCS</label></div>
            <div className="flex-1 relative">
              <label className="block text-xs font-medium text-muted-foreground mb-1">MCS Code <span className="text-red-500">*</span></label>
              <Input value={shopCode} onChange={(e) => { setShopCode(e.target.value); debouncedSearch(e.target.value); }} onFocus={() => searchResults.length > 0 && setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 200)} placeholder="พิมพ์ MCS Code..." disabled={noMcs} className="glass-input" />
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">
                  {searchResults.map((shop) => (<div key={shop.mcsCode} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => { setShopCode(shop.mcsCode); setShopName(shop.shopName); setShowDropdown(false); }}><span className="font-medium text-primary">{shop.mcsCode}</span> - {shop.shopName}</div>))}
                </div>
              )}
            </div>
            <div className="flex-[2]"><label className="block text-xs font-medium text-muted-foreground mb-1">Shop Name <span className="text-red-500">*</span></label><Input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="ชื่อร้าน" disabled={!noMcs} className="glass-input" /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">วันที่ยืม <span className="text-red-500">*</span></label><Input type="date" value={startInstallDate} onChange={(e) => setStartInstallDate(e.target.value)} placeholder="เลือกวันที่" className="glass-input" /></div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">วันที่คืน <span className="text-red-500">*</span></label><Input type="date" value={endInstallDate} onChange={(e) => setEndInstallDate(e.target.value)} placeholder="เลือกวันที่" className="glass-input" /></div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">Q7B7</label><Select value={q7b7} onValueChange={setQ7b7}><SelectTrigger className="glass-input"><SelectValue placeholder="Yes / No" /></SelectTrigger><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent></Select></div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">Shop Focus</label><Select value={shopFocus} onValueChange={setShopFocus}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือกกลุ่ม" /></SelectTrigger><SelectContent><SelectItem value="1. Flagship">1. Flagship</SelectItem><SelectItem value="2. A Series (High to Flagship) 10K+">2. A Series (High to Flagship) 10K+</SelectItem><SelectItem value="3. A Series (Mid to High) 7-10K">3. A Series (Mid to High) 7-10K</SelectItem><SelectItem value="4. A Series (Mass) ~7K">4. A Series (Mass) ~7K</SelectItem><SelectItem value="5. A Series (Entry) < 5K">5. A Series (Entry) &lt; 5K</SelectItem></SelectContent></Select></div>
          </div>
        </div>
      </div>

      {/* Asset */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><div className="icon-container orange !w-8 !h-8"><Package className="w-4 h-4" /></div><h2 className="font-semibold text-foreground">Asset</h2><span className="text-xs text-muted-foreground">({assets.length}/5)</span></div>
          {assets.length < 5 && <button onClick={() => setAssets([...assets, { id: assetIdCounter.current++, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }])} className="glass-button px-3 py-2 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />เพิ่ม</button>}
        </div>
        <div className="space-y-3">
          {assets.map((asset, idx) => (
            <div key={asset.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className={`${mode === "admin" ? "sm:col-span-4" : "sm:col-span-5"} relative`}>
                  <label className="block text-xs text-muted-foreground mb-1">Asset Name <span className="text-red-500">*</span></label>
                  <Input value={asset.name} onChange={(e) => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, name: e.target.value } : a)); debouncedAssetSearch(e.target.value, asset.id); }} onFocus={() => assetSearchResults.length > 0 && setShowAssetDropdown(p => ({ ...p, [asset.id]: true }))} onBlur={() => setTimeout(() => setShowAssetDropdown(p => ({ ...p, [asset.id]: false })), 200)} placeholder="พิมพ์ชื่อ Asset..." className="glass-input" />
                  {showAssetDropdown[asset.id] && assetSearchResults.length > 0 && (<div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">{assetSearchResults.map((name) => (<div key={name} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, name } : a)); fetchSizesByAssetName(name, asset.id); setShowAssetDropdown(p => ({ ...p, [asset.id]: false })); }}>{name}</div>))}</div>)}
                </div>
                <div className={mode === "admin" ? "sm:col-span-2" : "sm:col-span-3"}><label className="block text-xs text-muted-foreground mb-1">Size</label><Select value={asset.useCustomSize ? "ไม่มีsize" : asset.size} onValueChange={(v) => { if (v === "ไม่มีsize") { setAssets(p => p.map(a => a.id === asset.id ? { ...a, size: "", useCustomSize: true, customW: "", customD: "", customH: "", customXX: "" } : a)); } else { setAssets(p => p.map(a => a.id === asset.id ? { ...a, size: v, useCustomSize: false, customW: undefined, customD: undefined, customH: undefined, customXX: undefined } : a)); } }}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger><SelectContent>{(sizeOptions[asset.id] || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                {asset.useCustomSize && isCustomSizeAsset(asset.name) && (<div className="sm:col-span-12 mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200"><label className="block text-xs text-amber-700 font-medium mb-2">กรอกขนาด (W*D*H(XX))</label><div className="grid grid-cols-4 gap-2"><Input value={asset.customW || ""} onChange={(e) => { const newW = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customW: newW, size: `${newW}*${a.customD || ""}*${a.customH || ""}(${a.customXX || ""})` })); }} placeholder="W" className="glass-input text-center" /><Input value={asset.customD || ""} onChange={(e) => { const newD = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customD: newD, size: `${a.customW || ""}*${newD}*${a.customH || ""}(${a.customXX || ""})` })); }} placeholder="D" className="glass-input text-center" /><Input value={asset.customH || ""} onChange={(e) => { const newH = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customH: newH, size: `${a.customW || ""}*${a.customD || ""}*${newH}(${a.customXX || ""})` })); }} placeholder="H" className="glass-input text-center" /><Input value={asset.customXX || ""} onChange={(e) => { const newXX = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customXX: newXX, size: `${a.customW || ""}*${a.customD || ""}*${a.customH || ""}(${newXX})` })); }} placeholder="XX" className="glass-input text-center" /></div></div>)}
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">KV</label><Input value={asset.kv} onChange={(e) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, kv: e.target.value } : a))} placeholder="KV" className="glass-input" /></div>
                <div className={mode === "admin" ? "sm:col-span-1" : "sm:col-span-2"}><label className="block text-xs text-muted-foreground mb-1">จำนวน</label><Input type="number" min={1} value={asset.qty} onChange={(e) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, qty: Math.max(1, +e.target.value) } : a))} placeholder="1" className="glass-input text-center" /></div>
                {mode === "admin" && (<div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">โกดัง</label><Select value={asset.withdrawFor} onValueChange={(v) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, withdrawFor: v } : a))}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger><SelectContent>{vendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>)}
                {assets.length > 1 && <div className="flex items-end"><button onClick={() => setAssets(p => p.filter(a => a.id !== asset.id))} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 className="w-4 h-4" /></button></div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* หมายเหตุ */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container gray !w-8 !h-8"><FileText className="w-4 h-4" /></div><h2 className="font-semibold text-foreground">หมายเหตุ</h2></div>
        <Input placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} className="glass-input" />
      </div>

      {mode === "admin" && <OtherActivitiesSelect value={otherActivity} onChange={setOtherActivity} />}

      {/* Status - Admin only (บังคับเลือก) */}
      {mode === "admin" && <StatusSelect value={transactionStatus} onChange={setTransactionStatus} />}

      {/* Action Buttons */}
      {!isReadOnly && (
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
          {mode === "admin" ? (
            <>
              <button disabled={isSubmitting} onClick={() => handleSubmit("approve")} className="gradient-button px-8 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"><CheckCircle className="w-4 h-4" />{isSubmitting ? "กำลังดำเนินการ..." : "อนุมัติ"}</button>
              <button disabled={isSubmitting} onClick={() => handleSubmit("reject")} className="px-8 py-3 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-50"><XCircle className="w-4 h-4" />ปฏิเสธ</button>
            </>
          ) : (
            <button disabled={isSubmitting} onClick={() => handleSubmit("save")} className="gradient-button px-10 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" />{isSubmitting ? "กำลังบันทึก..." : (isEdit ? "บันทึกการแก้ไข" : "บันทึก")}</button>
          )}
        </div>
      )}
    </div>
  );
};

export default FormBorrow;