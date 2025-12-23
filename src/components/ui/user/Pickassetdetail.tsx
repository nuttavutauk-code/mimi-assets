"use client";

import { useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Camera, Package, Store, User, Shield, Save, ArrowLeft } from "lucide-react";
import debounce from "lodash.debounce";
import { useRouter } from "next/navigation";

const mockTask = {
  id: 1, docCode: "DP2501101", requesterName: "นางสาว อภิญญพร", requesterCompany: "บริษัท รักไทย 65 จำกัด", requesterPhone: "093-902-9588",
  noMcs: false, mcsCode: "C005610782", shopName: "CHIN MOBILE2 (TESCO LOTUS)", startInstallDate: "15/08/2025", endInstallDate: "25/08/2025", q7b7: "Yes", shopFocus: "1. Flagship",
  assets: [{ id: 1, assetName: "Smart Table M22", qty: 1, barcode: "" }, { id: 2, assetName: "Smart Table M22", qty: 1, barcode: "" }],
  securitySets: [{ id: 1, assetName: "CONTROLBOX 6 PORT", qty: 1, barcode: "" }, { id: 2, assetName: "Security Type C Ver.7.1", qty: 1, barcode: "" }],
};

export default function PickAssetDetail() {
  const router = useRouter();
  const [task, setTask] = useState(mockTask);
  const [barcodeResults, setBarcodeResults] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState<Record<number, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);

  const fetchBarcodes = async (query: string, itemId: number, assetName: string) => {
    if (!query) { setBarcodeResults([]); setShowDropdown(p => ({ ...p, [itemId]: false })); return; }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const res = await fetch(`/api/pick-asset/available-barcodes?search=${query}&assetName=${assetName}`, { signal: controller.signal });
      const data = await res.json();
      if (data.success) { setBarcodeResults(data.assets?.map((a: any) => a.barcode) || []); setShowDropdown(p => ({ ...p, [itemId]: true })); }
    } catch (err) { if ((err as any)?.name !== "AbortError") console.error(err); }
  };
  const debouncedFetch = useMemo(() => debounce(fetchBarcodes, 300), []);

  const selectBarcode = (type: "asset" | "security", id: number, barcode: string) => {
    if (type === "asset") setTask(p => ({ ...p, assets: p.assets.map(a => a.id === id ? { ...a, barcode } : a) }));
    else setTask(p => ({ ...p, securitySets: p.securitySets.map(s => s.id === id ? { ...s, barcode } : s) }));
    setShowDropdown(p => ({ ...p, [id]: false }));
  };

  const changeBarcode = (type: "asset" | "security", id: number, value: string, assetName: string) => {
    if (type === "asset") setTask(p => ({ ...p, assets: p.assets.map(a => a.id === id ? { ...a, barcode: value } : a) }));
    else setTask(p => ({ ...p, securitySets: p.securitySets.map(s => s.id === id ? { ...s, barcode: value } : s) }));
    debouncedFetch(value, id, assetName);
  };

  const BarcodeInput = ({ type, item, idx }: { type: "asset" | "security"; item: any; idx: number }) => (
    <div className="relative">
      <Input placeholder="พิมพ์ Barcode..." value={item.barcode} onChange={(e) => changeBarcode(type, item.id, e.target.value, item.assetName)}
        onFocus={() => barcodeResults.length > 0 && setShowDropdown(p => ({ ...p, [item.id]: true }))}
        onBlur={() => setTimeout(() => setShowDropdown(p => ({ ...p, [item.id]: false })), 180)} className="glass-input" />
      {showDropdown[item.id] && barcodeResults.length > 0 && (
        <div className="absolute top-full left-0 z-10 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-auto">
          {barcodeResults.map(bc => (<div key={bc} className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm" onClick={() => selectBarcode(type, item.id, bc)}>{bc}</div>))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-black/5"><ArrowLeft className="w-5 h-5" /></button>
          <div><h1 className="text-xl sm:text-2xl font-semibold">Pick Asset</h1><p className="text-sm text-muted-foreground">{task.docCode}</p></div>
        </div>
        <button onClick={() => alert("บันทึกสำเร็จ!")} className="gradient-button px-5 py-2.5 text-sm font-medium flex items-center gap-2"><Save className="w-4 h-4" />บันทึก</button>
      </div>

      {/* ข้อมูลผู้เบิก */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container blue !w-8 !h-8"><User className="w-4 h-4" /></div><h2 className="font-semibold">ข้อมูลผู้เบิก</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className="block text-xs text-muted-foreground mb-1">เอกสาร</label><Input value={task.docCode} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">ชื่อผู้เบิก</label><Input value={task.requesterName} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">บริษัท</label><Input value={task.requesterCompany} readOnly className="glass-input bg-black/5" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">เบอร์โทร</label><Input value={task.requesterPhone} readOnly className="glass-input bg-black/5" /></div>
        </div>
      </div>

      {/* ข้อมูล Shop */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container green !w-8 !h-8"><Store className="w-4 h-4" /></div><h2 className="font-semibold">ข้อมูล Shop</h2></div>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex items-center gap-2"><Checkbox checked={task.noMcs} disabled /><label className="text-sm">NO MCS</label></div>
            <div className="flex-1"><label className="block text-xs text-muted-foreground mb-1">MCS Code</label><Input value={task.mcsCode} readOnly className="glass-input bg-black/5" /></div>
            <div className="flex-[2]"><label className="block text-xs text-muted-foreground mb-1">Shop Name</label><Input value={task.shopName} readOnly className="glass-input bg-black/5" /></div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label className="block text-xs text-muted-foreground mb-1">เริ่มติดตั้ง</label><Input value={task.startInstallDate} readOnly className="glass-input bg-black/5" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">ติดตั้งเสร็จ</label><Input value={task.endInstallDate} readOnly className="glass-input bg-black/5" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Q7B7</label><Input value={task.q7b7} readOnly className="glass-input bg-black/5" /></div>
            <div><label className="block text-xs text-muted-foreground mb-1">Shop Focus</label><Input value={task.shopFocus} readOnly className="glass-input bg-black/5" /></div>
          </div>
        </div>
      </div>

      {/* Asset */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container orange !w-8 !h-8"><Package className="w-4 h-4" /></div><h2 className="font-semibold">Asset</h2></div>
        <div className="space-y-3">
          {task.assets.map((asset, idx) => (
            <div key={asset.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div><label className="block text-xs text-muted-foreground mb-1">Barcode #{idx + 1}</label><BarcodeInput type="asset" item={asset} idx={idx} /></div>
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">Asset Name</label><Input value={asset.assetName} readOnly className="glass-input bg-black/5" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">จำนวน</label><Input value={asset.qty} readOnly className="glass-input bg-black/5 text-center" /></div>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium flex items-center justify-center gap-1"><Camera className="w-4 h-4" />ถ่าย Barcode</button>
                <button className="flex-1 py-2 rounded-lg bg-green-50 text-green-600 text-sm font-medium flex items-center justify-center gap-1"><Camera className="w-4 h-4" />ถ่าย Asset</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security Set */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4"><div className="icon-container purple !w-8 !h-8"><Shield className="w-4 h-4" /></div><h2 className="font-semibold">Security Set</h2></div>
        <div className="space-y-3">
          {task.securitySets.map((sec, idx) => (
            <div key={sec.id} className="p-4 rounded-xl bg-black/2 border border-black/5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div><label className="block text-xs text-muted-foreground mb-1">Barcode #{idx + 1}</label><BarcodeInput type="security" item={sec} idx={idx} /></div>
                <div className="sm:col-span-2"><label className="block text-xs text-muted-foreground mb-1">Asset Name</label><Input value={sec.assetName} readOnly className="glass-input bg-black/5" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">จำนวน</label><Input value={sec.qty} readOnly className="glass-input bg-black/5 text-center" /></div>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium flex items-center justify-center gap-1"><Camera className="w-4 h-4" />ถ่าย Barcode</button>
                <button className="flex-1 py-2 rounded-lg bg-purple-50 text-purple-600 text-sm font-medium flex items-center justify-center gap-1"><Camera className="w-4 h-4" />ถ่าย Security</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Save Button */}
      <div className="sm:hidden">
        <button onClick={() => alert("บันทึกสำเร็จ!")} className="w-full gradient-button py-3 text-sm font-medium flex items-center justify-center gap-2"><Save className="w-4 h-4" />บันทึกข้อมูล</button>
      </div>
    </div>
  );
}
