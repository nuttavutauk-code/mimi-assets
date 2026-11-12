"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { isControlboxName } from "@/lib/autoBarcodeClient";

interface Rule {
  id: number;
  assetName: string;
  warehouse1: string;
  warehouse2: string | null;
  isSecuritySet: boolean;
}

const CONTROLBOX_NAMES = [
  "CONTROLBOX 6 PORT (M-60000R) with power cable",
  "CONTROLBOX 5 PORT (M-50000R) with power cable",
];

const NONE = "__none__";

type FormState = { id?: number; assetName: string; warehouse1: string; warehouse2: string };
const emptyForm: FormState = { assetName: "", warehouse1: "", warehouse2: NONE };

export default function AdminAutoBarcodeRule() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendors, setVendors] = useState<string[]>([]);
  const [assetNames, setAssetNames] = useState<string[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showNameList, setShowNameList] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auto-barcode-rule");
      const json = await res.json();
      if (res.ok && json.success) setRules(json.rules);
      else toast.error(json.message || "โหลดข้อมูลไม่สำเร็จ");
    } catch {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    fetch("/api/vendor/list")
      .then((r) => r.json())
      .then((j) => setVendors((j.vendors || []).filter((v: string) => v?.trim())))
      .catch(() => {});
    fetch("/api/asset/names")
      .then((r) => r.json())
      .then((j) => setAssetNames(j.names || []))
      .catch(() => {});
  }, []);

  const allNames = useMemo(() => {
    const set = new Set<string>([...assetNames, ...CONTROLBOX_NAMES]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [assetNames]);

  const configuredNames = useMemo(() => new Set(rules.map((r) => r.assetName)), [rules]);

  const nameSuggestions = useMemo(() => {
    const q = form.assetName.trim().toLowerCase();
    return allNames
      .filter((n) => !configuredNames.has(n) || n === rules.find((r) => r.id === form.id)?.assetName)
      .filter((n) => !q || n.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allNames, configuredNames, form.assetName, form.id, rules]);

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter(
      (r) =>
        r.assetName.toLowerCase().includes(q) ||
        r.warehouse1.toLowerCase().includes(q) ||
        (r.warehouse2 || "").toLowerCase().includes(q)
    );
  }, [rules, search]);

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (rule: Rule) => {
    setForm({ id: rule.id, assetName: rule.assetName, warehouse1: rule.warehouse1, warehouse2: rule.warehouse2 || NONE });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const assetName = form.assetName.trim();
    const warehouse2 = form.warehouse2 === NONE ? null : form.warehouse2;
    if (!assetName) return toast.error("กรุณาระบุ Asset Name");
    if (!form.warehouse1) return toast.error("กรุณาเลือกโกดังลำดับที่ 1");
    if (warehouse2 && warehouse2 === form.warehouse1) return toast.error("โกดังลำดับที่ 1 และ 2 ต้องไม่ซ้ำกัน");

    setSaving(true);
    try {
      const res = await fetch("/api/auto-barcode-rule", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          assetName,
          warehouse1: form.warehouse1,
          warehouse2,
          isSecuritySet: isControlboxName(assetName),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(form.id ? "แก้ไขเรียบร้อย" : "เพิ่มเรียบร้อย");
        setDialogOpen(false);
        fetchRules();
      } else {
        toast.error(json.message || "บันทึกไม่สำเร็จ");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/auto-barcode-rule?id=${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("ลบเรียบร้อย");
        setDeleteTarget(null);
        fetchRules();
      } else {
        toast.error(json.message || "ลบไม่สำเร็จ");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setDeleting(false);
    }
  };

  const warehouseOptions = vendors;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-container blue !w-10 !h-10"><Wand2 className="w-5 h-5" /></div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">ตั้งค่า Auto Barcode</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            กำหนดโกดังที่ใช้เลือก Barcode อัตโนมัติสำหรับแต่ละ Asset Name (ลำดับ 1 → ลำดับ 2)
          </p>
        </div>
        <button onClick={openCreate} className="gradient-button px-5 py-2.5 text-sm font-medium flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />เพิ่มรายการ
        </button>
      </div>

      {/* Rule explanation */}
      <div className="glass-card p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">เงื่อนไขการเลือก Barcode เมื่อกดปุ่ม Auto</p>
        <p>1. Balance ต้องเป็น 1 (ของยังอยู่ในโกดัง)</p>
        <p>2. Asset Status เป็น NEW ก่อน ถ้าไม่มีค่อยเลือก REFURBISHED</p>
        <p>3. In Stock Date ใหม่ที่สุดก่อน</p>
        <p>ถ้าแถวมีการเลือก Size ไว้ จะเลือกเฉพาะ Barcode ที่ Size ตรงกัน • ถ้าโกดัง 1 มีไม่พอ จะแบ่งแถวไปใช้โกดัง 2</p>
      </div>

      {/* Search */}
      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input placeholder="ค้นหา Asset Name, โกดัง..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 glass-input" />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : filteredRules.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Wand2 className="w-12 h-12 mx-auto mb-3 opacity-30" />ยังไม่มีการตั้งค่า</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="glass-table w-full">
              <thead>
                <tr className="bg-black/2">
                  <th>ASSET NAME</th>
                  <th>ประเภท</th>
                  <th>โกดังลำดับ 1</th>
                  <th>โกดังลำดับ 2</th>
                  <th className="text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="font-medium">{rule.assetName}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${rule.isSecuritySet ? "bg-purple-50 text-purple-600" : "bg-orange-50 text-orange-600"}`}>
                        {rule.isSecuritySet ? "CONTROLBOX" : "Asset"}
                      </span>
                    </td>
                    <td>{rule.warehouse1}</td>
                    <td>{rule.warehouse2 || "-"}</td>
                    <td>
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openEdit(rule)} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="แก้ไข">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(rule)} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100" title="ลบ">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "แก้ไขการตั้งค่า" : "เพิ่มการตั้งค่า"}</DialogTitle>
            <DialogDescription>เลือก Asset Name และโกดังที่ต้องการให้ระบบเลือก Barcode ตามลำดับ</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Asset Name <span className="text-red-500">*</span></label>
              <Input
                value={form.assetName}
                onChange={(e) => { setForm((f) => ({ ...f, assetName: e.target.value })); setShowNameList(true); }}
                onFocus={() => setShowNameList(true)}
                onBlur={() => setTimeout(() => setShowNameList(false), 200)}
                placeholder="พิมพ์เพื่อค้นหา Asset Name..."
                className="glass-input"
              />
              {showNameList && nameSuggestions.length > 0 && (
                <div className="absolute top-full left-0 z-50 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-56 overflow-auto">
                  {nameSuggestions.map((name) => (
                    <div
                      key={name}
                      className="px-3 py-2 hover:bg-black/5 cursor-pointer text-sm"
                      onMouseDown={(e) => { e.preventDefault(); setForm((f) => ({ ...f, assetName: name })); setShowNameList(false); }}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              )}
              {isControlboxName(form.assetName) && (
                <p className="text-xs text-purple-600 mt-1">CONTROLBOX — จะเลือก Barcode จากข้อมูล Security Set</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">โกดังลำดับ 1 <span className="text-red-500">*</span></label>
              <Select value={form.warehouse1} onValueChange={(v) => setForm((f) => ({ ...f, warehouse1: v }))}>
                <SelectTrigger className="glass-input"><SelectValue placeholder="เลือกโกดัง" /></SelectTrigger>
                <SelectContent>
                  {warehouseOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">โกดังลำดับ 2</label>
              <Select value={form.warehouse2} onValueChange={(v) => setForm((f) => ({ ...f, warehouse2: v }))}>
                <SelectTrigger className="glass-input"><SelectValue placeholder="ไม่ระบุ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>- ไม่ระบุ -</SelectItem>
                  {warehouseOptions.filter((v) => v !== form.warehouse1).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <button onClick={() => setDialogOpen(false)} disabled={saving} className="glass-button px-5 py-2.5 text-sm font-medium">ยกเลิก</button>
            <button onClick={handleSave} disabled={saving} className="gradient-button px-5 py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}บันทึก
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>ลบการตั้งค่าของ &quot;{deleteTarget?.assetName}&quot; ใช่หรือไม่?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="glass-button px-5 py-2.5 text-sm font-medium">ยกเลิก</button>
            <button onClick={handleDelete} disabled={deleting} className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-600 disabled:opacity-50">
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}ลบ
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
