"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import debounce from "lodash.debounce";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getMe } from "./loader";
import { Plus, Trash2, User, Store, Package, Shield, FileText, Save, CheckCircle, XCircle, Loader2, KeyRound, ClipboardList, Route } from "lucide-react";
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
  useCustomSize?: boolean;
  customW?: string;
  customD?: string;
  customH?: string;
  customXX?: string;
};
type SecuritySet = { id: number; name: string; qty: number; withdrawFor: string };
type FormMode = "user" | "admin";

const BORROW_TYPE_OPTIONS = ["EVENT", "TEMP SHOP"];

const isCustomSizeAsset = (name: string) => {
  const lowerName = name.toLowerCase().replace(/\s+/g, "");
  return (
    lowerName.includes("lightbox") ||
    lowerName.includes("accwall") ||
    lowerName.includes("wallkv-low") ||
    lowerName.includes("wallkv - low")
  );
};

const defaultSecuritySets = (): SecuritySet[] => [
  { id: 1, name: "CONTROLBOX 6 PORT (M-60000R) with power cable", qty: 0, withdrawFor: "" },
  { id: 2, name: "CONTROLBOX 5 PORT (M-50000R) with power cable", qty: 0, withdrawFor: "" },
  { id: 3, name: "Security Type C Ver.7.1", qty: 0, withdrawFor: "" },
  { id: 4, name: "Security Type C Ver.7.0", qty: 0, withdrawFor: "" },
];

type ShopEntry = {
  id: number;
  noMcs: boolean;
  shopCode: string;
  shopName: string;
  startDate: string;
  endDate: string;
  q7b7: string;
  shopFocus: string;
  searchResults: ShopItem[];
  showDropdown: boolean;
  assets: AssetRow[];
  securitySets: SecuritySet[];
  assetIdCounter: number;
  assetSearchResults: string[];
  showAssetDropdown: Record<number, boolean>;
  sizeOptions: Record<number, string[]>;
  assetBarcodes: Record<number, string[]>;
  securityBarcodes: Record<number, string[]>;
};

let shopIdCounter = 1;
let globalAssetIdCounter = 1;

const newShop = (): ShopEntry => ({
  id: shopIdCounter++,
  noMcs: false,
  shopCode: "",
  shopName: "",
  startDate: "",
  endDate: "",
  q7b7: "",
  shopFocus: "",
  searchResults: [],
  showDropdown: false,
  assets: [{ id: globalAssetIdCounter++, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }],
  securitySets: defaultSecuritySets(),
  assetIdCounter: globalAssetIdCounter,
  assetSearchResults: [],
  showAssetDropdown: {},
  sizeOptions: {},
  assetBarcodes: {},
  securityBarcodes: {},
});

const FormBorrowSecurityRouting = ({ mode = "user" }: { mode?: FormMode }) => {
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

  const [formData, setFormData] = useState({ docNumber: "", fullName: "", company: "", phone: "" });
  const [vendors, setVendors] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [borrowType, setBorrowType] = useState("");
  const [otherActivity, setOtherActivity] = useState<OtherActivity>("");
  const [transactionStatus, setTransactionStatus] = useState<StatusOption>("");
  const [userVendor, setUserVendor] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [shops, setShops] = useState<ShopEntry[]>([newShop()]);

  const abortRefs = useRef<Map<number, AbortController>>(new Map());

  useEffect(() => {
    fetch("/api/vendor/list")
      .then((r) => r.json())
      .then((j) => {
        if (j.success)
          setVendors(j.vendors?.filter((v: string) => v && v.trim() !== "" && v !== "-") || []);
      });
  }, []);

  // Load existing document for edit
  useEffect(() => {
    if (!editIdFromUrl || dataLoaded) return;
    setLoading(true);
    fetch(`/api/document/detail/${editIdFromUrl}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const doc = json.document;
          setDocStatus(doc.status || "");
          setFormData({
            docNumber: doc.docCode,
            fullName: doc.fullName || "",
            company: doc.company || "",
            phone: doc.phone || "",
          });
          setNote(doc.note || "");
          setBorrowType(doc.borrowType || "");
          setTransactionStatus(doc.transactionStatus || "");
          setUserVendor(doc.createdBy?.vendor || "");

          if (doc.shops?.length > 0) {
            const loadedShops: ShopEntry[] = doc.shops.map((shop: any) => {
              const loadedAssets: AssetRow[] = shop.assets?.length > 0
                ? shop.assets.map((a: any, idx: number) => ({
                    id: idx + 1,
                    name: a.name || "",
                    size: a.size || "",
                    kv: a.kv || "",
                    qty: a.qty || 1,
                    withdrawFor: a.withdrawFor || "",
                  }))
                : [{ id: 1, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }];

              const loadedAssetBarcodes: Record<number, string[]> = {};
              if (doc.status === "reviewing") {
                loadedAssets.forEach((asset, idx) => {
                  const raw = shop.assets?.[idx]?.barcode;
                  if (raw) {
                    try { loadedAssetBarcodes[asset.id] = JSON.parse(raw); } catch {}
                  }
                });
              }

              const defs = defaultSecuritySets();
              const loadedSecurity: SecuritySet[] = defs.map((def) => {
                const found = shop.securitySets?.find((s: any) => s.name === def.name);
                if (found) {
                  return { ...def, qty: found.qty || 0, withdrawFor: found.withdrawFor || (found.qty > 0 ? "NEWLOOK" : "") };
                }
                return def;
              });

              const loadedSecBarcodes: Record<number, string[]> = {};
              if (doc.status === "reviewing") {
                defs.forEach((def) => {
                  const found = shop.securitySets?.find((s: any) => s.name === def.name);
                  if (found?.barcode) {
                    try { loadedSecBarcodes[def.id] = JSON.parse(found.barcode); } catch {}
                  }
                });
              }

              return {
                id: shopIdCounter++,
                noMcs: !shop.shopCode,
                shopCode: shop.shopCode || "",
                shopName: shop.shopName || "",
                startDate: shop.startInstallDate ? new Date(shop.startInstallDate).toISOString().split("T")[0] : "",
                endDate: shop.endInstallDate ? new Date(shop.endInstallDate).toISOString().split("T")[0] : "",
                q7b7: shop.q7b7 || "",
                shopFocus: shop.shopFocus || "",
                searchResults: [],
                showDropdown: false,
                assets: loadedAssets,
                securitySets: loadedSecurity,
                assetIdCounter: loadedAssets.length + 1,
                assetSearchResults: [],
                showAssetDropdown: {},
                sizeOptions: {},
                assetBarcodes: loadedAssetBarcodes,
                securityBarcodes: loadedSecBarcodes,
              };
            });
            setShops(loadedShops);
          }
        }
        setDataLoaded(true);
      })
      .finally(() => setLoading(false));
  }, [editIdFromUrl, dataLoaded]);

  useEffect(() => {
    if (dataLoaded || isEdit || !data?.user) return;
    getMe(data.user.email ?? "").then((me) => {
      fetch("/api/document/generate")
        .then((r) => r.json())
        .then((json) => {
          setFormData({
            docNumber: json.docCode || "",
            fullName: `${me?.user?.firstName || ""} ${me?.user?.lastName || ""}`.trim(),
            company: me?.user?.company || "",
            phone: me?.user?.phone || "",
          });
          setUserVendor(me?.user?.vendor || "");
        });
    });
  }, [dataLoaded, isEdit, data]);

  // ── Shop helper functions ──────────────────────────────────────────────────

  const updateShop = (shopId: number, patch: Partial<ShopEntry>) => {
    setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, ...patch } : s)));
  };

  const addShop = () => {
    setShops((prev) => [...prev, newShop()]);
  };

  const removeShop = (shopId: number) => {
    if (shops.length <= 1) return;
    setShops((prev) => prev.filter((s) => s.id !== shopId));
  };

  const fetchShopsForShop = useCallback(
    async (shopId: number, query: string) => {
      if (query.length < 2) {
        updateShop(shopId, { searchResults: [], showDropdown: false });
        return;
      }
      const prev = abortRefs.current.get(shopId);
      if (prev) prev.abort();
      const controller = new AbortController();
      abortRefs.current.set(shopId, controller);
      try {
        const res = await fetch(`/api/shop/search?query=${encodeURIComponent(query)}&status=OPEN`, {
          signal: controller.signal,
        });
        const json = await res.json();
        const list: ShopItem[] = Array.isArray(json?.shops) ? json.shops : [];
        updateShop(shopId, { searchResults: list, showDropdown: list.length > 0 });
      } catch (err) {
        if ((err as any)?.name !== "AbortError") console.error(err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const debouncedShopSearchMap = useMemo(() => {
    const map = new Map<number, (query: string) => void>();
    return (shopId: number) => {
      if (!map.has(shopId)) {
        map.set(shopId, debounce((q: string) => fetchShopsForShop(shopId, q), 300));
      }
      return map.get(shopId)!;
    };
  }, [fetchShopsForShop]);

  const fetchAssetNamesForShop = async (shopId: number, query: string, rowId: number) => {
    if (!query || query.length < 2) {
      updateShop(shopId, {
        assetSearchResults: [],
        showAssetDropdown: { ...shops.find((s) => s.id === shopId)?.showAssetDropdown, [rowId]: false },
      });
      return;
    }
    try {
      const res = await fetch(`/api/asset/search?query=${encodeURIComponent(query)}`);
      const json = await res.json();
      const names = json.assets?.map((a: any) => a.assetName).filter(Boolean) ?? [];
      const shop = shops.find((s) => s.id === shopId);
      if (shop) {
        updateShop(shopId, {
          assetSearchResults: names,
          showAssetDropdown: { ...shop.showAssetDropdown, [rowId]: true },
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSizesByAssetName = async (shopId: number, name: string, rowId: number) => {
    try {
      const res = await fetch(`/api/asset/sizes?name=${encodeURIComponent(name)}`);
      const json = await res.json();
      const shop = shops.find((s) => s.id === shopId);
      if (shop) {
        updateShop(shopId, { sizeOptions: { ...shop.sizeOptions, [rowId]: json.sizes || [] } });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ── Asset helpers per shop ────────────────────────────────────────────────

  const updateAsset = (shopId: number, assetId: number, patch: Partial<AssetRow>) => {
    setShops((prev) =>
      prev.map((s) =>
        s.id === shopId
          ? { ...s, assets: s.assets.map((a) => (a.id === assetId ? { ...a, ...patch } : a)) }
          : s
      )
    );
  };

  const addAsset = (shopId: number) => {
    setShops((prev) =>
      prev.map((s) => {
        if (s.id !== shopId) return s;
        const newId = globalAssetIdCounter++;
        return {
          ...s,
          assets: [...s.assets, { id: newId, name: "", size: "", kv: "", qty: 1, withdrawFor: "" }],
        };
      })
    );
  };

  const removeAsset = (shopId: number, assetId: number) => {
    setShops((prev) =>
      prev.map((s) =>
        s.id === shopId ? { ...s, assets: s.assets.filter((a) => a.id !== assetId) } : s
      )
    );
  };

  const updateSecurity = (shopId: number, setId: number, patch: Partial<SecuritySet>, defaultVendor?: string) => {
    setShops((prev) =>
      prev.map((s) => {
        if (s.id !== shopId) return s;
        return {
          ...s,
          securitySets: s.securitySets.map((sec) => {
            if (sec.id !== setId) return sec;
            const updated = { ...sec, ...patch };
            if (defaultVendor !== undefined && updated.qty > 0 && !sec.withdrawFor) {
              updated.withdrawFor = defaultVendor;
            }
            if (updated.qty === 0) updated.withdrawFor = "";
            return updated;
          }),
        };
      })
    );
  };

  // ── Validation + Preview ──────────────────────────────────────────────────

  const handleOpenPreview = () => {
    if (!borrowType) {
      toast.error("กรุณาเลือกประเภทการยืม");
      return;
    }

    for (const shop of shops) {
      const filledAssets = shop.assets.filter((a) => a.name && a.name.trim() !== "");
      const filledSecurity = shop.securitySets.filter((s) => s.qty > 0);
      if (filledAssets.length === 0 && filledSecurity.length === 0) {
        toast.error(`ร้านที่ ${shops.indexOf(shop) + 1}: กรุณาเลือก Asset หรือ Security Set อย่างน้อย 1 รายการ`);
        return;
      }
    }

    if (mode === "admin" && !transactionStatus) {
      toast.error("กรุณาเลือก Status ก่อนอนุมัติ");
      return;
    }

    if (mode === "admin") {
      for (const shop of shops) {
        const filledAssets = shop.assets.filter((a) => a.name && a.name.trim() !== "");
        const missingWarehouse = filledAssets.some((a) => !a.withdrawFor || a.withdrawFor.trim() === "");
        if (missingWarehouse) {
          toast.error(`ร้านที่ ${shops.indexOf(shop) + 1}: กรุณาเลือกโกดังให้ครบทุกรายการก่อนอนุมัติ`);
          return;
        }
        const assetMissing = filledAssets.find((a) => {
          const arr = shop.assetBarcodes[a.id] || [];
          return arr.length !== a.qty || arr.some((b) => !b || !b.trim());
        });
        if (assetMissing) {
          toast.error(`ร้านที่ ${shops.indexOf(shop) + 1}: กรุณาเลือก Barcode ให้ครบ (Asset: ${assetMissing.name})`);
          return;
        }
        const filledSec = shop.securitySets.filter((s) => s.qty > 0 && !s.name.includes("Security Type C"));
        const secMissing = filledSec.find((s) => {
          const arr = shop.securityBarcodes[s.id] || [];
          return arr.length !== s.qty || arr.some((b) => !b || !b.trim());
        });
        if (secMissing) {
          toast.error(`ร้านที่ ${shops.indexOf(shop) + 1}: กรุณาเลือก Barcode ให้ครบ (Security: ${secMissing.name})`);
          return;
        }
      }
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
      if (!borrowType) {
        toast.error("กรุณาเลือกประเภทการยืม");
        setIsSubmitting(false);
        return;
      }

      if (action === "approve" && mode === "admin" && !transactionStatus) {
        toast.error("กรุณาเลือก Status ก่อนอนุมัติ");
        setIsSubmitting(false);
        return;
      }

      const shopsPayload = shops.map((shop) => {
        const filledAssets = shop.assets.filter((a) => a.name && a.name.trim() !== "");
        return {
          shopCode: shop.noMcs ? null : shop.shopCode,
          shopName: shop.shopName,
          startInstallDate: shop.startDate || null,
          endInstallDate: shop.endDate || null,
          q7b7: shop.q7b7 || null,
          shopFocus: shop.shopFocus || null,
          assets: filledAssets.map((a) => ({
            name: a.name,
            size: a.size,
            kv: a.kv,
            qty: a.qty,
            withdrawFor: a.withdrawFor,
          })),
          securitySets: shop.securitySets
            .filter((s) => s.qty > 0)
            .map((s) => ({ name: s.name, qty: s.qty, withdrawFor: s.withdrawFor })),
        };
      });

      if (action === "approve" && editId) {
        const updatePayload = {
          documentType: "borrowSecurityRouting",
          docCode: formData.docNumber,
          fullName: formData.fullName,
          company: formData.company,
          phone: formData.phone,
          note,
          status: "submitted",
          borrowType,
          transactionStatus: transactionStatus || null,
          shops: shopsPayload,
        };
        const updateRes = await fetch(`/api/document/update/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });
        const updateR = await updateRes.json();
        if (!updateR.success) throw new Error(updateR.message);

        const assignedBarcodes = {
          assetBarcodes: shops.flatMap((shop, shopIdx) => {
            const filledAssets = shop.assets.filter((a) => a.name && a.name.trim() !== "");
            return filledAssets.map((a, assetIdx) => ({
              shopIndex: shopIdx,
              assetIndex: assetIdx,
              barcodes: (shop.assetBarcodes[a.id] || []).slice(0, a.qty),
            }));
          }),
          securityBarcodes: shops.flatMap((shop, shopIdx) => {
            const filledSec = shop.securitySets.filter((s) => s.qty > 0);
            return filledSec.map((s, secIdx) => ({
              shopIndex: shopIdx,
              securityIndex: secIdx,
              barcodes: s.name.includes("Security Type C") ? [] : (shop.securityBarcodes[s.id] || []).slice(0, s.qty),
            }));
          }),
        };
        const res = await fetch("/api/document/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: parseInt(editId), otherActivity, assignedBarcodes }),
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

      const payload = {
        documentType: "borrowSecurityRouting",
        docCode: formData.docNumber,
        fullName: formData.fullName,
        company: formData.company,
        phone: formData.phone,
        note,
        status: "submitted",
        borrowType,
        shops: shopsPayload,
      };

      const res = await fetch(isEdit ? `/api/document/update/${editId}` : "/api/document/create", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const r = await res.json();
      if (!r.success) throw new Error(r.message);
      toast.success(isEdit ? "แก้ไขสำเร็จ!" : "บันทึกสำเร็จ!");
      router.push(mode === "admin" ? "/dashboard/admin-list" : "/dashboard/user-list");
    } catch (e) {
      toast.error("เกิดข้อผิดพลาด");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDraftSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const draftShops = shops.map((shop) => {
        const filledAssets = shop.assets.filter((a) => a.name && a.name.trim() !== "");
        return {
          shopCode: shop.noMcs ? null : shop.shopCode,
          shopName: shop.shopName,
          startInstallDate: shop.startDate || null,
          endInstallDate: shop.endDate || null,
          q7b7: shop.q7b7 || null,
          shopFocus: shop.shopFocus || null,
          assets: filledAssets.map((a) => ({
            name: a.name,
            size: a.size,
            kv: a.kv,
            qty: a.qty,
            withdrawFor: a.withdrawFor,
            barcode: JSON.stringify(shop.assetBarcodes[a.id] || []),
          })),
          securitySets: shop.securitySets
            .filter((s) => s.qty > 0)
            .map((s) => ({
              name: s.name,
              qty: s.qty,
              withdrawFor: s.withdrawFor,
              barcode: JSON.stringify(s.name.includes("Security Type C") ? [] : (shop.securityBarcodes[s.id] || [])),
            })),
        };
      });

      const payload = {
        documentType: "borrowSecurityRouting",
        docCode: formData.docNumber,
        fullName: formData.fullName,
        company: formData.company,
        phone: formData.phone,
        note,
        status: "reviewing",
        borrowType,
        transactionStatus: transactionStatus || null,
        shops: draftShops,
      };

      const res = await fetch(isEdit ? `/api/document/update/${editId}` : "/api/document/create", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const r = await res.json();
      if (!r.success) throw new Error(r.message);
      toast.success("บันทึก Draft สำเร็จ!");
    } catch (e) {
      toast.error("เกิดข้อผิดพลาด");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && isEdit)
    return (
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

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="icon-container purple !w-10 !h-10">
          <Route className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">
            {isEdit ? "แก้ไขใบยืม" : "ใบยืม"} + Security Routing
          </h1>
          <p className="text-sm text-muted-foreground">เลขที่ {formData.docNumber || "รอสร้าง"}</p>
        </div>
      </div>

      {/* ข้อมูลผู้ยืม */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-container blue !w-8 !h-8">
            <User className="w-4 h-4" />
          </div>
          <h2 className="font-semibold">ข้อมูลผู้ยืม</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">เลขที่เอกสาร</label>
            <Input value={formData.docNumber} readOnly className="glass-input bg-black/5" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">ชื่อ</label>
            <Input value={formData.fullName} readOnly className="glass-input bg-black/5" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">บริษัท</label>
            <Input value={formData.company} readOnly className="glass-input bg-black/5" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">เบอร์โทร</label>
            <Input value={formData.phone} readOnly className="glass-input bg-black/5" />
          </div>
        </div>
      </div>

      {/* ประเภทการยืม */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-container cyan !w-8 !h-8">
            <ClipboardList className="w-4 h-4" />
          </div>
          <h2 className="font-semibold">
            ประเภทการยืม <span className="text-red-500">*</span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-6">
          {BORROW_TYPE_OPTIONS.map((label) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={borrowType === label}
                onCheckedChange={(checked) => setBorrowType(checked ? label : "")}
                disabled={isReadOnly}
                className="border-2 border-gray-400 data-[state=checked]:border-primary"
              />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Shops */}
      {shops.map((shop, shopIdx) => (
        <div key={shop.id} className="glass-card p-4 sm:p-5 border-l-4 border-indigo-400">
          {/* Shop header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-bold">
                {shopIdx + 1}
              </div>
              <div className="icon-container green !w-8 !h-8">
                <Store className="w-4 h-4" />
              </div>
              <h2 className="font-semibold">ร้านที่ {shopIdx + 1}</h2>
            </div>
            {!isReadOnly && shops.length > 1 && (
              <button
                onClick={() => removeShop(shop.id)}
                className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-sm flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                ลบร้านนี้
              </button>
            )}
          </div>

          {/* Shop Info */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={shop.noMcs}
                  onCheckedChange={(c) =>
                    updateShop(shop.id, { noMcs: !!c, shopCode: "", shopName: "" })
                  }
                  disabled={isReadOnly}
                />
                <span className="text-sm font-medium">NO MCS</span>
              </label>
              <div className="flex-1 relative">
                <label className="block text-xs text-muted-foreground mb-1">MCS Code</label>
                <Input
                  value={shop.shopCode}
                  onChange={(e) => {
                    updateShop(shop.id, { shopCode: e.target.value });
                    debouncedShopSearchMap(shop.id)(e.target.value);
                  }}
                  onFocus={() =>
                    shop.searchResults.length > 0 && updateShop(shop.id, { showDropdown: true })
                  }
                  onBlur={() =>
                    setTimeout(() => updateShop(shop.id, { showDropdown: false }), 200)
                  }
                  disabled={shop.noMcs || isReadOnly}
                  placeholder="MCS Code"
                  className="glass-input"
                />
                {shop.showDropdown && shop.searchResults.length > 0 && (
                  <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">
                    {shop.searchResults.map((s) => (
                      <div
                        key={s.mcsCode}
                        className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm"
                        onClick={() =>
                          updateShop(shop.id, {
                            shopCode: s.mcsCode,
                            shopName: s.shopName,
                            showDropdown: false,
                          })
                        }
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">วันที่ยืม <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  value={shop.startDate}
                  onChange={(e) => updateShop(shop.id, { startDate: e.target.value })}
                  disabled={isReadOnly}
                  className="glass-input"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">วันที่คืน <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  value={shop.endDate}
                  onChange={(e) => updateShop(shop.id, { endDate: e.target.value })}
                  disabled={isReadOnly}
                  className="glass-input"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Q7B7</label>
                <Select
                  value={shop.q7b7}
                  onValueChange={(v) => updateShop(shop.id, { q7b7: v })}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Yes / No" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Shop Focus</label>
                <Select
                  value={shop.shopFocus}
                  onValueChange={(v) => updateShop(shop.id, { shopFocus: v })}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="เลือกกลุ่ม" />
                  </SelectTrigger>
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

          {/* Assets for this shop */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="icon-container orange !w-8 !h-8">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm">Asset</h3>
                <span className="text-xs text-muted-foreground">({shop.assets.length} รายการ)</span>
                <span className="text-xs text-amber-600">(ไม่บังคับ ถ้ามี Security Set)</span>
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

            {shop.assets.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground border border-dashed border-black/10 rounded-xl">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">ไม่มี Asset</p>
              </div>
            ) : (
              <div className="space-y-3">
                {shop.assets.map((asset) => (
                  <div key={asset.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className={`${mode === "admin" ? "sm:col-span-4" : "sm:col-span-4"} relative`}>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Asset Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          value={asset.name}
                          onChange={(e) => {
                            updateAsset(shop.id, asset.id, { name: e.target.value });
                            fetchAssetNamesForShop(shop.id, e.target.value, asset.id);
                          }}
                          onFocus={() => {
                            if (shop.assetSearchResults.length > 0) {
                              updateShop(shop.id, {
                                showAssetDropdown: { ...shop.showAssetDropdown, [asset.id]: true },
                              });
                            }
                          }}
                          onBlur={() =>
                            setTimeout(() => {
                              updateShop(shop.id, {
                                showAssetDropdown: { ...shop.showAssetDropdown, [asset.id]: false },
                              });
                            }, 200)
                          }
                          placeholder="พิมพ์ชื่อ Asset..."
                          className="glass-input"
                          disabled={isReadOnly}
                        />
                        {shop.showAssetDropdown[asset.id] && shop.assetSearchResults.length > 0 && (
                          <div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">
                            {shop.assetSearchResults.map((name) => (
                              <div
                                key={name}
                                className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm"
                                onClick={() => {
                                  updateAsset(shop.id, asset.id, {
                                    name,
                                    size: "",
                                    customW: "",
                                    customD: "",
                                    customH: "",
                                    customXX: "",
                                  });
                                  fetchSizesByAssetName(shop.id, name, asset.id);
                                  updateShop(shop.id, {
                                    showAssetDropdown: { ...shop.showAssetDropdown, [asset.id]: false },
                                  });
                                }}
                              >
                                {name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className={mode === "admin" ? "sm:col-span-2" : "sm:col-span-3"}>
                        <label className="block text-xs text-muted-foreground mb-1">Size</label>
                        <Select
                          value={asset.useCustomSize ? "ไม่มีsize" : asset.size}
                          onValueChange={(v) => {
                            if (v === "ไม่มีsize") {
                              updateAsset(shop.id, asset.id, {
                                size: "",
                                useCustomSize: true,
                                customW: "",
                                customD: "",
                                customH: "",
                                customXX: "",
                              });
                            } else {
                              updateAsset(shop.id, asset.id, {
                                size: v,
                                useCustomSize: false,
                                customW: "",
                                customD: "",
                                customH: "",
                                customXX: "",
                              });
                            }
                          }}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger className="glass-input">
                            <SelectValue placeholder="เลือก" />
                          </SelectTrigger>
                          <SelectContent>
                            {(shop.sizeOptions[asset.id] || []).map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs text-muted-foreground mb-1">KV</label>
                        <Input
                          value={asset.kv}
                          onChange={(e) => updateAsset(shop.id, asset.id, { kv: e.target.value })}
                          placeholder="KV"
                          className="glass-input"
                          disabled={isReadOnly}
                        />
                      </div>

                      <div className={mode === "admin" ? "sm:col-span-1" : "sm:col-span-2"}>
                        <label className="block text-xs text-muted-foreground mb-1">จำนวน</label>
                        <Input
                          type="number"
                          min={1}
                          value={asset.qty}
                          onChange={(e) =>
                            updateAsset(shop.id, asset.id, { qty: Math.max(1, +e.target.value) })
                          }
                          className="glass-input text-center"
                          disabled={isReadOnly}
                        />
                      </div>

                      {mode === "admin" && (
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">โกดัง</label>
                          <Select
                            value={asset.withdrawFor}
                            onValueChange={(v) =>
                              updateAsset(shop.id, asset.id, { withdrawFor: v })
                            }
                          >
                            <SelectTrigger className="glass-input">
                              <SelectValue placeholder="เลือก" />
                            </SelectTrigger>
                            <SelectContent>
                              {vendors.map((v) => (
                                <SelectItem key={v} value={v}>
                                  {v}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {!isReadOnly && (
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

                    {mode === "admin" && !isReadOnly && asset.name && (
                      <div className="mt-3 p-3 rounded-lg bg-blue-50/40 border border-blue-200">
                        <label className="block text-xs text-blue-700 font-medium mb-2">
                          เลือก Barcode ที่จะเบิก (qty {asset.qty})
                        </label>
                        <BarcodeAssignSelector
                          warehouse={asset.withdrawFor}
                          assetName={asset.name}
                          qty={asset.qty}
                          value={shop.assetBarcodes[asset.id] || []}
                          onChange={(next) =>
                            updateShop(shop.id, {
                              assetBarcodes: { ...shop.assetBarcodes, [asset.id]: next },
                            })
                          }
                        />
                      </div>
                    )}

                    {asset.useCustomSize && (
                      <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-xs text-amber-700 mb-2">กรอกขนาด Custom สำหรับ {asset.name}:</p>
                        <div className="grid grid-cols-4 gap-2">
                          {(["customW", "customD", "customH", "customXX"] as const).map((field, i) => {
                            const labels = ["W (กว้าง)", "D (ลึก)", "H (สูง)", "XX (รหัส)"];
                            const placeholders = ["W", "D", "H", "XX"];
                            return (
                              <div key={field}>
                                <label className="block text-xs text-amber-600 mb-1">{labels[i]}</label>
                                <Input
                                  value={asset[field] || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updated = { ...asset, [field]: val };
                                    const newSize = `${updated.customW || ""}*${updated.customD || ""}*${updated.customH || ""}(${updated.customXX || ""})`;
                                    updateAsset(shop.id, asset.id, { [field]: val, size: newSize });
                                  }}
                                  placeholder={placeholders[i]}
                                  className="glass-input text-center text-sm"
                                  disabled={isReadOnly}
                                />
                              </div>
                            );
                          })}
                        </div>
                        {asset.size && (
                          <p className="text-xs text-amber-700 mt-2">
                            Size: <span className="font-mono font-semibold">{asset.size}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security Sets for this shop */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-container red !w-8 !h-8">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm">Security Set</h3>
            </div>
            <div className="space-y-3">
              {shop.securitySets.map((set) => (
                <div key={set.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-6">
                      <label className="block text-xs text-muted-foreground mb-1">Security Name</label>
                      <Input value={set.name} readOnly className="glass-input bg-black/5" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-muted-foreground mb-1">จำนวน</label>
                      <Input
                        type="number"
                        min={0}
                        value={set.qty}
                        onChange={(e) => {
                          const newQty = Math.max(0, +e.target.value);
                          const dv = vendors.find((v) => v === "NEWLOOK") || vendors[0] || "";
                          updateSecurity(shop.id, set.id, { qty: newQty }, dv);
                        }}
                        className="glass-input text-center"
                        disabled={isReadOnly}
                      />
                    </div>
                    {mode === "admin" && (
                      <div className="sm:col-span-4">
                        <label className="block text-xs text-muted-foreground mb-1">โกดัง</label>
                        <Select
                          value={set.withdrawFor}
                          onValueChange={(v) =>
                            updateSecurity(shop.id, set.id, { withdrawFor: v })
                          }
                        >
                          <SelectTrigger className="glass-input">
                            <SelectValue placeholder="เลือก" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.filter((v) => v?.trim()).map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  {mode === "admin" &&
                    !isReadOnly &&
                    set.qty > 0 &&
                    !set.name.includes("Security Type C") && (
                      <div className="mt-3 p-3 rounded-lg bg-purple-50/40 border border-purple-200">
                        <label className="block text-xs text-purple-700 font-medium mb-2">
                          เลือก Barcode CONTROLBOX ที่จะเบิก (qty {set.qty})
                        </label>
                        <BarcodeAssignSelector
                          warehouse={set.withdrawFor}
                          assetName={set.name}
                          qty={set.qty}
                          value={shop.securityBarcodes[set.id] || []}
                          onChange={(next) =>
                            updateShop(shop.id, {
                              securityBarcodes: { ...shop.securityBarcodes, [set.id]: next },
                            })
                          }
                          isSecuritySet
                        />
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Add Shop Button */}
      {!isReadOnly && (
        <button
          onClick={addShop}
          className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50/50 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          เพิ่มร้าน ({shops.length} ร้านแล้ว)
        </button>
      )}

      {/* Note */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-container gray !w-8 !h-8">
            <FileText className="w-4 h-4" />
          </div>
          <h2 className="font-semibold">หมายเหตุ</h2>
        </div>
        <Input
          placeholder="หมายเหตุ (ถ้ามี)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="glass-input"
          disabled={isReadOnly}
        />
      </div>

      {mode === "admin" && <OtherActivitiesSelect value={otherActivity} onChange={setOtherActivity} />}
      {mode === "admin" && <StatusSelect value={transactionStatus} onChange={setTransactionStatus} />}

      {!isReadOnly && (
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
          {mode === "admin" ? (
            <>
              <button
                disabled={isSubmitting}
                onClick={handleDraftSave}
                className="px-8 py-3 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-200 text-sm font-medium flex items-center justify-center gap-2 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? "กำลังบันทึก..." : "บันทึก Draft"}
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleOpenPreview}
                className="gradient-button px-8 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {isSubmitting ? "กำลังดำเนินการ..." : "อนุมัติ"}
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => handleSubmit("reject")}
                className="px-8 py-3 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />ปฏิเสธ
              </button>
            </>
          ) : (
            <button
              disabled={isSubmitting}
              onClick={() => handleSubmit("save")}
              className="gradient-button px-10 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? "กำลังบันทึก..." : isEdit ? "บันทึกการแก้ไข" : "บันทึก"}
            </button>
          )}
        </div>
      )}

      <PreviewApproveModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onConfirm={handleConfirmApprove}
        isSubmitting={isSubmitting}
        documentType="borrowSecurityRouting"
        documentData={{
          docCode: formData.docNumber,
          fullName: formData.fullName,
          company: formData.company,
          phone: formData.phone,
          note: note,
          vendor: userVendor,
        }}
        shopInfo={{
          shopCode: shops[0]?.shopCode || "",
          shopName: shops[0]?.shopName || "",
          startInstallDate: shops[0]?.startDate || "",
          endInstallDate: shops[0]?.endDate || "",
          q7b7: shops[0]?.q7b7 || "",
          shopFocus: shops[0]?.shopFocus || "",
        }}
        assets={[]}
        securitySets={[]}
        shops={shops.map((shop) => ({
          shopCode: shop.noMcs ? "" : shop.shopCode,
          shopName: shop.shopName,
          startInstallDate: shop.startDate,
          endInstallDate: shop.endDate,
          q7b7: shop.q7b7,
          shopFocus: shop.shopFocus,
          assets: shop.assets
            .filter((a) => a.name && a.name.trim() !== "")
            .map((a) => ({
              name: a.name,
              size: a.size,
              grade: "",
              kv: a.kv,
              qty: a.qty,
              withdrawFor: a.withdrawFor,
              assignedBarcodes: shop.assetBarcodes[a.id] || [],
            })),
          securitySets: shop.securitySets
            .filter((s) => s.qty > 0)
            .map((s) => ({
              name: s.name,
              qty: s.qty,
              withdrawFor: s.withdrawFor,
              assignedBarcodes: s.name.includes("Security Type C")
                ? []
                : shop.securityBarcodes[s.id] || [],
            })),
        }))}
      />
    </div>
  );
};

export default FormBorrowSecurityRouting;
