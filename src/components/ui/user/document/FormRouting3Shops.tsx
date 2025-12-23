"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import debounce from "lodash.debounce";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getMe } from "./loader";
import { Plus, Trash2, User, Store, Package, Shield, FileText, Save, CheckCircle, XCircle, Loader2, Route } from "lucide-react";
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
type SecuritySet = { id: number; name: string; qty: number; withdrawFor: string };

const isCustomSizeAsset = (name: string) => {
  const lowerName = name.toLowerCase().replace(/\s+/g, '');
  return lowerName.includes("lightbox") || lowerName.includes("accwall");
};

type ShopState = {
  noMcs: boolean;
  shopCode: string;
  shopName: string;
  startDate: string;
  endDate: string;
  q7b7: string;
  focus: string;
  searchResults: ShopItem[];
  showDropdown: boolean;
};
type FormMode = "user" | "admin";

const defaultSecuritySets = (): SecuritySet[] => [
  { id: 1, name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 0, withdrawFor: "" },
  { id: 2, name: "Security Type C Ver.7.1", qty: 0, withdrawFor: "" },
  { id: 3, name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
];

const FormRouting3Shops = ({ mode = "user" }: { mode?: FormMode }) => {
  const { data } = useSession();
  const router = useRouter();
  const params = useParams();
  const editIdFromUrl = Array.isArray(params.id) ? params.id[0] : params.id;

  const [isEdit] = useState(!!editIdFromUrl);
  const [editId] = useState<string | null>(editIdFromUrl || null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [docStatus, setDocStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assetIdCounter1 = useRef(1);
  const assetIdCounter2 = useRef(1);
  const assetIdCounter3 = useRef(1);

  const [formData, setFormData] = useState({ docNumber: "", fullName: "", company: "", phone: "" });
  const [vendors, setVendors] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [otherActivity, setOtherActivity] = useState<OtherActivity>("");
  const [transactionStatus, setTransactionStatus] = useState<StatusOption>("");

  // Shop 1
  const [shop1, setShop1] = useState<ShopState>({ noMcs: false, shopCode: "", shopName: "", startDate: "", endDate: "", q7b7: "", focus: "", searchResults: [], showDropdown: false });
  const [assets1, setAssets1] = useState<AssetRow[]>([{ id: assetIdCounter1.current++, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }]);
  const [securitySets1, setSecuritySets1] = useState<SecuritySet[]>(defaultSecuritySets());
  const [sizeOptions1, setSizeOptions1] = useState<Record<number, string[]>>({});
  const [assetSearchResults1, setAssetSearchResults1] = useState<string[]>([]);
  const [showAssetDropdown1, setShowAssetDropdown1] = useState<Record<number, boolean>>({});

  // Shop 2
  const [shop2, setShop2] = useState<ShopState>({ noMcs: false, shopCode: "", shopName: "", startDate: "", endDate: "", q7b7: "", focus: "", searchResults: [], showDropdown: false });
  const [assets2, setAssets2] = useState<AssetRow[]>([{ id: assetIdCounter2.current++, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }]);
  const [securitySets2, setSecuritySets2] = useState<SecuritySet[]>(defaultSecuritySets());
  const [sizeOptions2, setSizeOptions2] = useState<Record<number, string[]>>({});
  const [assetSearchResults2, setAssetSearchResults2] = useState<string[]>([]);
  const [showAssetDropdown2, setShowAssetDropdown2] = useState<Record<number, boolean>>({});

  // Shop 3
  const [shop3, setShop3] = useState<ShopState>({ noMcs: false, shopCode: "", shopName: "", startDate: "", endDate: "", q7b7: "", focus: "", searchResults: [], showDropdown: false });
  const [assets3, setAssets3] = useState<AssetRow[]>([{ id: assetIdCounter3.current++, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }]);
  const [securitySets3, setSecuritySets3] = useState<SecuritySet[]>(defaultSecuritySets());
  const [sizeOptions3, setSizeOptions3] = useState<Record<number, string[]>>({});
  const [assetSearchResults3, setAssetSearchResults3] = useState<string[]>([]);
  const [showAssetDropdown3, setShowAssetDropdown3] = useState<Record<number, boolean>>({});

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/vendor/list").then(r => r.json()).then(j => {
      if (j.success) setVendors((j.vendors || []).filter((v: string) => v && v.trim() !== "" && v !== "-"));
    });
  }, []);

  useEffect(() => {
    if (!editIdFromUrl || dataLoaded) return;
    setLoading(true);
    fetch(`/api/document/${editIdFromUrl}`).then(r => r.json()).then(async json => {
      if (json.success) {
        const doc = json.document;
        setDocStatus(doc.status || "");
        setFormData({ docNumber: doc.docCode, fullName: doc.fullName || "", company: doc.company || "", phone: doc.phone || "" });
        const shops = doc.shops || [];
        
        if (shops[0]) {
          const s = shops[0];
          setShop1({ noMcs: !s.shopCode, shopCode: s.shopCode || "", shopName: s.shopName || "", startDate: s.startInstallDate ? new Date(s.startInstallDate).toISOString().split('T')[0] : "", endDate: s.endInstallDate ? new Date(s.endInstallDate).toISOString().split('T')[0] : "", q7b7: s.q7b7 || "", focus: s.shopFocus || "", searchResults: [], showDropdown: false });
          if (s.assets?.length) {
            const loadedAssets = s.assets.map((a: any) => {
              const sizeStr = a.size || ""; const customMatch = sizeStr.match(/^([^*]*)\*([^*]*)\*([^(]*)\(([^)]*)\)$/); const isCustom = isCustomSizeAsset(a.name || "") && customMatch;
              return { id: assetIdCounter1.current++, name: a.name || "", size: sizeStr, kv: a.kv || "", qty: a.qty || 1, withdrawFor: a.withdrawFor || "", autoWarehouse: !!a.withdrawFor, useCustomSize: isCustom, customW: isCustom ? customMatch[1] : undefined, customD: isCustom ? customMatch[2] : undefined, customH: isCustom ? customMatch[3] : undefined, customXX: isCustom ? customMatch[4] : undefined };
            });
            setAssets1(loadedAssets);
            loadedAssets.forEach(async (asset: any) => { if (asset.name) { try { const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(asset.name)}`); const sizeJson = await res.json(); setSizeOptions1(p => ({ ...p, [asset.id]: sizeJson.sizes || [] })); } catch (err) { console.error(err); } } });
          }
          if (s.securitySets?.length) setSecuritySets1(defaultSecuritySets().map(def => { const f = s.securitySets.find((x: any) => x.name === def.name); return f ? { ...def, qty: f.qty || 0, withdrawFor: f.withdrawFor || "" } : def; }));
        }

        if (shops[1]) {
          const s = shops[1];
          setShop2({ noMcs: !s.shopCode, shopCode: s.shopCode || "", shopName: s.shopName || "", startDate: s.startInstallDate ? new Date(s.startInstallDate).toISOString().split('T')[0] : "", endDate: s.endInstallDate ? new Date(s.endInstallDate).toISOString().split('T')[0] : "", q7b7: s.q7b7 || "", focus: s.shopFocus || "", searchResults: [], showDropdown: false });
          if (s.assets?.length) {
            const loadedAssets = s.assets.map((a: any) => {
              const sizeStr = a.size || ""; const customMatch = sizeStr.match(/^([^*]*)\*([^*]*)\*([^(]*)\(([^)]*)\)$/); const isCustom = isCustomSizeAsset(a.name || "") && customMatch;
              return { id: assetIdCounter2.current++, name: a.name || "", size: sizeStr, kv: a.kv || "", qty: a.qty || 1, withdrawFor: a.withdrawFor || "", autoWarehouse: !!a.withdrawFor, useCustomSize: isCustom, customW: isCustom ? customMatch[1] : undefined, customD: isCustom ? customMatch[2] : undefined, customH: isCustom ? customMatch[3] : undefined, customXX: isCustom ? customMatch[4] : undefined };
            });
            setAssets2(loadedAssets);
            loadedAssets.forEach(async (asset: any) => { if (asset.name) { try { const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(asset.name)}`); const sizeJson = await res.json(); setSizeOptions2(p => ({ ...p, [asset.id]: sizeJson.sizes || [] })); } catch (err) { console.error(err); } } });
          }
          if (s.securitySets?.length) setSecuritySets2(defaultSecuritySets().map(def => { const f = s.securitySets.find((x: any) => x.name === def.name); return f ? { ...def, qty: f.qty || 0, withdrawFor: f.withdrawFor || "" } : def; }));
        }

        if (shops[2]) {
          const s = shops[2];
          setShop3({ noMcs: !s.shopCode, shopCode: s.shopCode || "", shopName: s.shopName || "", startDate: s.startInstallDate ? new Date(s.startInstallDate).toISOString().split('T')[0] : "", endDate: s.endInstallDate ? new Date(s.endInstallDate).toISOString().split('T')[0] : "", q7b7: s.q7b7 || "", focus: s.shopFocus || "", searchResults: [], showDropdown: false });
          if (s.assets?.length) {
            const loadedAssets = s.assets.map((a: any) => {
              const sizeStr = a.size || ""; const customMatch = sizeStr.match(/^([^*]*)\*([^*]*)\*([^(]*)\(([^)]*)\)$/); const isCustom = isCustomSizeAsset(a.name || "") && customMatch;
              return { id: assetIdCounter3.current++, name: a.name || "", size: sizeStr, kv: a.kv || "", qty: a.qty || 1, withdrawFor: a.withdrawFor || "", autoWarehouse: !!a.withdrawFor, useCustomSize: isCustom, customW: isCustom ? customMatch[1] : undefined, customD: isCustom ? customMatch[2] : undefined, customH: isCustom ? customMatch[3] : undefined, customXX: isCustom ? customMatch[4] : undefined };
            });
            setAssets3(loadedAssets);
            loadedAssets.forEach(async (asset: any) => { if (asset.name) { try { const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(asset.name)}`); const sizeJson = await res.json(); setSizeOptions3(p => ({ ...p, [asset.id]: sizeJson.sizes || [] })); } catch (err) { console.error(err); } } });
          }
          if (s.securitySets?.length) setSecuritySets3(defaultSecuritySets().map(def => { const f = s.securitySets.find((x: any) => x.name === def.name); return f ? { ...def, qty: f.qty || 0, withdrawFor: f.withdrawFor || "" } : def; }));
        }

        setNote(doc.note || "");
      }
      setDataLoaded(true);
    }).finally(() => setLoading(false));
  }, [editIdFromUrl, dataLoaded]);

  useEffect(() => {
    if (isEdit || dataLoaded || !data?.user) return;
    setLoading(true);
    getMe(data.user.email ?? "").then(me => {
      const { user } = me;
      fetch("/api/document/generate").then(r => r.json()).then(json => {
        setFormData({ docNumber: json.docCode || "", fullName: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(), company: user?.company || "", phone: user?.phone || "" });
      });
    }).finally(() => setLoading(false));
  }, [data, isEdit, dataLoaded]);

  const fetchShops = useCallback(async (query: string, shopNum: 1 | 2 | 3) => {
    if (query.length < 2) { if (shopNum === 1) setShop1(p => ({ ...p, searchResults: [], showDropdown: false })); else if (shopNum === 2) setShop2(p => ({ ...p, searchResults: [], showDropdown: false })); else setShop3(p => ({ ...p, searchResults: [], showDropdown: false })); return; }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const res = await fetch(`/api/shop/search?query=${encodeURIComponent(query)}&status=OPEN`, { signal: controller.signal });
      const json = await res.json();
      const list: ShopItem[] = Array.isArray(json?.shops) ? json.shops : [];
      const filtered = list.filter(s => s.mcsCode?.toLowerCase().includes(query.toLowerCase()));
      if (shopNum === 1) setShop1(p => ({ ...p, searchResults: filtered, showDropdown: filtered.length > 0 }));
      else if (shopNum === 2) setShop2(p => ({ ...p, searchResults: filtered, showDropdown: filtered.length > 0 }));
      else setShop3(p => ({ ...p, searchResults: filtered, showDropdown: filtered.length > 0 }));
    } catch (err) { if ((err as any)?.name !== "AbortError") console.error(err); }
  }, []);

  const debouncedShopSearch1 = useMemo(() => debounce((q: string) => fetchShops(q, 1), 300), [fetchShops]);
  const debouncedShopSearch2 = useMemo(() => debounce((q: string) => fetchShops(q, 2), 300), [fetchShops]);
  const debouncedShopSearch3 = useMemo(() => debounce((q: string) => fetchShops(q, 3), 300), [fetchShops]);

  const fetchAssets = async (query: string, shopNum: 1 | 2 | 3, rowId: number) => {
    if (!query || query.length < 2) { if (shopNum === 1) { setAssetSearchResults1([]); setShowAssetDropdown1(p => ({ ...p, [rowId]: false })); } else if (shopNum === 2) { setAssetSearchResults2([]); setShowAssetDropdown2(p => ({ ...p, [rowId]: false })); } else { setAssetSearchResults3([]); setShowAssetDropdown3(p => ({ ...p, [rowId]: false })); } return; }
    try {
      const res = await fetch(`/api/asset/search?query=${encodeURIComponent(query)}`);
      const json = await res.json();
      const names = json.assets?.map((a: any) => a.assetName).filter(Boolean) ?? [];
      if (shopNum === 1) { setAssetSearchResults1(names); setShowAssetDropdown1(p => ({ ...p, [rowId]: true })); }
      else if (shopNum === 2) { setAssetSearchResults2(names); setShowAssetDropdown2(p => ({ ...p, [rowId]: true })); }
      else { setAssetSearchResults3(names); setShowAssetDropdown3(p => ({ ...p, [rowId]: true })); }
    } catch (err) { console.error(err); }
  };

  const debouncedAssetSearch1 = useMemo(() => debounce((q: string, id: number) => fetchAssets(q, 1, id), 300), []);
  const debouncedAssetSearch2 = useMemo(() => debounce((q: string, id: number) => fetchAssets(q, 2, id), 300), []);
  const debouncedAssetSearch3 = useMemo(() => debounce((q: string, id: number) => fetchAssets(q, 3, id), 300), []);

  const fetchSizes = async (name: string, shopNum: 1 | 2 | 3, rowId: number) => {
    try {
      const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(name)}`);
      const json = await res.json();
      if (shopNum === 1) setSizeOptions1(p => ({ ...p, [rowId]: json.sizes || [] }));
      else if (shopNum === 2) setSizeOptions2(p => ({ ...p, [rowId]: json.sizes || [] }));
      else setSizeOptions3(p => ({ ...p, [rowId]: json.sizes || [] }));
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (action: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const shopsPayload = [
        { shopCode: shop1.shopCode, shopName: shop1.shopName, startInstallDate: shop1.startDate, endInstallDate: shop1.endDate, q7b7: shop1.q7b7, shopFocus: shop1.focus, assets: assets1.map(a => ({ name: a.name, size: a.size, kv: a.kv, qty: a.qty, withdrawFor: a.withdrawFor })), securitySets: securitySets1.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor })) },
        { shopCode: shop2.shopCode, shopName: shop2.shopName, startInstallDate: shop2.startDate, endInstallDate: shop2.endDate, q7b7: shop2.q7b7, shopFocus: shop2.focus, assets: assets2.map(a => ({ name: a.name, size: a.size, kv: a.kv, qty: a.qty, withdrawFor: a.withdrawFor })), securitySets: securitySets2.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor })) },
        { shopCode: shop3.shopCode, shopName: shop3.shopName, startInstallDate: shop3.startDate, endInstallDate: shop3.endDate, q7b7: shop3.q7b7, shopFocus: shop3.focus, assets: assets3.map(a => ({ name: a.name, size: a.size, kv: a.kv, qty: a.qty, withdrawFor: a.withdrawFor })), securitySets: securitySets3.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor })) },
      ];

      // ✅ Admin ต้องเลือกโกดังครบทุก Asset ก่อนอนุมัติ
      if (action === "approve" && mode === "admin") {
        const allAssets = [...assets1, ...assets2, ...assets3];
        const missingWarehouse = allAssets.some(a => !a.withdrawFor || a.withdrawFor.trim() === "");
        if (missingWarehouse) {
          toast.error("กรุณาเลือกโกดังให้ครบทุกรายการก่อนอนุมัติ");
          return;
        }
      }

      if (action === "approve" && editId) {
        const updatePayload = { documentType: "routing3shops", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "submitted", shops: shopsPayload };
        const updateRes = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatePayload) });
        const updateR = await updateRes.json();
        if (!updateR.success) throw new Error(updateR.message);
        const res = await fetch("/api/document/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: parseInt(editId), otherActivity }) });
        const r = await res.json();
        if (!r.success) throw new Error(r.message);
        toast.success("อนุมัติสำเร็จ!"); router.push("/dashboard/admin-list"); return;
      }
      if (action === "reject" && editId) {
        const res = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected", note }) });
        const r = await res.json();
        if (!r.success) throw new Error(r.message);
        toast.success("ปฏิเสธสำเร็จ!"); router.push("/dashboard/admin-list"); return;
      }

      const payload = { documentType: "routing3shops", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "submitted", shops: shopsPayload };
      const res = await fetch(isEdit ? `/api/document/update/${editId}` : "/api/document/create", { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const r = await res.json();
      if (!r.success) throw new Error(r.message);
      toast.success(isEdit ? "แก้ไขสำเร็จ!" : "บันทึกสำเร็จ!");
      router.push(mode === "admin" ? "/dashboard/admin-list" : "/dashboard/user-list");
    } catch (e) { toast.error("เกิดข้อผิดพลาด"); console.error(e); }
    finally { setIsSubmitting(false); }
  };

  if (loading && isEdit) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const isReadOnly = docStatus === "approved" || docStatus === "rejected";

  const renderShopCard = (shopNum: 1 | 2 | 3) => {
    const shop = shopNum === 1 ? shop1 : shopNum === 2 ? shop2 : shop3;
    const setShop = shopNum === 1 ? setShop1 : shopNum === 2 ? setShop2 : setShop3;
    const debouncedSearch = shopNum === 1 ? debouncedShopSearch1 : shopNum === 2 ? debouncedShopSearch2 : debouncedShopSearch3;

    return (
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className={`icon-container ${shopNum === 1 ? 'green' : shopNum === 2 ? 'orange' : 'blue'} !w-8 !h-8`}><Store className="w-4 h-4" /></div>
          <h2 className="font-semibold">ข้อมูล Shop ที่ {shopNum}</h2>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={shop.noMcs} onCheckedChange={(c) => setShop(p => ({ ...p, noMcs: !!c, shopCode: "", shopName: "" }))} /><span className="text-sm font-medium">NO MCS</span></label>
            <div className="flex-1 relative">
              <label className="block text-xs text-muted-foreground mb-1">MCS Code</label>
              <Input value={shop.shopCode} onChange={(e) => { setShop(p => ({ ...p, shopCode: e.target.value })); debouncedSearch(e.target.value); }} onFocus={() => shop.searchResults.length > 0 && setShop(p => ({ ...p, showDropdown: true }))} onBlur={() => setTimeout(() => setShop(p => ({ ...p, showDropdown: false })), 200)} disabled={shop.noMcs} placeholder="พิมพ์ MCS Code..." className="glass-input" />
              {shop.showDropdown && shop.searchResults.length > 0 && (<div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">{shop.searchResults.map(s => (<div key={s.mcsCode} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => setShop(p => ({ ...p, shopCode: s.mcsCode, shopName: s.shopName, showDropdown: false }))}><span className="text-primary font-medium">{s.mcsCode}</span> - {s.shopName}</div>))}</div>)}
            </div>
            <div className="flex-[2]"><label className="block text-xs text-muted-foreground mb-1">Shop Name <span className="text-red-500">*</span></label><Input value={shop.shopName} onChange={(e) => setShop(p => ({ ...p, shopName: e.target.value }))} disabled={!shop.noMcs} placeholder="ชื่อ Shop" className="glass-input" /></div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label className="block text-xs text-muted-foreground mb-1">วันที่เริ่มติดตั้ง <span className="text-red-500">*</span></label><Input type="date" value={shop.startDate} onChange={(e) => setShop(p => ({ ...p, startDate: e.target.value }))} className="glass-input" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">วันที่ติดตั้งเสร็จ <span className="text-red-500">*</span></label><Input type="date" value={shop.endDate} onChange={(e) => setShop(p => ({ ...p, endDate: e.target.value }))} className="glass-input" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Q7B7 <span className="text-red-500">*</span></label><Select value={shop.q7b7} onValueChange={(v) => setShop(p => ({ ...p, q7b7: v }))}><SelectTrigger className="glass-input"><SelectValue placeholder="Yes / No" /></SelectTrigger><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent></Select></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Shop Focus <span className="text-red-500">*</span></label><Select value={shop.focus} onValueChange={(v) => setShop(p => ({ ...p, focus: v }))}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือกกลุ่ม" /></SelectTrigger><SelectContent><SelectItem value="1. Flagship">1. Flagship</SelectItem><SelectItem value="2. A Series (High to Flagship) 10K+">2. A Series (High to Flagship) 10K+</SelectItem><SelectItem value="3. A Series (Mid to High) 7-10K">3. A Series (Mid to High) 7-10K</SelectItem><SelectItem value="4. A Series (Mass) ~7K">4. A Series (Mass) ~7K</SelectItem><SelectItem value="5. A Series (Entry) < 5K">5. A Series (Entry) &lt; 5K</SelectItem></SelectContent></Select></div>
          </div>
        </div>
      </div>
    );
  };

  const renderAssetCard = (shopNum: 1 | 2 | 3) => {
    const assets = shopNum === 1 ? assets1 : shopNum === 2 ? assets2 : assets3;
    const setAssets = shopNum === 1 ? setAssets1 : shopNum === 2 ? setAssets2 : setAssets3;
    const sizeOptions = shopNum === 1 ? sizeOptions1 : shopNum === 2 ? sizeOptions2 : sizeOptions3;
    const assetSearchResults = shopNum === 1 ? assetSearchResults1 : shopNum === 2 ? assetSearchResults2 : assetSearchResults3;
    const showAssetDropdown = shopNum === 1 ? showAssetDropdown1 : shopNum === 2 ? showAssetDropdown2 : showAssetDropdown3;
    const setShowAssetDropdown = shopNum === 1 ? setShowAssetDropdown1 : shopNum === 2 ? setShowAssetDropdown2 : setShowAssetDropdown3;
    const debouncedAssetSearch = shopNum === 1 ? debouncedAssetSearch1 : shopNum === 2 ? debouncedAssetSearch2 : debouncedAssetSearch3;
    const assetIdCounter = shopNum === 1 ? assetIdCounter1 : shopNum === 2 ? assetIdCounter2 : assetIdCounter3;

    return (
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><div className="icon-container purple !w-8 !h-8"><Package className="w-4 h-4" /></div><h2 className="font-semibold">Asset Shop ที่ {shopNum}</h2><span className="text-xs text-muted-foreground">({assets.length}/6)</span></div>
          {assets.length < 6 && <button onClick={() => setAssets([...assets, { id: assetIdCounter.current++, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }])} className="glass-button px-3 py-2 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />เพิ่ม</button>}
        </div>
        <div className="space-y-3">
          {assets.map((asset) => (
            <div key={asset.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4 relative">
                  <label className="block text-xs text-muted-foreground mb-1">Asset Name <span className="text-red-500">*</span></label>
                  <Input value={asset.name} onChange={(e) => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, name: e.target.value } : a)); debouncedAssetSearch(e.target.value, asset.id); }} onFocus={() => assetSearchResults.length > 0 && setShowAssetDropdown(p => ({ ...p, [asset.id]: true }))} onBlur={() => setTimeout(() => setShowAssetDropdown(p => ({ ...p, [asset.id]: false })), 200)} placeholder="พิมพ์ชื่อ Asset..." className="glass-input" />
                  {showAssetDropdown[asset.id] && assetSearchResults.length > 0 && (<div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">{assetSearchResults.map(name => (<div key={name} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => { setAssets(p => p.map(a => a.id === asset.id ? { ...a, name } : a)); fetchSizes(name, shopNum, asset.id); setShowAssetDropdown(p => ({ ...p, [asset.id]: false })); }}>{name}</div>))}</div>)}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Size</label>
                  <Select value={asset.useCustomSize ? "ไม่มีsize" : asset.size} onValueChange={(v) => { if (v === "ไม่มีsize") { setAssets(p => p.map(a => a.id === asset.id ? { ...a, size: "", useCustomSize: true, customW: "", customD: "", customH: "", customXX: "" } : a)); } else { setAssets(p => p.map(a => a.id === asset.id ? { ...a, size: v, useCustomSize: false, customW: undefined, customD: undefined, customH: undefined, customXX: undefined } : a)); } }}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger><SelectContent>{(sizeOptions[asset.id] || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                </div>
                {asset.useCustomSize && isCustomSizeAsset(asset.name) && (
                  <div className="sm:col-span-12 mt-2"><div className="p-3 rounded-lg bg-amber-50 border border-amber-200"><label className="block text-xs text-amber-700 font-medium mb-2">กรอกขนาด (W*D*H(XX))</label><div className="grid grid-cols-4 gap-2"><div><label className="block text-xs text-muted-foreground mb-1">W</label><Input value={asset.customW || ""} onChange={(e) => { const newW = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customW: newW, size: `${newW}*${a.customD || ""}*${a.customH || ""}(${a.customXX || ""})` })); }} placeholder="W" className="glass-input text-center" /></div><div><label className="block text-xs text-muted-foreground mb-1">D</label><Input value={asset.customD || ""} onChange={(e) => { const newD = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customD: newD, size: `${a.customW || ""}*${newD}*${a.customH || ""}(${a.customXX || ""})` })); }} placeholder="D" className="glass-input text-center" /></div><div><label className="block text-xs text-muted-foreground mb-1">H</label><Input value={asset.customH || ""} onChange={(e) => { const newH = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customH: newH, size: `${a.customW || ""}*${a.customD || ""}*${newH}(${a.customXX || ""})` })); }} placeholder="H" className="glass-input text-center" /></div><div><label className="block text-xs text-muted-foreground mb-1">XX</label><Input value={asset.customXX || ""} onChange={(e) => { const newXX = e.target.value; setAssets(p => p.map(a => a.id !== asset.id ? a : { ...a, customXX: newXX, size: `${a.customW || ""}*${a.customD || ""}*${a.customH || ""}(${newXX})` })); }} placeholder="XX" className="glass-input text-center" /></div></div>{asset.customW && asset.customD && asset.customH && (<p className="text-xs text-amber-600 mt-2">ขนาด: <span className="font-medium">{asset.customW}*{asset.customD}*{asset.customH}({asset.customXX || ""})</span></p>)}</div></div>
                )}
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">KV</label><Input value={asset.kv} onChange={(e) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, kv: e.target.value } : a))} placeholder="KV" className="glass-input text-center" /></div>
                <div className="sm:col-span-1"><label className="block text-xs text-muted-foreground mb-1">จำนวน</label><Input type="number" min={1} value={asset.qty} onChange={(e) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, qty: Math.max(1, +e.target.value) } : a))} className="glass-input text-center" /></div>
                {mode === "admin" && (<div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">โกดัง</label><Select value={asset.withdrawFor} onValueChange={(v) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, withdrawFor: v } : a))}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger><SelectContent>{vendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>)}
                {assets.length > 1 && (<div className="flex items-end"><button onClick={() => setAssets(p => p.filter(a => a.id !== asset.id))} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 className="w-4 h-4" /></button></div>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSecuritySetCard = (shopNum: 1 | 2 | 3) => {
    const securitySets = shopNum === 1 ? securitySets1 : shopNum === 2 ? securitySets2 : securitySets3;
    const setSecuritySets = shopNum === 1 ? setSecuritySets1 : shopNum === 2 ? setSecuritySets2 : setSecuritySets3;

    return (
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container red !w-8 !h-8"><Shield className="w-4 h-4" /></div><h2 className="font-semibold">Security Set Shop ที่ {shopNum}</h2></div>
        <div className="space-y-3">
          {securitySets.map(set => (
            <div key={set.id} className="p-4 rounded-xl bg-black/2 border border-black/5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6"><label className="block text-xs text-muted-foreground mb-1">ชื่อ Security</label><Input value={set.name} readOnly className="glass-input bg-black/5" /></div>
              <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">จำนวน</label><Input type="number" min={0} value={set.qty} onChange={(e) => { const newQty = Math.max(0, +e.target.value); const defaultVendor = vendors.find(v => v === "NEWLOOK") || vendors[0] || ""; setSecuritySets(p => p.map(s => s.id === set.id ? { ...s, qty: newQty, withdrawFor: newQty > 0 && !s.withdrawFor && defaultVendor ? defaultVendor : (newQty === 0 ? "" : s.withdrawFor) } : s)); }} className="glass-input text-center" /></div>
              {mode === "admin" && (<div className="sm:col-span-4"><label className="block text-xs text-muted-foreground mb-1">โกดัง</label><Select value={set.withdrawFor} onValueChange={(v) => setSecuritySets(p => p.map(s => s.id === set.id ? { ...s, withdrawFor: v } : s))}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger><SelectContent>{vendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {isReadOnly && (<div className="glass-card p-4 border-l-4 border-amber-500 bg-amber-50/50"><div className="flex items-center gap-2"><span className="text-amber-600 text-lg">⚠️</span><p className="text-amber-800 font-medium">เอกสารนี้ได้รับการอนุมัติแล้ว ไม่สามารถแก้ไขได้</p></div></div>)}
      <div className="flex items-center gap-2"><div className="icon-container blue !w-10 !h-10"><Route className="w-5 h-5" /></div><div><h1 className="text-xl sm:text-2xl font-semibold">{isEdit ? "แก้ไข" : "ใบเบิก"} Routing 3 Shops</h1><p className="text-sm text-muted-foreground">เลขที่ {formData.docNumber || "รอสร้าง"}</p></div></div>
      <div className="glass-card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><div className="icon-container blue !w-8 !h-8"><User className="w-4 h-4" /></div><h2 className="font-semibold">ข้อมูลผู้เบิก</h2></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><div><label className="block text-xs text-muted-foreground mb-1">เลขที่</label><Input value={formData.docNumber} readOnly className="glass-input bg-black/5" /></div><div><label className="block text-xs text-muted-foreground mb-1">ชื่อ</label><Input value={formData.fullName} readOnly className="glass-input bg-black/5" /></div><div><label className="block text-xs text-muted-foreground mb-1">บริษัท</label><Input value={formData.company} readOnly className="glass-input bg-black/5" /></div><div><label className="block text-xs text-muted-foreground mb-1">เบอร์โทร</label><Input value={formData.phone} readOnly className="glass-input bg-black/5" /></div></div></div>

      {renderShopCard(1)}
      {renderAssetCard(1)}
      {renderSecuritySetCard(1)}

      {renderShopCard(2)}
      {renderAssetCard(2)}
      {renderSecuritySetCard(2)}

      {renderShopCard(3)}
      {renderAssetCard(3)}
      {renderSecuritySetCard(3)}

      <div className="glass-card p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><div className="icon-container gray !w-8 !h-8"><FileText className="w-4 h-4" /></div><h2 className="font-semibold">หมายเหตุ</h2></div><Input placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} className="glass-input" /></div>
      {mode === "admin" && <OtherActivitiesSelect value={otherActivity} onChange={setOtherActivity} />}
      {mode === "admin" && <StatusSelect value={transactionStatus} onChange={setTransactionStatus} />}
      {!isReadOnly && (<div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">{mode === "admin" ? (<><button disabled={isSubmitting} onClick={() => handleSubmit("approve")} className="gradient-button px-8 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"><CheckCircle className="w-4 h-4" />{isSubmitting ? "กำลังดำเนินการ..." : "อนุมัติ"}</button><button disabled={isSubmitting} onClick={() => handleSubmit("reject")} className="px-8 py-3 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600 disabled:opacity-50"><XCircle className="w-4 h-4" />ปฏิเสธ</button></>) : (<button disabled={isSubmitting} onClick={() => handleSubmit("save")} className="gradient-button px-10 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" />{isSubmitting ? "กำลังบันทึก..." : (isEdit ? "บันทึกการแก้ไข" : "บันทึก")}</button>)}</div>)}
    </div>
  );
};

export default FormRouting3Shops;