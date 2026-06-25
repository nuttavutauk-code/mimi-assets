"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import debounce from "lodash.debounce";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getMe } from "./loader";
import { Plus, Trash2, User, Store, Package, Shield, FileText, Save, CheckCircle, XCircle, Loader2, Route, X } from "lucide-react";
import { toast } from "sonner";
import OtherActivitiesSelect, { OtherActivity } from "@/components/ui/admin/OtherActivitiesSelect";
import StatusSelect, { StatusOption } from "@/components/ui/admin/StatusSelect";
import PreviewApproveModal from "@/components/ui/PreviewApproveModal";
import BarcodeAssignSelector from "@/components/ui/admin/BarcodeAssignSelector";

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
  isSelected?: boolean;
};
type SecuritySet = { id: number; name: string; qty: number; withdrawFor: string };

const isCustomSizeAsset = (name: string) => {
  const lowerName = name.toLowerCase().replace(/\s+/g, '');
  return lowerName.includes("lightbox") || lowerName.includes("accwall") || lowerName.includes("wallkv-low") || lowerName.includes("wallkv - low");
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
  { id: 2, name: "CONTROLBOX 5 PORT (M-50000R) with power cable", qty: 0, withdrawFor: "" },
  { id: 3, name: "Security Type C Ver.7.1", qty: 0, withdrawFor: "" },
  { id: 4, name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
];

const FormRouting2Shops = ({ mode = "user" }: { mode?: FormMode }) => {
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

  const [formData, setFormData] = useState({ docNumber: "", fullName: "", company: "", phone: "" });
  const [vendors, setVendors] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [otherActivity, setOtherActivity] = useState<OtherActivity>("");
  const [transactionStatus, setTransactionStatus] = useState<StatusOption>("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [userVendor, setUserVendor] = useState("");
  const [previewShopIndex, setPreviewShopIndex] = useState(0);
  const [assetBarcodes1, setAssetBarcodes1] = useState<Record<number, string[]>>({});
  const [securityBarcodes1, setSecurityBarcodes1] = useState<Record<number, string[]>>({});
  const [assetBarcodes2, setAssetBarcodes2] = useState<Record<number, string[]>>({});
  const [securityBarcodes2, setSecurityBarcodes2] = useState<Record<number, string[]>>({});

  // Shop 1
  const [shop1, setShop1] = useState<ShopState>({
    noMcs: false, shopCode: "", shopName: "", startDate: "", endDate: "", q7b7: "", focus: "",
    searchResults: [], showDropdown: false,
  });
  const [assets1, setAssets1] = useState<AssetRow[]>([{ id: assetIdCounter1.current++, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }]);
  const [securitySets1, setSecuritySets1] = useState<SecuritySet[]>(defaultSecuritySets());
  const [sizeOptions1, setSizeOptions1] = useState<Record<number, string[]>>({});
  const [assetSearchResults1, setAssetSearchResults1] = useState<string[]>([]);
  const [showAssetDropdown1, setShowAssetDropdown1] = useState<Record<number, boolean>>({});

  // Shop 2
  const [shop2, setShop2] = useState<ShopState>({
    noMcs: false, shopCode: "", shopName: "", startDate: "", endDate: "", q7b7: "", focus: "",
    searchResults: [], showDropdown: false,
  });
  const [assets2, setAssets2] = useState<AssetRow[]>([{ id: assetIdCounter2.current++, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }]);
  const [securitySets2, setSecuritySets2] = useState<SecuritySet[]>(defaultSecuritySets());
  const [sizeOptions2, setSizeOptions2] = useState<Record<number, string[]>>({});
  const [assetSearchResults2, setAssetSearchResults2] = useState<string[]>([]);
  const [showAssetDropdown2, setShowAssetDropdown2] = useState<Record<number, boolean>>({});

  const abortRef = useRef<AbortController | null>(null);

  // Fetch vendors
  useEffect(() => {
    fetch("/api/vendor/list").then(r => r.json()).then(j => {
      if (j.success) setVendors((j.vendors || []).filter((v: string) => v && v.trim() !== "" && v !== "-"));
    });
  }, []);

  // Load existing document
  useEffect(() => {
    if (!editIdFromUrl || dataLoaded) return;
    setLoading(true);
    fetch(`/api/document/detail/${editIdFromUrl}`).then(r => r.json()).then(async json => {
      if (json.success) {
        const doc = json.document;
        setDocStatus(doc.status || "");
        setFormData({ docNumber: doc.docCode, fullName: doc.fullName || "", company: doc.company || "", phone: doc.phone || "" });
        setUserVendor(doc.createdBy?.vendor || "");

        const shops = doc.shops || [];
        if (shops[0]) {
          const s = shops[0];
          setShop1({
            noMcs: !s.shopCode, shopCode: s.shopCode || "", shopName: s.shopName || "",
            startDate: s.startInstallDate ? new Date(s.startInstallDate).toISOString().split('T')[0] : "",
            endDate: s.endInstallDate ? new Date(s.endInstallDate).toISOString().split('T')[0] : "",
            q7b7: s.q7b7 || "", focus: s.shopFocus || "", searchResults: [], showDropdown: false,
          });
          if (s.assets?.length) {
            const loadedAssets1 = s.assets.map((a: any) => {
              const sizeStr = a.size || "";
              const customMatch = sizeStr.match(/^([^*]*)\*([^*]*)\*([^(]*)\(([^)]*)\)$/);
              const isCustom = isCustomSizeAsset(a.name || "") && customMatch;
              return {
                id: assetIdCounter1.current++,
                name: a.name || "",
                size: sizeStr,
                kv: a.kv || "",
                qty: a.qty || 1,
                withdrawFor: a.withdrawFor || "",
                autoWarehouse: !!a.withdrawFor,
                useCustomSize: isCustom,
                customW: isCustom ? customMatch[1] : undefined,
                customD: isCustom ? customMatch[2] : undefined,
                customH: isCustom ? customMatch[3] : undefined,
                customXX: isCustom ? customMatch[4] : undefined,
                isSelected: !!(a.name),
              };
            });
            setAssets1(loadedAssets1);
            if (doc.status === "reviewing") {
              const draftB1: Record<number, string[]> = {};
              loadedAssets1.forEach((asset: any, idx: number) => { const raw = s.assets[idx]?.barcode; if (raw) { try { draftB1[asset.id] = JSON.parse(raw); } catch {} } });
              setAssetBarcodes1(draftB1);
            }
            loadedAssets1.forEach(async (asset: any) => {
              if (asset.name) {
                try {
                  const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(asset.name)}`);
                  const sizeJson = await res.json();
                  setSizeOptions1(p => ({ ...p, [asset.id]: sizeJson.sizes || [] }));
                } catch (err) { console.error("Error loading sizes:", err); }
              }
            });
          }
          if (s.securitySets?.length) {
            setSecuritySets1(defaultSecuritySets().map(def => { const f = s.securitySets.find((x: any) => x.name === def.name); return f ? { ...def, qty: f.qty || 0, withdrawFor: f.withdrawFor || "" } : def; }));
            if (doc.status === "reviewing") {
              const draftS1: Record<number, string[]> = {};
              defaultSecuritySets().forEach(def => { const f = s.securitySets.find((x: any) => x.name === def.name); if (f?.barcode) { try { draftS1[def.id] = JSON.parse(f.barcode); } catch {} } });
              setSecurityBarcodes1(draftS1);
            }
          }
        }
        if (shops[1]) {
          const s = shops[1];
          setShop2({
            noMcs: !s.shopCode, shopCode: s.shopCode || "", shopName: s.shopName || "",
            startDate: s.startInstallDate ? new Date(s.startInstallDate).toISOString().split('T')[0] : "",
            endDate: s.endInstallDate ? new Date(s.endInstallDate).toISOString().split('T')[0] : "",
            q7b7: s.q7b7 || "", focus: s.shopFocus || "", searchResults: [], showDropdown: false,
          });
          if (s.assets?.length) {
            const loadedAssets2 = s.assets.map((a: any) => {
              const sizeStr = a.size || "";
              const customMatch = sizeStr.match(/^([^*]*)\*([^*]*)\*([^(]*)\(([^)]*)\)$/);
              const isCustom = isCustomSizeAsset(a.name || "") && customMatch;
              return {
                id: assetIdCounter2.current++,
                name: a.name || "",
                size: sizeStr,
                kv: a.kv || "",
                qty: a.qty || 1,
                withdrawFor: a.withdrawFor || "",
                autoWarehouse: !!a.withdrawFor,
                useCustomSize: isCustom,
                customW: isCustom ? customMatch[1] : undefined,
                customD: isCustom ? customMatch[2] : undefined,
                customH: isCustom ? customMatch[3] : undefined,
                customXX: isCustom ? customMatch[4] : undefined,
                isSelected: !!(a.name),
              };
            });
            setAssets2(loadedAssets2);
            if (doc.status === "reviewing") {
              const draftB2: Record<number, string[]> = {};
              loadedAssets2.forEach((asset: any, idx: number) => { const raw = s.assets[idx]?.barcode; if (raw) { try { draftB2[asset.id] = JSON.parse(raw); } catch {} } });
              setAssetBarcodes2(draftB2);
            }
            loadedAssets2.forEach(async (asset: any) => {
              if (asset.name) {
                try {
                  const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(asset.name)}`);
                  const sizeJson = await res.json();
                  setSizeOptions2(p => ({ ...p, [asset.id]: sizeJson.sizes || [] }));
                } catch (err) { console.error("Error loading sizes:", err); }
              }
            });
          }
          if (s.securitySets?.length) {
            setSecuritySets2(defaultSecuritySets().map(def => { const f = s.securitySets.find((x: any) => x.name === def.name); return f ? { ...def, qty: f.qty || 0, withdrawFor: f.withdrawFor || "" } : def; }));
            if (doc.status === "reviewing") {
              const draftS2: Record<number, string[]> = {};
              defaultSecuritySets().forEach(def => { const f = s.securitySets.find((x: any) => x.name === def.name); if (f?.barcode) { try { draftS2[def.id] = JSON.parse(f.barcode); } catch {} } });
              setSecurityBarcodes2(draftS2);
            }
          }
        }
        setNote(doc.note || "");
      }
      setDataLoaded(true);
    }).finally(() => setLoading(false));
  }, [editIdFromUrl, dataLoaded]);

  // Init new form
  useEffect(() => {
    if (isEdit || dataLoaded || !data?.user) return;
    setLoading(true);
    getMe(data.user.email ?? "").then(me => {
      const { user } = me;
      fetch("/api/document/generate").then(r => r.json()).then(json => {
        setFormData({
          docNumber: json.docCode || "",
          fullName: `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
          company: user?.company || "",
          phone: user?.phone || "",
        });
        setUserVendor(user?.vendor || "");
      });
    }).finally(() => setLoading(false));
  }, [data, isEdit, dataLoaded]);

  // Shop search
  const fetchShops = useCallback(async (query: string, shopNum: 1 | 2) => {
    if (query.length < 2) {
      if (shopNum === 1) setShop1(p => ({ ...p, searchResults: [], showDropdown: false }));
      else setShop2(p => ({ ...p, searchResults: [], showDropdown: false }));
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const res = await fetch(`/api/shop/search?query=${encodeURIComponent(query)}&status=OPEN`, { signal: controller.signal });
      const json = await res.json();
      const list: ShopItem[] = Array.isArray(json?.shops) ? json.shops : [];
      const q = query.toLowerCase();
      const filtered = list.filter(s => s.mcsCode?.toLowerCase().includes(q));
      if (shopNum === 1) setShop1(p => ({ ...p, searchResults: filtered, showDropdown: filtered.length > 0 }));
      else setShop2(p => ({ ...p, searchResults: filtered, showDropdown: filtered.length > 0 }));
    } catch (err) { if ((err as any)?.name !== "AbortError") console.error(err); }
  }, []);

  const debouncedShopSearch1 = useMemo(() => debounce((q: string) => fetchShops(q, 1), 300), [fetchShops]);
  const debouncedShopSearch2 = useMemo(() => debounce((q: string) => fetchShops(q, 2), 300), [fetchShops]);

  // Asset search
  const fetchAssets = async (query: string, shopNum: 1 | 2, rowId: number) => {
    if (!query || query.length < 2) {
      if (shopNum === 1) { setAssetSearchResults1([]); setShowAssetDropdown1(p => ({ ...p, [rowId]: false })); }
      else { setAssetSearchResults2([]); setShowAssetDropdown2(p => ({ ...p, [rowId]: false })); }
      return;
    }
    try {
      const res = await fetch(`/api/asset/search?query=${encodeURIComponent(query)}`);
      const json = await res.json();
      const names = json.assets?.map((a: any) => a.assetName).filter(Boolean) ?? [];
      if (shopNum === 1) { setAssetSearchResults1(names); setShowAssetDropdown1(p => ({ ...p, [rowId]: true })); }
      else { setAssetSearchResults2(names); setShowAssetDropdown2(p => ({ ...p, [rowId]: true })); }
    } catch (err) { console.error(err); }
  };

  const debouncedAssetSearch1 = useMemo(() => debounce((q: string, id: number) => fetchAssets(q, 1, id), 300), []);
  const debouncedAssetSearch2 = useMemo(() => debounce((q: string, id: number) => fetchAssets(q, 2, id), 300), []);

  // Fetch sizes
  const fetchSizes = async (name: string, shopNum: 1 | 2, rowId: number) => {
    try {
      const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(name)}`);
      const json = await res.json();
      if (shopNum === 1) setSizeOptions1(p => ({ ...p, [rowId]: json.sizes || [] }));
      else setSizeOptions2(p => ({ ...p, [rowId]: json.sizes || [] }));
    } catch (err) { console.error(err); }
  };

  const handleOpenPreview = () => {
    const filledSecuritySets1 = securitySets1.filter(s => s.qty > 0);
    const filledSecuritySets2 = securitySets2.filter(s => s.qty > 0);
    if (filledSecuritySets1.length > 3) {
      toast.error("Security Set Shop 1 กรอกได้สูงสุด 3 รายการเท่านั้น");
      return;
    }
    if (filledSecuritySets2.length > 3) {
      toast.error("Security Set Shop 2 กรอกได้สูงสุด 3 รายการเท่านั้น");
      return;
    }

    const allAssets = [...assets1, ...assets2];
    const missingWarehouse = allAssets.some(a => !a.withdrawFor || a.withdrawFor.trim() === "");
    if (missingWarehouse) {
      toast.error("กรุณาเลือกโกดังให้ครบทุกรายการก่อนอนุมัติ");
      return;
    }

    if (mode === "admin") {
      const filledAssets1 = assets1.filter(a => a.name && a.name.trim() !== "");
      const filledAssets2 = assets2.filter(a => a.name && a.name.trim() !== "");
      const check = (label: string, arr: any[], bcMap: Record<number, string[]>) => {
        const m = arr.find(a => {
          const v = bcMap[a.id] || [];
          return v.length !== a.qty || v.some(b => !b || !b.trim());
        });
        return m ? `กรุณาเลือก Barcode ให้ครบทุกรายการ ${label}: ${m.name}` : null;
      };
      const checkSec = (label: string, arr: any[], bcMap: Record<number, string[]>) => {
        const m = arr.filter(s => !s.name.includes("Security Type C")).find(s => {
          const v = bcMap[s.id] || [];
          return v.length !== s.qty || v.some(b => !b || !b.trim());
        });
        return m ? `กรุณาเลือก Barcode ให้ครบทุกรายการ ${label}: ${m.name}` : null;
      };
      const err = check("Shop1 Asset", filledAssets1, assetBarcodes1) || check("Shop2 Asset", filledAssets2, assetBarcodes2)
        || checkSec("Shop1 Security", filledSecuritySets1, securityBarcodes1) || checkSec("Shop2 Security", filledSecuritySets2, securityBarcodes2);
      if (err) { toast.error(err); return; }
    }

    setPreviewShopIndex(0);
    setShowPreviewModal(true);
  };

  const handleConfirmApprove = async () => {
    setShowPreviewModal(false);
    await handleSubmit("approve");
  };

  // Submit
  const handleSubmit = async (action: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const filledSecuritySets1 = securitySets1.filter(s => s.qty > 0);
      const filledSecuritySets2 = securitySets2.filter(s => s.qty > 0);
      if (filledSecuritySets1.length > 3) {
        toast.error("Security Set Shop 1 กรอกได้สูงสุด 3 รายการเท่านั้น");
        setIsSubmitting(false);
        return;
      }
      if (filledSecuritySets2.length > 3) {
        toast.error("Security Set Shop 2 กรอกได้สูงสุด 3 รายการเท่านั้น");
        setIsSubmitting(false);
        return;
      }

      if (action === "approve" && mode === "admin") {
        const allAssets = [...assets1, ...assets2];
        const missingWarehouse = allAssets.some(a => !a.withdrawFor || a.withdrawFor.trim() === "");
        if (missingWarehouse) {
          toast.error("กรุณาเลือกโกดังให้ครบทุกรายการก่อนอนุมัติ");
          setIsSubmitting(false);
          return;
        }
        const filledAssets1 = assets1.filter(a => a.name && a.name.trim() !== "");
        const filledAssets2 = assets2.filter(a => a.name && a.name.trim() !== "");
        const check = (label: string, arr: any[], bcMap: Record<number, string[]>) => {
          const m = arr.find(a => {
            const v = bcMap[a.id] || [];
            return v.length !== a.qty || v.some(b => !b || !b.trim());
          });
          return m ? `กรุณาเลือก Barcode ให้ครบทุกรายการ ${label}: ${m.name}` : null;
        };
        const checkSec = (label: string, arr: any[], bcMap: Record<number, string[]>) => {
          const m = arr.filter(s => !s.name.includes("Security Type C")).find(s => {
            const v = bcMap[s.id] || [];
            return v.length !== s.qty || v.some(b => !b || !b.trim());
          });
          return m ? `กรุณาเลือก Barcode ให้ครบทุกรายการ ${label}: ${m.name}` : null;
        };
        const err = check("Shop1 Asset", filledAssets1, assetBarcodes1) || check("Shop2 Asset", filledAssets2, assetBarcodes2)
          || checkSec("Shop1 Security", filledSecuritySets1, securityBarcodes1) || checkSec("Shop2 Security", filledSecuritySets2, securityBarcodes2);
        if (err) { toast.error(err); setIsSubmitting(false); return; }
      }

      if (action === "approve" && editId) {
        const updatePayload = {
          documentType: "routing2shops",
          docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "submitted",
          shops: [
            {
              shopCode: shop1.shopCode, shopName: shop1.shopName, startInstallDate: shop1.startDate, endInstallDate: shop1.endDate, q7b7: shop1.q7b7, shopFocus: shop1.focus,
              assets: assets1.map(a => ({ name: a.name, size: a.size, kv: a.kv, qty: a.qty, withdrawFor: a.withdrawFor })),
              securitySets: securitySets1.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor })),
            },
            {
              shopCode: shop2.shopCode, shopName: shop2.shopName, startInstallDate: shop2.startDate, endInstallDate: shop2.endDate, q7b7: shop2.q7b7, shopFocus: shop2.focus,
              assets: assets2.map(a => ({ name: a.name, size: a.size, kv: a.kv, qty: a.qty, withdrawFor: a.withdrawFor })),
              securitySets: securitySets2.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor })),
            },
          ],
        };
        const updateRes = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatePayload) });
        const updateR = await updateRes.json();
        if (!updateR.success) throw new Error(updateR.message);
        const filledAssets1Payload = assets1.filter(a => a.name && a.name.trim() !== "");
        const filledAssets2Payload = assets2.filter(a => a.name && a.name.trim() !== "");
        const sec1Payload = securitySets1.filter(s => s.qty > 0);
        const sec2Payload = securitySets2.filter(s => s.qty > 0);
        const assignedBarcodes = {
          assetBarcodes: [
            ...filledAssets1Payload.map((a, idx) => ({ shopIndex: 0, assetIndex: idx, barcodes: (assetBarcodes1[a.id] || []).slice(0, a.qty) })),
            ...filledAssets2Payload.map((a, idx) => ({ shopIndex: 1, assetIndex: idx, barcodes: (assetBarcodes2[a.id] || []).slice(0, a.qty) })),
          ],
          securityBarcodes: [
            ...sec1Payload.map((s, idx) => ({ shopIndex: 0, securityIndex: idx, barcodes: s.name.includes("Security Type C") ? [] : (securityBarcodes1[s.id] || []).slice(0, s.qty) })),
            ...sec2Payload.map((s, idx) => ({ shopIndex: 1, securityIndex: idx, barcodes: s.name.includes("Security Type C") ? [] : (securityBarcodes2[s.id] || []).slice(0, s.qty) })),
          ],
        };
        const res = await fetch("/api/document/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: parseInt(editId), otherActivity, assignedBarcodes }) });
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

      const payload = {
        documentType: "routing2shops",
        docCode: formData.docNumber,
        fullName: formData.fullName,
        company: formData.company,
        phone: formData.phone,
        note,
        status: "submitted",
        shops: [
          {
            shopCode: shop1.shopCode, shopName: shop1.shopName,
            startInstallDate: shop1.startDate, endInstallDate: shop1.endDate,
            q7b7: shop1.q7b7, shopFocus: shop1.focus,
            assets: assets1.map(a => ({ name: a.name, size: a.size, kv: a.kv, qty: a.qty, withdrawFor: a.withdrawFor })),
            securitySets: securitySets1.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor })),
          },
          {
            shopCode: shop2.shopCode, shopName: shop2.shopName,
            startInstallDate: shop2.startDate, endInstallDate: shop2.endDate,
            q7b7: shop2.q7b7, shopFocus: shop2.focus,
            assets: assets2.map(a => ({ name: a.name, size: a.size, kv: a.kv, qty: a.qty, withdrawFor: a.withdrawFor })),
            securitySets: securitySets2.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor })),
          },
        ],
      };

      const res = await fetch(isEdit ? `/api/document/update/${editId}` : "/api/document/create", {
        method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const r = await res.json();
      if (!r.success) throw new Error(r.message);
      toast.success(isEdit ? "แก้ไขสำเร็จ!" : "บันทึกสำเร็จ!");
      router.push(mode === "admin" ? "/dashboard/admin-list" : "/dashboard/user-list");
    } catch (e) { toast.error("เกิดข้อผิดพลาด"); console.error(e); }
    finally { setIsSubmitting(false); }
  };

  const handleDraftSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        documentType: "routing2shops", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "reviewing", transactionStatus: transactionStatus || null,
        shops: [
          { shopCode: shop1.shopCode, shopName: shop1.shopName, startInstallDate: shop1.startDate, endInstallDate: shop1.endDate, q7b7: shop1.q7b7, shopFocus: shop1.focus, assets: assets1.map(a => ({ name: a.name, size: a.size, kv: a.kv, qty: a.qty, withdrawFor: a.withdrawFor, barcode: JSON.stringify(assetBarcodes1[a.id] || []) })), securitySets: securitySets1.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor, barcode: JSON.stringify(s.name.includes("Security Type C") ? [] : (securityBarcodes1[s.id] || [])) })) },
          { shopCode: shop2.shopCode, shopName: shop2.shopName, startInstallDate: shop2.startDate, endInstallDate: shop2.endDate, q7b7: shop2.q7b7, shopFocus: shop2.focus, assets: assets2.map(a => ({ name: a.name, size: a.size, kv: a.kv, qty: a.qty, withdrawFor: a.withdrawFor, barcode: JSON.stringify(assetBarcodes2[a.id] || []) })), securitySets: securitySets2.filter(s => s.qty > 0).map(s => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor, barcode: JSON.stringify(s.name.includes("Security Type C") ? [] : (securityBarcodes2[s.id] || [])) })) },
        ],
      };
      const res = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      toast.success("บันทึก Draft สำเร็จ!");
      setDocStatus("reviewing");
    } catch (err) { console.error(err); toast.error("เกิดข้อผิดพลาดในการบันทึก Draft"); }
    finally { setIsSubmitting(false); }
  };

  if (loading && isEdit) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const isReadOnly = docStatus === "approved" || docStatus === "rejected";

  // Render Shop Card
  const renderShopCard = (shopNum: 1 | 2) => {
    const shop = shopNum === 1 ? shop1 : shop2;
    const setShop = shopNum === 1 ? setShop1 : setShop2;
    const debouncedSearch = shopNum === 1 ? debouncedShopSearch1 : debouncedShopSearch2;

    return (
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className={`icon-container ${shopNum === 1 ? 'green' : 'orange'} !w-8 !h-8`}><Store className="w-4 h-4" /></div>
          <h2 className="font-semibold">ข้อมูล Shop ที่ {shopNum}</h2>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={shop.noMcs} onCheckedChange={(c) => setShop(p => ({ ...p, noMcs: !!c, shopCode: "", shopName: "" }))} />
              <span className="text-sm font-medium">NO MCS</span>
            </label>
            <div className="flex-1 relative">
              <label className="block text-xs text-muted-foreground mb-1">MCS Code</label>
              <Input value={shop.shopCode} onChange={(e) => { setShop(p => ({ ...p, shopCode: e.target.value })); debouncedSearch(e.target.value); }}
                onFocus={() => shop.searchResults.length > 0 && setShop(p => ({ ...p, showDropdown: true }))}
                onBlur={() => setTimeout(() => setShop(p => ({ ...p, showDropdown: false })), 200)}
                disabled={shop.noMcs} placeholder="พิมพ์ MCS Code..." className="glass-input" />
              {shop.showDropdown && shop.searchResults.length > 0 && (
                <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">
                  {shop.searchResults.map(s => (
                    <div key={s.mcsCode} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm"
                      onClick={() => setShop(p => ({ ...p, shopCode: s.mcsCode, shopName: s.shopName, showDropdown: false }))}>
                      <span className="text-primary font-medium">{s.mcsCode}</span> - {s.shopName}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-[2]">
              <label className="block text-xs text-muted-foreground mb-1">Shop Name <span className="text-red-500">*</span></label>
              <Input value={shop.shopName} onChange={(e) => setShop(p => ({ ...p, shopName: e.target.value }))}
                disabled={!shop.noMcs} placeholder="ชื่อ Shop" className="glass-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">วันที่เริ่มติดตั้ง <span className="text-red-500">*</span></label>
              <Input type="date" value={shop.startDate} onChange={(e) => setShop(p => ({ ...p, startDate: e.target.value }))} className="glass-input" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">วันที่ติดตั้งเสร็จ <span className="text-red-500">*</span></label>
              <Input type="date" value={shop.endDate} onChange={(e) => setShop(p => ({ ...p, endDate: e.target.value }))} className="glass-input" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Q7B7 <span className="text-red-500">*</span></label>
              <Select value={shop.q7b7} onValueChange={(v) => setShop(p => ({ ...p, q7b7: v }))}>
                <SelectTrigger className="glass-input"><SelectValue placeholder="Yes / No" /></SelectTrigger>
                <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Shop Focus <span className="text-red-500">*</span></label>
              <Select value={shop.focus} onValueChange={(v) => setShop(p => ({ ...p, focus: v }))}>
                <SelectTrigger className="glass-input"><SelectValue placeholder="เลือกกลุ่ม" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1. Flagship">1. Flagship</SelectItem>
                  <SelectItem value="2. A Series (High to Flagship) 10K+">2. A Series (High to Flagship) 10K+</SelectItem>
                  <SelectItem value="3. A Series (Mid to High) 7-10K">3. A Series (Mid to High) 7-10K</SelectItem>
                  <SelectItem value="4. A Series (Mass) ~7K">4. A Series (Mass) ~7K</SelectItem>
                  <SelectItem value="5. A Series (Entry) < 5K">5. A Series (Entry) &lt; 5K</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Asset Card
  const renderAssetCard = (shopNum: 1 | 2) => {
    const assets = shopNum === 1 ? assets1 : assets2;
    const setAssets = shopNum === 1 ? setAssets1 : setAssets2;
    const sizeOptions = shopNum === 1 ? sizeOptions1 : sizeOptions2;
    const assetSearchResults = shopNum === 1 ? assetSearchResults1 : assetSearchResults2;
    const showAssetDropdown = shopNum === 1 ? showAssetDropdown1 : showAssetDropdown2;
    const setShowAssetDropdown = shopNum === 1 ? setShowAssetDropdown1 : setShowAssetDropdown2;
    const debouncedAssetSearch = shopNum === 1 ? debouncedAssetSearch1 : debouncedAssetSearch2;
    const assetIdCounter = shopNum === 1 ? assetIdCounter1 : assetIdCounter2;
    const assetBarcodes = shopNum === 1 ? assetBarcodes1 : assetBarcodes2;
    const setAssetBarcodes = shopNum === 1 ? setAssetBarcodes1 : setAssetBarcodes2;

    return (
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="icon-container purple !w-8 !h-8"><Package className="w-4 h-4" /></div>
            <h2 className="font-semibold">Asset Shop ที่ {shopNum}</h2>
            <span className="text-xs text-muted-foreground">({assets.length}/9)</span>
          </div>
          {assets.length < 9 && <button onClick={() => setAssets([...assets, { id: assetIdCounter.current++, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }])}
            className="glass-button px-3 py-2 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />เพิ่ม</button>}
        </div>
        <div className="space-y-3">
          {assets.map((asset, idx) => (
            <div key={asset.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4 relative">
                  <label className="block text-xs text-muted-foreground mb-1">Asset Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Input 
                      value={asset.name} 
                      onChange={(e) => { 
                        if (!asset.isSelected) {
                          setAssets(p => p.map(a => a.id === asset.id ? { ...a, name: e.target.value } : a)); 
                          debouncedAssetSearch(e.target.value, asset.id); 
                        }
                      }}
                      onFocus={() => !asset.isSelected && assetSearchResults.length > 0 && setShowAssetDropdown(p => ({ ...p, [asset.id]: true }))}
                      onBlur={() => setTimeout(() => setShowAssetDropdown(p => ({ ...p, [asset.id]: false })), 200)}
                      placeholder="พิมพ์ชื่อ Asset..." 
                      readOnly={asset.isSelected}
                      className={`glass-input ${asset.isSelected ? "pr-10 bg-gray-50" : ""}`} 
                    />
                    {asset.isSelected && (
                      <button 
                        type="button"
                        onClick={() => setAssets(p => p.map(a => a.id === asset.id ? { ...a, name: "", size: "", isSelected: false } : a))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                        title="ล้างเพื่อเลือกใหม่"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {showAssetDropdown[asset.id] && assetSearchResults.length > 0 && !asset.isSelected && (
                    <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">
                      {assetSearchResults.map(name => (
                        <div key={name} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm"
                          onMouseDown={(e) => { e.preventDefault(); setAssets(p => p.map(a => a.id === asset.id ? { ...a, name, isSelected: true } : a)); fetchSizes(name, shopNum, asset.id); setShowAssetDropdown(p => ({ ...p, [asset.id]: false })); }}>
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Size</label>
                  <Select
                    value={asset.useCustomSize ? "ไม่มีsize" : asset.size}
                    onValueChange={(v) => {
                      if (v === "ไม่มีsize") {
                        setAssets(p => p.map(a => a.id === asset.id ? { ...a, size: "", useCustomSize: true, customW: "", customD: "", customH: "", customXX: "" } : a));
                      } else {
                        setAssets(p => p.map(a => a.id === asset.id ? { ...a, size: v, useCustomSize: false, customW: undefined, customD: undefined, customH: undefined, customXX: undefined } : a));
                      }
                    }}
                  >
                    <SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger>
                    <SelectContent>{(sizeOptions[asset.id] || []).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {asset.useCustomSize && isCustomSizeAsset(asset.name) && (
                  <div className="sm:col-span-12 mt-2">
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <label className="block text-xs text-amber-700 font-medium mb-2">กรอกขนาด (W*D*H(XX))</label>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">W</label>
                          <Input
                            value={asset.customW || ""}
                            onChange={(e) => {
                              const newW = e.target.value;
                              setAssets(p => p.map(a => {
                                if (a.id !== asset.id) return a;
                                const customSize = `${newW}*${a.customD || ""}*${a.customH || ""}(${a.customXX || ""})`;
                                return { ...a, customW: newW, size: customSize };
                              }));
                            }}
                            placeholder="W"
                            className="glass-input text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">D</label>
                          <Input
                            value={asset.customD || ""}
                            onChange={(e) => {
                              const newD = e.target.value;
                              setAssets(p => p.map(a => {
                                if (a.id !== asset.id) return a;
                                const customSize = `${a.customW || ""}*${newD}*${a.customH || ""}(${a.customXX || ""})`;
                                return { ...a, customD: newD, size: customSize };
                              }));
                            }}
                            placeholder="D"
                            className="glass-input text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">H</label>
                          <Input
                            value={asset.customH || ""}
                            onChange={(e) => {
                              const newH = e.target.value;
                              setAssets(p => p.map(a => {
                                if (a.id !== asset.id) return a;
                                const customSize = `${a.customW || ""}*${a.customD || ""}*${newH}(${a.customXX || ""})`;
                                return { ...a, customH: newH, size: customSize };
                              }));
                            }}
                            placeholder="H"
                            className="glass-input text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">XX</label>
                          <Input
                            value={asset.customXX || ""}
                            onChange={(e) => {
                              const newXX = e.target.value;
                              setAssets(p => p.map(a => {
                                if (a.id !== asset.id) return a;
                                const customSize = `${a.customW || ""}*${a.customD || ""}*${a.customH || ""}(${newXX})`;
                                return { ...a, customXX: newXX, size: customSize };
                              }));
                            }}
                            placeholder="XX"
                            className="glass-input text-center"
                          />
                        </div>
                      </div>
                      {asset.customW && asset.customD && asset.customH && (
                        <p className="text-xs text-amber-600 mt-2">
                          ขนาด: <span className="font-medium">{asset.customW}*{asset.customD}*{asset.customH}({asset.customXX || ""})</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">KV</label>
                  <Input value={asset.kv} onChange={(e) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, kv: e.target.value } : a))} placeholder="KV" className="glass-input text-center" />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs text-muted-foreground mb-1">จำนวน</label>
                  <Input type="number" min={1} value={asset.qty} onChange={(e) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, qty: Math.max(1, +e.target.value) } : a))} className="glass-input text-center" />
                </div>
                {mode === "admin" && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-muted-foreground mb-1">โกดัง</label>
                    <Select value={asset.withdrawFor} onValueChange={(v) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, withdrawFor: v } : a))}>
                      <SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger>
                      <SelectContent>{vendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {assets.length > 1 && (
                  <div className="flex items-end">
                    <button onClick={() => setAssets(p => p.filter(a => a.id !== asset.id))} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {mode === "admin" && asset.name && (
                <div className="mt-3 p-3 rounded-lg bg-blue-50/40 border border-blue-200">
                  <label className="block text-xs text-blue-700 font-medium mb-2">เลือก Barcode (qty {asset.qty})</label>
                  <BarcodeAssignSelector warehouse={asset.withdrawFor} assetName={asset.name} qty={asset.qty}
                    value={assetBarcodes[asset.id] || []} onChange={(next) => setAssetBarcodes(p => ({ ...p, [asset.id]: next }))} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render Security Set Card
  const renderSecuritySetCard = (shopNum: 1 | 2) => {
    const securitySets = shopNum === 1 ? securitySets1 : securitySets2;
    const setSecuritySets = shopNum === 1 ? setSecuritySets1 : setSecuritySets2;
    const securityBarcodes = shopNum === 1 ? securityBarcodes1 : securityBarcodes2;
    const setSecurityBarcodes = shopNum === 1 ? setSecurityBarcodes1 : setSecurityBarcodes2;
    const otherBarcodes = shopNum === 1 ? securityBarcodes2 : securityBarcodes1;

    return (
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-container red !w-8 !h-8"><Shield className="w-4 h-4" /></div>
          <h2 className="font-semibold">Security Set Shop ที่ {shopNum}</h2>
        </div>
        <div className="space-y-3">
          {securitySets.map(set => (
            <div key={set.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6">
                  <label className="block text-xs text-muted-foreground mb-1">ชื่อ Security</label>
                  <Input value={set.name} readOnly className="glass-input bg-black/5" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">จำนวน</label>
                  <Input type="number" min={0} value={set.qty} onChange={(e) => { const newQty = Math.max(0, +e.target.value); const defaultVendor = vendors.find(v => v === "NEWLOOK") || vendors[0] || ""; setSecuritySets(p => p.map(s => s.id === set.id ? { ...s, qty: newQty, withdrawFor: newQty > 0 && !s.withdrawFor && defaultVendor ? defaultVendor : (newQty === 0 ? "" : s.withdrawFor) } : s)); }} className="glass-input text-center" />
                </div>
                {mode === "admin" && (
                  <div className="sm:col-span-4">
                    <label className="block text-xs text-muted-foreground mb-1">โกดัง</label>
                    <Select value={set.withdrawFor} onValueChange={(v) => setSecuritySets(p => p.map(s => s.id === set.id ? { ...s, withdrawFor: v } : s))}>
                      <SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger>
                      <SelectContent>{vendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {mode === "admin" && set.qty > 0 && !set.name.includes("Security Type C") && (
                <div className="mt-3 p-3 rounded-lg bg-purple-50/40 border border-purple-200">
                  <label className="block text-xs text-purple-700 font-medium mb-2">เลือก Barcode CONTROLBOX (qty {set.qty})</label>
                  <BarcodeAssignSelector warehouse={set.withdrawFor} assetName={set.name} qty={set.qty}
                    value={securityBarcodes[set.id] || []} onChange={(next) => setSecurityBarcodes(p => ({ ...p, [set.id]: next }))} isSecuritySet
                    additionalExclude={(otherBarcodes[set.id] || []).filter(Boolean)} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Prepare shops array for Preview Modal
  const shopsForPreview = [
    { shopCode: shop1.shopCode, shopName: shop1.shopName, startDate: shop1.startDate, endDate: shop1.endDate, q7b7: shop1.q7b7, focus: shop1.focus, assets: assets1, securitySets: securitySets1 },
    { shopCode: shop2.shopCode, shopName: shop2.shopName, startDate: shop2.startDate, endDate: shop2.endDate, q7b7: shop2.q7b7, focus: shop2.focus, assets: assets2, securitySets: securitySets2 },
  ];

  const currentPreviewShop = shopsForPreview[previewShopIndex];

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
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="icon-container blue !w-10 !h-10"><Route className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">{isEdit ? "แก้ไข" : "ใบเบิก"} Routing 2 Shops</h1>
          <p className="text-sm text-muted-foreground">เลขที่ {formData.docNumber || "รอสร้าง"}</p>
        </div>
      </div>

      {/* ข้อมูลผู้เบิก */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-container blue !w-8 !h-8"><User className="w-4 h-4" /></div>
          <h2 className="font-semibold">ข้อมูลผู้เบิก</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="block text-xs text-muted-foreground mb-1">เลขที่</label><Input value={formData.docNumber} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">ชื่อ</label><Input value={formData.fullName} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">บริษัท</label><Input value={formData.company} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">เบอร์โทร</label><Input value={formData.phone} readOnly className="glass-input bg-black/5" /></div>
        </div>
      </div>

      {/* Shop 1 */}
      {renderShopCard(1)}
      {renderAssetCard(1)}
      {renderSecuritySetCard(1)}

      {/* Shop 2 */}
      {renderShopCard(2)}
      {renderAssetCard(2)}
      {renderSecuritySetCard(2)}

      {/* หมายเหตุ */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-container gray !w-8 !h-8"><FileText className="w-4 h-4" /></div>
          <h2 className="font-semibold">หมายเหตุ</h2>
        </div>
        <Input placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} className="glass-input" />
      </div>

      {/* Other Activities (admin only) */}
      {mode === "admin" && <OtherActivitiesSelect value={otherActivity} onChange={setOtherActivity} />}

      {/* Status - Admin only (บังคับเลือก) */}
      {mode === "admin" && <StatusSelect value={transactionStatus} onChange={setTransactionStatus} />}

      {/* Buttons */}
      {!isReadOnly && (
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
          {mode === "admin" ? (
            <>
              <button disabled={isSubmitting} onClick={handleDraftSave} className="px-8 py-3 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-200 text-sm font-medium flex items-center justify-center gap-2 hover:bg-purple-500/20 transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" />{isSubmitting ? "กำลังบันทึก..." : "บันทึก Draft"}
              </button>
              <button disabled={isSubmitting} onClick={handleOpenPreview} className="gradient-button px-8 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                <CheckCircle className="w-4 h-4" />{isSubmitting ? "กำลังดำเนินการ..." : "อนุมัติ"}
              </button>
              <button disabled={isSubmitting} onClick={() => handleSubmit("reject")} className="px-8 py-3 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600 disabled:opacity-50">
                <XCircle className="w-4 h-4" />ปฏิเสธ
              </button>
            </>
          ) : (
            <button disabled={isSubmitting} onClick={() => handleSubmit("save")} className="gradient-button px-10 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />{isSubmitting ? "กำลังบันทึก..." : (isEdit ? "บันทึกการแก้ไข" : "บันทึก")}
            </button>
          )}
        </div>
      )}

      <PreviewApproveModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onConfirm={handleConfirmApprove}
        isSubmitting={isSubmitting}
        documentType="routing2shops"
        documentData={{
          docCode: formData.docNumber,
          fullName: formData.fullName,
          company: formData.company,
          phone: formData.phone,
          note: note,
          vendor: userVendor,
        }}
        shopInfo={{
          shopCode: currentPreviewShop.shopCode,
          shopName: currentPreviewShop.shopName,
          startInstallDate: currentPreviewShop.startDate,
          endInstallDate: currentPreviewShop.endDate,
          q7b7: currentPreviewShop.q7b7,
          shopFocus: currentPreviewShop.focus,
        }}
        assets={currentPreviewShop.assets.filter(a => a.name && a.name.trim() !== "").map(a => ({
          name: a.name,
          size: a.size,
          grade: "",
          kv: a.kv,
          qty: a.qty,
          withdrawFor: a.withdrawFor,
          barcode: "",
          assignedBarcodes: (previewShopIndex === 0 ? assetBarcodes1 : assetBarcodes2)[a.id] || [],
        }))}
        securitySets={currentPreviewShop.securitySets.filter(s => s.qty > 0).map(s => ({
          name: s.name,
          qty: s.qty,
          withdrawFor: s.withdrawFor,
          assignedBarcodes: s.name.includes("Security Type C") ? [] : ((previewShopIndex === 0 ? securityBarcodes1 : securityBarcodes2)[s.id] || []),
        }))}
        shops={shopsForPreview.map(shop => ({
          shopCode: shop.shopCode,
          shopName: shop.shopName,
          startInstallDate: shop.startDate,
          endInstallDate: shop.endDate,
          q7b7: shop.q7b7,
          shopFocus: shop.focus,
          assets: shop.assets.filter(a => a.name && a.name.trim() !== "").map(a => ({
            name: a.name,
            size: a.size,
            grade: "",
            kv: a.kv,
            qty: a.qty,
            withdrawFor: a.withdrawFor,
            barcode: "",
          })),
          securitySets: shop.securitySets.filter(s => s.qty > 0).map(s => ({
            name: s.name,
            qty: s.qty,
            withdrawFor: s.withdrawFor,
          })),
        }))}
      />
    </div>
  );
};

export default FormRouting2Shops;