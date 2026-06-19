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
import { Plus, Trash2, User, Store, Package, FileText, Save, CheckCircle, XCircle, Loader2, RotateCcw, ClipboardList, X, Shield } from "lucide-react";
import { toast } from "sonner";
import OtherActivitiesSelect, { OtherActivity } from "@/components/ui/admin/OtherActivitiesSelect";
import StatusSelect, { StatusOption } from "@/components/ui/admin/StatusSelect";
import PreviewApproveModal from "@/components/ui/PreviewApproveModal";

type ShopItem = { mcsCode: string; shopName: string };
type AssetRow = { id: number; barcode: string; name: string; size: string; grade: string; qty: number; noBarcode?: boolean; isSelected?: boolean };
type ControlboxRow = { id: number; barcode: string; name: string };
type SecurityTypeCRow = { id: number; name: string; qty: number };
type FormMode = "user" | "admin";

interface ShopEntry {
  id: number;
  noMcs: boolean;
  shopCode: string;
  shopName: string;
  returnDate: string;
  assets: AssetRow[];
  controlboxRows: ControlboxRow[];
  securityTypeC: SecurityTypeCRow[];
  searchResults: ShopItem[];
  showDropdown: boolean;
  barcodeSearchResults: Record<number, { barcode: string; assetName: string; size?: string }[]>;
  showBarcodeDropdown: Record<number, boolean>;
  assetNameSearch: Record<number, string>;
  showAssetNameDropdown: Record<number, boolean>;
  controlboxBarcodeResults: Record<number, { barcode: string; assetName: string }[]>;
  showControlboxDropdown: Record<number, boolean>;
}

const defaultSecurityTypeC: SecurityTypeCRow[] = [
  { id: 1, name: "Security Type C Ver.7.1", qty: 0 },
  { id: 2, name: "Security Type C Ver.7.0", qty: 0 },
];

function createDefaultShop(shopCounter: React.MutableRefObject<number>, assetCounter: React.MutableRefObject<number>): ShopEntry {
  return {
    id: shopCounter.current++,
    noMcs: false,
    shopCode: "",
    shopName: "",
    returnDate: "",
    assets: [{ id: assetCounter.current++, barcode: "", name: "", size: "", grade: "", qty: 1 }],
    controlboxRows: [],
    securityTypeC: defaultSecurityTypeC.map(s => ({ ...s })),
    searchResults: [],
    showDropdown: false,
    barcodeSearchResults: {},
    showBarcodeDropdown: {},
    assetNameSearch: {},
    showAssetNameDropdown: {},
    controlboxBarcodeResults: {},
    showControlboxDropdown: {},
  };
}

const FormReturnAsset = ({ mode = "user" }: { mode?: FormMode }) => {
  const { data } = useSession();
  const router = useRouter();
  const params = useParams();
  const editIdFromUrl = Array.isArray(params.id) ? params.id[0] : params.id;
  const [isEdit] = useState(!!editIdFromUrl);
  const [editId] = useState<string | null>(editIdFromUrl || null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [docStatus, setDocStatus] = useState("");

  const shopIdCounter = useRef(1);
  const assetIdCounter = useRef(1);
  const controlboxIdCounter = useRef(1);

  const [shops, setShops] = useState<ShopEntry[]>(() => [createDefaultShop(shopIdCounter, assetIdCounter)]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ docNumber: "", fullName: "", company: "", phone: "" });
  const [returnCondition, setReturnCondition] = useState<"normal" | "from_borrow" | "">("");
  const [note, setNote] = useState("");
  const [otherActivity, setOtherActivity] = useState<OtherActivity>("");
  const [transactionStatus, setTransactionStatus] = useState<StatusOption>("");
  const [assetNames, setAssetNames] = useState<string[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [userVendor, setUserVendor] = useState("");

  const updateShop = useCallback((shopId: number, partial: Partial<ShopEntry>) => {
    setShops(prev => prev.map(s => s.id === shopId ? { ...s, ...partial } : s));
  }, []);

  const addShop = useCallback(() => {
    setShops(prev => [...prev, createDefaultShop(shopIdCounter, assetIdCounter)]);
  }, []);

  const removeShop = useCallback((shopId: number) => {
    setShops(prev => prev.filter(s => s.id !== shopId));
  }, []);

  const addAsset = useCallback((shopId: number) => {
    setShops(prev => prev.map(s =>
      s.id === shopId
        ? { ...s, assets: [...s.assets, { id: assetIdCounter.current++, barcode: "", name: "", size: "", grade: "", qty: 1 }] }
        : s
    ));
  }, []);

  const removeAsset = useCallback((shopId: number, assetId: number) => {
    setShops(prev => prev.map(s =>
      s.id === shopId ? { ...s, assets: s.assets.filter(a => a.id !== assetId) } : s
    ));
  }, []);

  const updateAsset = useCallback((shopId: number, assetId: number, partial: Partial<AssetRow>) => {
    setShops(prev => prev.map(s =>
      s.id === shopId
        ? { ...s, assets: s.assets.map(a => a.id === assetId ? { ...a, ...partial } : a) }
        : s
    ));
  }, []);

  const updateSecurityTypeCQty = useCallback((shopId: number, rowId: number, qty: number) => {
    setShops(prev => prev.map(s =>
      s.id === shopId
        ? { ...s, securityTypeC: s.securityTypeC.map(r => r.id === rowId ? { ...r, qty } : r) }
        : s
    ));
  }, []);

  const addControlboxRow = useCallback((shopId: number) => {
    setShops(prev => prev.map(s =>
      s.id === shopId
        ? { ...s, controlboxRows: [...s.controlboxRows, { id: controlboxIdCounter.current++, barcode: "", name: "" }] }
        : s
    ));
  }, []);

  const removeControlboxRow = useCallback((shopId: number, rowId: number) => {
    setShops(prev => prev.map(s =>
      s.id === shopId ? { ...s, controlboxRows: s.controlboxRows.filter(r => r.id !== rowId) } : s
    ));
  }, []);

  const updateControlboxRow = useCallback((shopId: number, rowId: number, partial: Partial<ControlboxRow>) => {
    setShops(prev => prev.map(s =>
      s.id === shopId
        ? { ...s, controlboxRows: s.controlboxRows.map(r => r.id === rowId ? { ...r, ...partial } : r) }
        : s
    ));
  }, []);

  const fetchControlboxBarcodes = useCallback(async (q: string, shopId: number, rowId: number) => {
    if (!q || q.length < 2) {
      setShops(prev => prev.map(s =>
        s.id === shopId
          ? { ...s, controlboxBarcodeResults: { ...s.controlboxBarcodeResults, [rowId]: [] }, showControlboxDropdown: { ...s.showControlboxDropdown, [rowId]: false } }
          : s
      ));
      return;
    }
    const res = await fetch(`/api/asset/searchByBarcode?query=${encodeURIComponent(q)}&isSecuritySet=true&balanceFilter=0`);
    const json = await res.json();
    const barcodes = json.assets || [];
    setShops(prev => prev.map(s =>
      s.id === shopId
        ? { ...s, controlboxBarcodeResults: { ...s.controlboxBarcodeResults, [rowId]: barcodes }, showControlboxDropdown: { ...s.showControlboxDropdown, [rowId]: true } }
        : s
    ));
  }, []);

  const debouncedControlboxBarcode = useMemo(() => debounce(fetchControlboxBarcodes, 300), [fetchControlboxBarcodes]);

  const searchShop = useCallback(async (q: string, shopId: number) => {
    if (!q || q.length < 2) {
      updateShop(shopId, { searchResults: [], showDropdown: false });
      return;
    }
    const res = await fetch(`/api/shop/search?query=${encodeURIComponent(q)}&status=OPEN`);
    const json = await res.json();
    const list = Array.isArray(json?.shops) ? json.shops : [];
    updateShop(shopId, { searchResults: list, showDropdown: list.length > 0 });
  }, [updateShop]);

  const debouncedSearchShop = useMemo(() => debounce(searchShop, 300), [searchShop]);

  const fetchBarcodes = useCallback(async (q: string, shopId: number, rowId: number) => {
    updateAsset(shopId, rowId, { name: "", size: "" });
    const res = await fetch(`/api/asset/searchByBarcode?query=${encodeURIComponent(q)}&balanceFilter=0`);
    const json = await res.json();
    const barcodes = json.assets || [];
    setShops(prev => prev.map(s =>
      s.id === shopId
        ? {
            ...s,
            barcodeSearchResults: { ...s.barcodeSearchResults, [rowId]: barcodes },
            showBarcodeDropdown: { ...s.showBarcodeDropdown, [rowId]: true },
          }
        : s
    ));
  }, [updateAsset]);

  const debouncedBarcode = useMemo(() => debounce(fetchBarcodes, 300), [fetchBarcodes]);

  const handleNoBarcodeToggle = useCallback(async (shopId: number, rowId: number, checked: boolean) => {
    if (checked) {
      const res = await fetch("/api/asset/generate-nobc");
      const json = await res.json();
      if (json.success) {
        updateAsset(shopId, rowId, { noBarcode: true, barcode: json.barcode, name: "", size: "" });
      } else {
        toast.error("ไม่สามารถสร้าง Barcode ได้");
      }
    } else {
      updateAsset(shopId, rowId, { noBarcode: false, barcode: "", name: "", size: "" });
    }
  }, [updateAsset]);

  const getFilteredAssetNames = useCallback((shopId: number, assetId: number, shopsList: ShopEntry[]) => {
    const shop = shopsList.find(s => s.id === shopId);
    const search = shop?.assetNameSearch[assetId] || "";
    if (!search) return assetNames.slice(0, 50);
    return assetNames.filter(name => name.toLowerCase().includes(search.toLowerCase())).slice(0, 50);
  }, [assetNames]);

  useEffect(() => {
    if (!editIdFromUrl || dataLoaded) return;
    setLoading(true);
    fetch(`/api/document/detail/${editIdFromUrl}`).then(r => r.json()).then(json => {
      if (json.success) {
        const doc = json.document;
        setDocStatus(doc.status || "");
        setFormData({ docNumber: doc.docCode, fullName: doc.fullName || "", company: doc.company || "", phone: doc.phone || "" });
        setNote(doc.note || "");
        if (doc.returnCondition) setReturnCondition(doc.returnCondition);
        setUserVendor(doc.createdBy?.vendor || "");

        if (doc.shops?.length > 0) {
          let aId = 1;
          const shopEntries: ShopEntry[] = doc.shops.map((shop: any, idx: number) => ({
            id: idx + 1,
            noMcs: !shop.shopCode,
            shopCode: shop.shopCode || "",
            shopName: shop.shopName || "",
            returnDate: shop.startInstallDate ? new Date(shop.startInstallDate).toISOString().split('T')[0] : "",
            assets: shop.assets?.length > 0
              ? shop.assets.map((a: any) => ({
                  id: aId++,
                  barcode: a.barcode || "",
                  name: a.name || "",
                  size: a.size || "",
                  grade: a.grade || "",
                  qty: a.qty || 1,
                  noBarcode: a.barcode?.startsWith("NOBC-") || false,
                  isSelected: !!(a.name),
                }))
              : [{ id: aId++, barcode: "", name: "", size: "", grade: "", qty: 1 }],
            controlboxRows: (shop.securitySets || [])
              .filter((sec: any) => sec.name?.includes("CONTROLBOX"))
              .map((sec: any, i: number) => ({ id: i + 1, barcode: sec.barcode || "", name: sec.name || "" })),
            securityTypeC: defaultSecurityTypeC.map(def => {
              const found = (shop.securitySets || []).find((s: any) => s.name === def.name);
              return found ? { ...def, qty: found.qty || 0 } : { ...def };
            }),
            searchResults: [],
            showDropdown: false,
            barcodeSearchResults: {},
            showBarcodeDropdown: {},
            assetNameSearch: {},
            showAssetNameDropdown: {},
            controlboxBarcodeResults: {},
            showControlboxDropdown: {},
          }));
          shopIdCounter.current = shopEntries.length + 1;
          assetIdCounter.current = aId;
          setShops(shopEntries);
        }
      }
      setDataLoaded(true);
    }).finally(() => setLoading(false));
  }, [editIdFromUrl, dataLoaded]);

  useEffect(() => {
    fetch("/api/asset/names").then(r => r.json()).then(json => {
      if (json.success) setAssetNames(json.names || []);
    });
  }, []);

  useEffect(() => {
    if (dataLoaded || isEdit) return;
    getMe(data?.user?.email ?? '').then(me => {
      fetch("/api/document/generate").then(r => r.json()).then(json => {
        setFormData({
          docNumber: json.docCode || "",
          fullName: `${me?.user?.firstName || ""} ${me?.user?.lastName || ""}`.trim() || "",
          company: me?.user?.company || "",
          phone: me?.user?.phone || "",
        });
        setUserVendor(me?.user?.vendor || "");
      });
    });
  }, [dataLoaded, isEdit]);

  const buildShopsPayload = () => shops.map(s => ({
    shopCode: s.shopCode,
    shopName: s.shopName,
    startInstallDate: s.returnDate,
    assets: s.assets.map(a => ({ barcode: a.barcode, name: a.name, size: a.size, grade: a.grade, qty: a.qty })),
    securitySets: [
      ...s.controlboxRows.filter(r => r.barcode.trim() !== "").map(r => ({ name: r.name, qty: 1, barcode: r.barcode })),
      ...s.securityTypeC.filter(r => r.qty > 0).map(r => ({ name: r.name, qty: r.qty })),
    ],
  }));

  const handleOpenPreview = () => {
    if (!returnCondition) {
      toast.error("กรุณาเลือกเงื่อนไขการเก็บกลับ");
      return;
    }
    setShowPreviewModal(true);
  };

  const handleConfirmApprove = async () => {
    setShowPreviewModal(false);
    await handleSubmit("approve");
  };

  const handleSubmit = async (action: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (!returnCondition) {
        toast.error("กรุณาเลือกเงื่อนไขการเก็บกลับ");
        return;
      }
      const basePayload = {
        documentType: "return",
        docCode: formData.docNumber,
        fullName: formData.fullName,
        company: formData.company,
        phone: formData.phone,
        note,
        returnCondition,
        status: "submitted",
        shops: buildShopsPayload(),
      };

      if (action === "approve" && editId) {
        const updateRes = await fetch(`/api/document/update/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(basePayload),
        });
        const updateR = await updateRes.json();
        if (!updateR.success) throw new Error(updateR.message);
        const res = await fetch("/api/document/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: parseInt(editId), otherActivity }),
        });
        const r = await res.json();
        if (!r.success) throw new Error(r.message);
        toast.success("อนุมัติสำเร็จ!");
        router.push("/dashboard/admin-list");
        return;
      }

      if (action === "reject" && editId) {
        const res = await fetch(`/api/document/update/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "rejected", note }),
        });
        const r = await res.json();
        if (!r.success) throw new Error(r.message);
        toast.success("ปฏิเสธสำเร็จ!");
        router.push("/dashboard/admin-list");
        return;
      }

      const res = await fetch(isEdit ? `/api/document/update/${editId}` : "/api/document/create", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload),
      });
      const r = await res.json();
      if (!r.success) throw new Error(r.message);
      toast.success(isEdit ? "แก้ไขสำเร็จ!" : "บันทึกสำเร็จ!");
      router.push(mode === "admin" ? "/dashboard/admin-list" : "/dashboard/user-list");
    } catch (e) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDraftSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = { documentType: "return", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, returnCondition, status: "reviewing", transactionStatus: transactionStatus || null, shops: buildShopsPayload() };
      const res = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      toast.success("บันทึก Draft สำเร็จ!");
      setDocStatus("reviewing");
    } catch (err) { console.error(err); toast.error("เกิดข้อผิดพลาดในการบันทึก Draft"); }
    finally { setIsSubmitting(false); }
  };

  if (loading && isEdit) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

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
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">{isEdit ? "แก้ไขใบเก็บ Asset กลับ" : "ใบเก็บ Asset กลับ"}</h1>
          <p className="text-sm text-muted-foreground">เลขที่ {formData.docNumber || "รอสร้าง"}</p>
        </div>
      </div>

      {/* Requester info */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-container blue !w-8 !h-8"><User className="w-4 h-4" /></div>
          <h2 className="font-semibold">ข้อมูลผู้เก็บ</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="block text-xs text-muted-foreground mb-1">เลขที่เอกสาร</label><Input value={formData.docNumber} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">ชื่อ</label><Input value={formData.fullName} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">บริษัท</label><Input value={formData.company} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">เบอร์โทร</label><Input value={formData.phone} readOnly className="glass-input bg-black/5" /></div>
        </div>
      </div>

      {/* Return condition */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-container purple !w-8 !h-8"><ClipboardList className="w-4 h-4" /></div>
          <h2 className="font-semibold">เงื่อนไขการเก็บกลับ</h2>
        </div>
        <RadioGroup value={returnCondition} onValueChange={(v: "normal" | "from_borrow") => setReturnCondition(v)} className="flex gap-6" disabled={isReadOnly}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="normal" id="return-normal" disabled={isReadOnly} />
            <Label htmlFor="return-normal" className="cursor-pointer">เก็บกลับปกติ</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="from_borrow" id="return-from-borrow" disabled={isReadOnly} />
            <Label htmlFor="return-from-borrow" className="cursor-pointer">เก็บกลับจากการยืม</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Dynamic shops */}
      {shops.map((shop, shopIdx) => (
        <div key={shop.id} className="space-y-3">
          {/* Shop section header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="icon-container cyan !w-8 !h-8"><Store className="w-4 h-4" /></div>
              <h2 className="font-semibold">ร้านที่ {shopIdx + 1}</h2>
            </div>
            {shops.length > 1 && !isReadOnly && (
              <button
                onClick={() => removeShop(shop.id)}
                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-sm flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> ลบร้าน
              </button>
            )}
          </div>

          {/* Shop info */}
          <div className="glass-card p-4 sm:p-5">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`no-mcs-${shop.id}`}
                    checked={shop.noMcs}
                    onCheckedChange={(c) => {
                      updateShop(shop.id, { noMcs: !!c, shopCode: !!c ? "" : shop.shopCode, shopName: !!c ? "" : shop.shopName });
                    }}
                    disabled={isReadOnly}
                    className="border-2 border-gray-400"
                  />
                  <label htmlFor={`no-mcs-${shop.id}`} className="text-sm font-medium text-foreground cursor-pointer">NO MCS</label>
                </div>
                <div className="flex-1 relative">
                  <label className="block text-xs text-muted-foreground mb-1">MCS Code</label>
                  <Input
                    value={shop.shopCode}
                    onChange={(e) => {
                      updateShop(shop.id, { shopCode: e.target.value });
                      debouncedSearchShop(e.target.value, shop.id);
                    }}
                    onFocus={() => shop.searchResults.length > 0 && updateShop(shop.id, { showDropdown: true })}
                    onBlur={() => setTimeout(() => updateShop(shop.id, { showDropdown: false }), 200)}
                    disabled={shop.noMcs || isReadOnly}
                    placeholder="พิมพ์ MCS Code..."
                    className="glass-input"
                  />
                  {shop.showDropdown && shop.searchResults.length > 0 && (
                    <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">
                      {shop.searchResults.map(s => (
                        <div
                          key={s.mcsCode}
                          className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm"
                          onClick={() => updateShop(shop.id, { shopCode: s.mcsCode, shopName: s.shopName, showDropdown: false })}
                        >
                          <span className="text-primary font-medium">{s.mcsCode}</span> - {s.shopName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-[2]">
                  <label className="block text-xs text-muted-foreground mb-1">Shop Name</label>
                  <Input
                    value={shop.shopName}
                    onChange={(e) => updateShop(shop.id, { shopName: e.target.value })}
                    disabled={!shop.noMcs || isReadOnly}
                    placeholder="ชื่อ Shop"
                    className="glass-input"
                  />
                </div>
              </div>
              <div className="max-w-xs">
                <label className="block text-xs text-muted-foreground mb-1">วันที่คืน</label>
                <Input
                  type="date"
                  value={shop.returnDate}
                  onChange={(e) => updateShop(shop.id, { returnDate: e.target.value })}
                  disabled={isReadOnly}
                  className="glass-input"
                />
              </div>
            </div>
          </div>

          {/* Assets */}
          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="icon-container orange !w-8 !h-8"><Package className="w-4 h-4" /></div>
                <h2 className="font-semibold">Asset</h2>
                <span className="text-xs text-muted-foreground">({shop.assets.length})</span>
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => addAsset(shop.id)}
                  className="glass-button px-3 py-2 text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />เพิ่ม
                </button>
              )}
            </div>
            <div className="space-y-3">
              {shop.assets.map((asset) => (
                <div key={asset.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Checkbox
                      id={`no-barcode-${shop.id}-${asset.id}`}
                      checked={asset.noBarcode || false}
                      onCheckedChange={(c) => handleNoBarcodeToggle(shop.id, asset.id, !!c)}
                      disabled={isReadOnly}
                      className="border-2 border-gray-400"
                    />
                    <label htmlFor={`no-barcode-${shop.id}-${asset.id}`} className="text-sm font-medium text-foreground cursor-pointer">NO BARCODE</label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-3 relative">
                      <label className="block text-xs text-muted-foreground mb-1">Barcode</label>
                      {asset.noBarcode ? (
                        <Input value={asset.barcode} readOnly className="glass-input bg-black/5 font-mono text-sm" />
                      ) : (
                        <>
                          <Input
                            value={asset.barcode}
                            onChange={(e) => {
                              updateAsset(shop.id, asset.id, { barcode: e.target.value });
                              debouncedBarcode(e.target.value, shop.id, asset.id);
                            }}
                            onFocus={() => { fetchBarcodes(asset.barcode, shop.id, asset.id); }}
                            onBlur={() => setTimeout(() => setShops(prev => prev.map(s =>
                              s.id === shop.id
                                ? { ...s, showBarcodeDropdown: { ...s.showBarcodeDropdown, [asset.id]: false } }
                                : s
                            )), 200)}
                            disabled={isReadOnly}
                            placeholder="สแกน Barcode..."
                            className="glass-input"
                          />
                          {shop.showBarcodeDropdown[asset.id] && (shop.barcodeSearchResults[asset.id] || []).length > 0 && (
                            <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">
                              {(shop.barcodeSearchResults[asset.id] || []).map(b => (
                                <div
                                  key={b.barcode}
                                  className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm"
                                  onClick={() => {
                                    updateAsset(shop.id, asset.id, { barcode: b.barcode, name: b.assetName, size: b.size || "" });
                                    setShops(prev => prev.map(s =>
                                      s.id === shop.id
                                        ? { ...s, showBarcodeDropdown: { ...s.showBarcodeDropdown, [asset.id]: false } }
                                        : s
                                    ));
                                  }}
                                >
                                  <span className="font-mono text-primary">{b.barcode}</span> - {b.assetName}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="sm:col-span-3 relative">
                      <label className="block text-xs text-muted-foreground mb-1">Asset Name</label>
                      {asset.noBarcode ? (
                        <>
                          <div className="relative">
                            <Input
                              value={shop.assetNameSearch[asset.id] || asset.name}
                              onChange={(e) => {
                                if (!asset.isSelected) {
                                  setShops(prev => prev.map(s =>
                                    s.id === shop.id
                                      ? { ...s, assetNameSearch: { ...s.assetNameSearch, [asset.id]: e.target.value }, showAssetNameDropdown: { ...s.showAssetNameDropdown, [asset.id]: true } }
                                      : s
                                  ));
                                }
                              }}
                              onFocus={() => {
                                if (!asset.isSelected) {
                                  setShops(prev => prev.map(s =>
                                    s.id === shop.id
                                      ? { ...s, showAssetNameDropdown: { ...s.showAssetNameDropdown, [asset.id]: true } }
                                      : s
                                  ));
                                }
                              }}
                              onBlur={() => setTimeout(() => setShops(prev => prev.map(s =>
                                s.id === shop.id
                                  ? { ...s, showAssetNameDropdown: { ...s.showAssetNameDropdown, [asset.id]: false } }
                                  : s
                              )), 200)}
                              placeholder="เลือก Asset Name..."
                              readOnly={asset.isSelected || isReadOnly}
                              className={`glass-input ${asset.isSelected ? "pr-10 bg-gray-50" : ""}`}
                            />
                            {asset.isSelected && !isReadOnly && (
                              <button
                                type="button"
                                onClick={() => {
                                  updateAsset(shop.id, asset.id, { name: "", isSelected: false });
                                  setShops(prev => prev.map(s =>
                                    s.id === shop.id
                                      ? { ...s, assetNameSearch: { ...s.assetNameSearch, [asset.id]: "" } }
                                      : s
                                  ));
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                                title="ล้างเพื่อเลือกใหม่"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {shop.showAssetNameDropdown[asset.id] && !asset.isSelected && (
                            <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">
                              {getFilteredAssetNames(shop.id, asset.id, shops).map(name => (
                                <div
                                  key={name}
                                  className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    updateAsset(shop.id, asset.id, { name, isSelected: true });
                                    setShops(prev => prev.map(s =>
                                      s.id === shop.id
                                        ? { ...s, assetNameSearch: { ...s.assetNameSearch, [asset.id]: name }, showAssetNameDropdown: { ...s.showAssetNameDropdown, [asset.id]: false } }
                                        : s
                                    ));
                                  }}
                                >
                                  {name}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <Input value={asset.name} readOnly className="glass-input bg-black/5" />
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-muted-foreground mb-1">Size</label>
                      {asset.noBarcode ? (
                        <Input
                          value={asset.size}
                          onChange={(e) => updateAsset(shop.id, asset.id, { size: e.target.value })}
                          disabled={isReadOnly}
                          placeholder="กรอก Size"
                          className="glass-input"
                        />
                      ) : (
                        <Input value={asset.size} readOnly className="glass-input bg-black/5" />
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-muted-foreground mb-1">Grade</label>
                      <Select value={asset.grade} onValueChange={(v) => updateAsset(shop.id, asset.id, { grade: v })} disabled={isReadOnly}>
                        <SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="AB">AB</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="BC">BC</SelectItem>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="CD">CD</SelectItem>
                          <SelectItem value="D">D</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs text-muted-foreground mb-1">จำนวน</label>
                      <Input value="1" readOnly className="glass-input bg-black/5 text-center" />
                    </div>
                    {shop.assets.length > 1 && !isReadOnly && (
                      <div className="flex items-end">
                        <button
                          onClick={() => removeAsset(shop.id, asset.id)}
                          className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security sets */}
          <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="icon-container red !w-8 !h-8"><Shield className="w-4 h-4" /></div>
              <h2 className="font-semibold">Security Set</h2>
            </div>

            {/* CONTROLBOX */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">CONTROLBOX</span>
                {!isReadOnly && (
                  <button
                    onClick={() => addControlboxRow(shop.id)}
                    className="glass-button px-3 py-1.5 text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> เพิ่ม CONTROLBOX
                  </button>
                )}
              </div>
              {shop.controlboxRows.length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-2">ไม่มี CONTROLBOX</p>
              )}
              <div className="space-y-2">
                {shop.controlboxRows.map((row) => (
                  <div key={row.id} className="p-3 rounded-xl bg-black/2 border border-black/5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-5 relative">
                        <label className="block text-xs text-muted-foreground mb-1">Barcode</label>
                        <Input
                          value={row.barcode}
                          onChange={(e) => {
                            updateControlboxRow(shop.id, row.id, { barcode: e.target.value, name: "" });
                            debouncedControlboxBarcode(e.target.value, shop.id, row.id);
                          }}
                          onFocus={() => fetchControlboxBarcodes(row.barcode, shop.id, row.id)}
                          onBlur={() => setTimeout(() => setShops(prev => prev.map(s =>
                            s.id === shop.id
                              ? { ...s, showControlboxDropdown: { ...s.showControlboxDropdown, [row.id]: false } }
                              : s
                          )), 200)}
                          disabled={isReadOnly}
                          placeholder="สแกน Barcode CONTROLBOX..."
                          className="glass-input"
                        />
                        {shop.showControlboxDropdown[row.id] && (shop.controlboxBarcodeResults[row.id] || []).length > 0 && (
                          <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">
                            {(shop.controlboxBarcodeResults[row.id] || []).map(b => (
                              <div
                                key={b.barcode}
                                className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm"
                                onClick={() => {
                                  updateControlboxRow(shop.id, row.id, { barcode: b.barcode, name: b.assetName });
                                  setShops(prev => prev.map(s =>
                                    s.id === shop.id
                                      ? { ...s, showControlboxDropdown: { ...s.showControlboxDropdown, [row.id]: false } }
                                      : s
                                  ));
                                }}
                              >
                                <span className="font-mono text-primary">{b.barcode}</span> - {b.assetName}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="sm:col-span-6">
                        <label className="block text-xs text-muted-foreground mb-1">CONTROLBOX Name</label>
                        <Input value={row.name} readOnly className="glass-input bg-black/5" placeholder="Auto-fill จาก Barcode" />
                      </div>
                      {!isReadOnly && (
                        <div className="flex items-end">
                          <button
                            onClick={() => removeControlboxRow(shop.id, row.id)}
                            className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Type C */}
            <div>
              <span className="text-sm font-medium text-muted-foreground block mb-2">Security Type C</span>
              <div className="space-y-2">
                {shop.securityTypeC.map((row) => (
                  <div key={row.id} className="p-3 rounded-xl bg-black/2 border border-black/5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-9">
                        <label className="block text-xs text-muted-foreground mb-1">Security Name</label>
                        <Input value={row.name} readOnly className="glass-input bg-black/5" />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs text-muted-foreground mb-1">จำนวนเก็บกลับ</label>
                        <Input
                          type="number"
                          min={0}
                          value={row.qty}
                          onChange={(e) => updateSecurityTypeCQty(shop.id, row.id, Math.max(0, +e.target.value))}
                          disabled={isReadOnly}
                          className="glass-input text-center"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Add shop button */}
      {!isReadOnly && (
        <button
          onClick={addShop}
          className="glass-button px-4 py-3 text-sm flex items-center gap-2 w-full justify-center border-dashed"
        >
          <Plus className="w-4 h-4" /> เพิ่ม Shop
        </button>
      )}

      {/* Note */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-container gray !w-8 !h-8"><FileText className="w-4 h-4" /></div>
          <h2 className="font-semibold">หมายเหตุ</h2>
        </div>
        <Input placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} disabled={isReadOnly} className="glass-input" />
      </div>

      {mode === "admin" && <OtherActivitiesSelect value={otherActivity} onChange={setOtherActivity} />}
      {mode === "admin" && <StatusSelect value={transactionStatus} onChange={setTransactionStatus} />}

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
        documentType="return"
        documentData={{
          docCode: formData.docNumber,
          fullName: formData.fullName,
          company: formData.company,
          phone: formData.phone,
          note: note,
          vendor: userVendor,
        }}
        shopInfo={{ shopCode: "", shopName: "", startInstallDate: "", endInstallDate: "", q7b7: "", shopFocus: "" }}
        assets={[]}
        securitySets={[]}
        shops={shops.map(s => ({
          shopCode: s.shopCode,
          shopName: s.shopName,
          startInstallDate: s.returnDate,
          endInstallDate: "",
          q7b7: "",
          shopFocus: "",
          assets: s.assets
            .filter(a => a.barcode && a.barcode.trim() !== "")
            .map(a => ({ name: a.name, size: a.size, grade: a.grade || "", kv: "", qty: a.qty, withdrawFor: "", barcode: a.barcode })),
          securitySets: [
            ...s.controlboxRows.filter(r => r.barcode.trim() !== "").map(r => ({ name: r.name, qty: 1, withdrawFor: "", assignedBarcodes: [], barcode: r.barcode })),
            ...s.securityTypeC.filter(r => r.qty > 0).map(r => ({ name: r.name, qty: r.qty, withdrawFor: "", assignedBarcodes: [] })),
          ],
        }))}
        returnCondition={returnCondition}
      />
    </div>
  );
};

export default FormReturnAsset;
