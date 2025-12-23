"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Trash2, User, Package, FileText, Save, CheckCircle, XCircle, Loader2, Wrench, Calendar } from "lucide-react";
import { toast } from "sonner";
import OtherActivitiesSelect, { OtherActivity } from "@/components/ui/admin/OtherActivitiesSelect";
import debounce from "lodash.debounce";
import { getMe } from "./loader";

type AssetRow = { id: number; barcode: string; name: string; size: string; grade: string; qty: number };
type FormMode = "user" | "admin";
type SubmitAction = "save" | "approve" | "reject";

const FormRepair = ({ mode = "user" }: { mode?: FormMode }) => {
  const { data } = useSession();
  const router = useRouter();
  const params = useParams();
  const editIdFromUrl = Array.isArray(params.id) ? params.id[0] : params.id;

  const [isEdit, setIsEdit] = useState(!!editIdFromUrl);
  const [editId, setEditId] = useState<string | null>(editIdFromUrl || null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [docStatus, setDocStatus] = useState("");
  const assetIdCounter = useRef(1);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ docNumber: "", fullName: "", company: "", phone: "" });
  const [assets, setAssets] = useState<AssetRow[]>([{ id: assetIdCounter.current++, barcode: "", name: "", size: "", grade: "", qty: 1 }]);
  const [userVendor, setUserVendor] = useState<string>("");
  const [sizeOptions, setSizeOptions] = useState<Record<number, string[]>>({});
  const [barcodeSearchResults, setBarcodeSearchResults] = useState<{ barcode: string; assetName: string; size?: string }[]>([]);
  const [showBarcodeDropdown, setShowBarcodeDropdown] = useState<Record<number, boolean>>({});
  const [repairDate, setRepairDate] = useState<string>("");
  const [note, setNote] = useState("");
  const [otherActivity, setOtherActivity] = useState<OtherActivity>("");

  const fetchBarcodes = async (query: string, rowId: number) => {
    // ✅ ล้าง name และ size เมื่อกำลังค้นหาใหม่
    setAssets(p => p.map(a => a.id === rowId ? { ...a, name: "", size: "" } : a));
    
    if (!userVendor) { setBarcodeSearchResults([]); setShowBarcodeDropdown(p => ({ ...p, [rowId]: false })); return; }
    try {
      // ✅ ใช้ searchByBarcode API + balanceFilter=1 + warehouse (ค้นหา Barcode ที่อยู่ในโกดังของตัวเอง)
      const res = await fetch(`/api/asset/searchByBarcode?query=${encodeURIComponent(query)}&balanceFilter=1&warehouse=${encodeURIComponent(userVendor)}`);
      const json = await res.json();
      const barcodes = json.assets || []; setBarcodeSearchResults(barcodes); setShowBarcodeDropdown(p => ({ ...p, [rowId]: true }));
    } catch (err) { console.error(err); }
  };

  const debouncedBarcodeSearch = useMemo(() => debounce(fetchBarcodes, 300), [userVendor]);

  const handleBarcodeSelect = (rowId: number, selected: { barcode: string; assetName: string; size?: string }) => {
    setAssets(p => p.map(a => a.id === rowId ? { ...a, barcode: selected.barcode, name: selected.assetName, size: selected.size || "" } : a));
    setShowBarcodeDropdown(p => ({ ...p, [rowId]: false }));
  };

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
            if (shop.startInstallDate) setRepairDate(new Date(shop.startInstallDate).toISOString().split('T')[0]);
            if (shop.assets?.length > 0) {
              setAssets(shop.assets.map((a: any, idx: number) => ({ id: idx + 1, barcode: a.barcode || "", name: a.name || "", size: a.size || "", grade: a.grade || "", qty: a.qty || 1 })));
              assetIdCounter.current = shop.assets.length + 1;
            }
          }
          setNote(doc.note || "");
        }
        setDataLoaded(true);
      } catch (err) { console.error(err); toast.error("โหลดข้อมูลไม่สำเร็จ"); }
      finally { setLoading(false); }
    };
    loadExisting();
  }, [editIdFromUrl, dataLoaded]);

  useEffect(() => {
    if (dataLoaded || isEdit) return;
    const initForm = async () => {
      try {
        const me = await getMe(data?.user?.email ?? "");
        const res = await fetch("/api/document/generate");
        const json = await res.json();
        setFormData({ docNumber: json.docCode || "", fullName: `${me?.user?.firstName || ""} ${me?.user?.lastName || ""}`.trim() || "", company: me?.user?.company || "", phone: me?.user?.phone || "" });
        setUserVendor(me?.user?.vendor || "");
      } catch (err) { console.error(err); }
    };
    initForm();
  }, [dataLoaded, isEdit]);

  const handleSubmit = async (action: SubmitAction) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // ✅ Validation: ต้องเลือกวันที่ส่งซ่อม
      if (!repairDate) {
        toast.error("กรุณาเลือกวันที่ส่งซ่อม");
        return;
      }
      
      // ✅ Validation: ต้องมี Barcode อย่างน้อย 1 รายการ
      if (assets.length === 0 || !assets.some(a => a.barcode.trim())) {
        toast.error("กรุณาเพิ่ม Barcode อย่างน้อย 1 รายการ");
        return;
      }

      if (action === "approve" && isEdit && editId) {
        // ✅ บันทึกข้อมูลก่อน
        const updatePayload = {
          documentType: "repair", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "submitted",
          shops: [{ shopCode: "", shopName: "", startInstallDate: repairDate, assets: assets.map(a => ({ barcode: a.barcode, name: a.name, size: a.size || null, grade: a.grade || null, qty: a.qty })) }],
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
        const rejectPayload = {
          documentType: "repair", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "rejected",
          shops: [{ shopCode: "", shopName: "", startInstallDate: repairDate, assets: assets.map(a => ({ barcode: a.barcode, name: a.name, size: a.size || null, grade: a.grade || null, qty: a.qty })) }],
        };
        const res = await fetch(`/api/document/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rejectPayload) });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        toast.success("ปฏิเสธสำเร็จ!"); router.push("/dashboard/admin-list"); return;
      }
      const payload = {
        documentType: "repair", docCode: formData.docNumber, fullName: formData.fullName, company: formData.company, phone: formData.phone, note, status: "submitted",
        shops: [{ shopCode: "", shopName: "", startInstallDate: repairDate, assets: assets.map(a => ({ barcode: a.barcode, name: a.name, size: a.size || null, grade: a.grade || null, qty: a.qty })) }],
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
  const isViewMode = docStatus === "submitted" && mode === "admin"; // Admin กำลังดูเอกสารเพื่ออนุมัติ

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
        <div className="icon-container red !w-10 !h-10"><Wrench className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{isEdit ? "แก้ไขใบแจ้งซ่อม" : "ใบแจ้งซ่อม"}</h1>
          <p className="text-sm text-muted-foreground">เลขที่ {formData.docNumber || "รอสร้าง"}</p>
        </div>
      </div>

      {/* ข้อมูลผู้ส่งซ่อม */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container blue !w-8 !h-8"><User className="w-4 h-4" /></div><h2 className="font-semibold text-foreground">ข้อมูลผู้ส่งซ่อม</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="block text-xs font-medium text-muted-foreground mb-1">เลขที่เอกสาร</label><Input value={formData.docNumber} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1">ชื่อผู้ส่งซ่อม</label><Input value={formData.fullName} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1">บริษัท</label><Input value={formData.company} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs font-medium text-muted-foreground mb-1">เบอร์โทรศัพท์</label><Input value={formData.phone} readOnly className="glass-input bg-black/5" /></div>
        </div>
      </div>

      {/* วันที่ส่งซ่อม */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container orange !w-8 !h-8"><Calendar className="w-4 h-4" /></div><h2 className="font-semibold text-foreground">วันที่ส่งซ่อม</h2></div>
        <div className="max-w-xs"><Input type="date" value={repairDate} onChange={(e) => setRepairDate(e.target.value)} className="glass-input" /></div>
      </div>

      {/* Asset */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><div className="icon-container purple !w-8 !h-8"><Package className="w-4 h-4" /></div><h2 className="font-semibold text-foreground">Asset ที่ส่งซ่อม</h2><span className="text-xs text-muted-foreground">({assets.length}/6)</span></div>
          {assets.length < 6 && <button onClick={() => setAssets([...assets, { id: assetIdCounter.current++, barcode: "", name: "", size: "", grade: "", qty: 1 }])} className="glass-button px-3 py-2 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />เพิ่ม</button>}
        </div>
        <div className="space-y-3">
          {assets.map((asset, idx) => (
            <div key={asset.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3 relative">
                  <label className="block text-xs text-muted-foreground mb-1">Barcode <span className="text-red-500">*</span></label>
                  <Input value={asset.barcode} onChange={(e) => { if (!isViewMode) { setAssets(p => p.map(a => a.id === asset.id ? { ...a, barcode: e.target.value } : a)); debouncedBarcodeSearch(e.target.value, asset.id); } }} onFocus={() => { if (!isViewMode) fetchBarcodes(asset.barcode, asset.id); }} onBlur={() => setTimeout(() => setShowBarcodeDropdown(p => ({ ...p, [asset.id]: false })), 200)} placeholder="พิมพ์ Barcode..." className={`glass-input ${isViewMode ? "bg-black/5" : ""}`} readOnly={isViewMode} />
                  {showBarcodeDropdown[asset.id] && barcodeSearchResults.length > 0 && (<div className="absolute top-full left-0 z-20 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">{barcodeSearchResults.map((item) => (<div key={item.barcode} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => handleBarcodeSelect(asset.id, item)}><span className="font-mono text-primary">{item.barcode}</span> - {item.assetName}</div>))}</div>)}
                </div>
                <div className="sm:col-span-4"><label className="block text-xs text-muted-foreground mb-1">Asset Name</label><Input value={asset.name} readOnly className="glass-input bg-black/5" /></div>
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">Size</label><Input value={asset.size} readOnly className="glass-input bg-black/5" /></div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Grade</label>
                  <Select value={asset.grade} onValueChange={(v) => setAssets(p => p.map(a => a.id === asset.id ? { ...a, grade: v } : a))}><SelectTrigger className="glass-input"><SelectValue placeholder="เลือก" /></SelectTrigger><SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="AB">AB</SelectItem><SelectItem value="B">B</SelectItem><SelectItem value="BC">BC</SelectItem><SelectItem value="C">C</SelectItem><SelectItem value="CD">CD</SelectItem><SelectItem value="D">D</SelectItem></SelectContent></Select>
                </div>
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

export default FormRepair;