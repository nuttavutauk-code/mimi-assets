"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, Eye, FileText, Loader2, Plus, Save, Sparkles, Trash2, Upload, X, XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MAX_FILES_PER_JOB, MAX_TOTAL_UPLOAD_BYTES, emptyRow, type PoRowField } from "@/lib/po-tracking/constants";
import PoRowsTable, { type EditableRow } from "./PoRowsTable";

interface FileSummary {
  name: string;
  pages: string;
  documentType: "cheil_po" | "samsung_po" | "quotation" | "unknown";
  label: string;
  reason: string;
}

type Step = "select" | "processing" | "review";

interface PoJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function PoJobDialog({ open, onOpenChange, onSaved }: PoJobDialogProps) {
  const [step, setStep] = useState<Step>("select");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileSummaries, setFileSummaries] = useState<FileSummary[]>([]);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [aiRaw, setAiRaw] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("select");
    setFiles([]);
    setError(null);
    setFileSummaries([]);
    setRows([]);
    setWarnings([]);
    setAiRaw(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && (step === "processing" || saving)) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const addFiles = (incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length < Array.from(incoming).length) toast.error("รับเฉพาะไฟล์ PDF");
    setError(null);
    setFileSummaries([]);
    setFiles((prev) => {
      const merged = [...prev];
      for (const f of pdfs) {
        if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
      }
      if (merged.length > MAX_FILES_PER_JOB) toast.error(`เลือกได้สูงสุด ${MAX_FILES_PER_JOB} ไฟล์ต่อ job`);
      return merged.slice(0, MAX_FILES_PER_JOB);
    });
  };

  const previewFile = (file: File) => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const tooLarge = totalSize > MAX_TOTAL_UPLOAD_BYTES;

  const handleExtract = async () => {
    setStep("processing");
    setError(null);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/po-tracking/extract", { method: "POST", body: formData });
      const json = await res.json().catch(() => ({ success: false, message: `เซิร์ฟเวอร์ตอบกลับผิดพลาด (${res.status})` }));
      setFileSummaries(json.files ?? []);
      if (!json.success) {
        setError(json.message || "อ่านเอกสารไม่สำเร็จ");
        setStep("select");
        return;
      }
      setRows(json.rows);
      setWarnings(json.warnings ?? []);
      setAiRaw(json.aiRaw ?? null);
      setStep("review");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
      setStep("select");
    }
  };

  const handleCellChange = (rowIndex: number, field: PoRowField, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => {
      const template = prev[0] ?? {};
      const shared: EditableRow = {
        vendor: template.vendor, jobType: template.jobType, estimate: template.estimate,
        ssPo: template.ssPo, ssPoDate: template.ssPoDate, chPo: template.chPo, chPoDate: template.chPoDate,
        jobNo: template.jobNo,
      };
      return [...prev, { ...emptyRow(), ...shared }];
    });
  };

  const removeRow = (rowIndex: number) => setRows((prev) => prev.filter((_, i) => i !== rowIndex));

  const handleSave = async (continueNext: boolean) => {
    if (rows.length === 0) {
      toast.error("ต้องมีอย่างน้อย 1 แถว");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/po-tracking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, aiRaw }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "บันทึกไม่สำเร็จ");
        return;
      }
      toast.success(json.message || "บันทึกแล้ว");
      onSaved();
      reset();
      if (!continueNext) onOpenChange(false);
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const pageLabel = (s: FileSummary, docsInFile: number) => (docsInFile > 1 && s.pages ? `หน้า ${s.pages}: ` : "");

  const typeIcon = (t: FileSummary["documentType"]) =>
    t === "unknown" ? <XCircle className="w-4 h-4 text-gray-400" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`${step === "review" ? "max-w-[95vw]" : "max-w-2xl"} max-h-[92vh] overflow-y-auto`}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-600" />
            {step === "review" ? "ตรวจสอบข้อมูลก่อนบันทึก" : "อัปโหลด Job ใหม่"}
          </DialogTitle>
          <DialogDescription>
            {step === "review"
              ? "แก้ไขได้ทุกช่อง · คอลัมน์สีฟ้า = ข้อมูลที่ AI ดึงมา · สีเทา = กรอกเอง"
              : "เลือก PDF ของ job เดียวกัน: Cheil PO + Samsung PO + ใบเสนอราคา — แยกไฟล์หรือรวมเป็นไฟล์เดียวหลายหน้าก็ได้ (ระบบตรวจประเภทให้อัตโนมัติ)"}
          </DialogDescription>
        </DialogHeader>

        {step !== "review" && (
          <div className="space-y-4">
            <div
              onDragEnter={(e) => { e.preventDefault(); setIsDragActive(true); }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
              onDrop={(e) => { e.preventDefault(); setIsDragActive(false); if (step === "select") addFiles(e.dataTransfer.files); }}
              onClick={() => step === "select" && inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                step === "processing" ? "opacity-50 cursor-wait" : "cursor-pointer"
              } ${isDragActive ? "border-sky-500 bg-sky-50" : "border-gray-300 hover:border-gray-400"}`}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
              <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600 font-medium">ลากไฟล์ PDF มาวาง หรือคลิกเพื่อเลือก</p>
              <p className="text-gray-400 text-xs mt-1">สูงสุด {MAX_FILES_PER_JOB} ไฟล์ · รวมไม่เกิน 9MB · ไฟล์ที่ไม่ใช่ 3 ประเภทนี้จะถูกข้าม</p>
            </div>

            {files.length > 0 && (
              <ul className="divide-y border rounded-lg">
                {files.map((f, i) => {
                  const summaries = fileSummaries.filter((s) => s.name === f.name);
                  return (
                    <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <FileText className="w-4 h-4 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{f.name}</p>
                        {summaries.map((s) => (
                          <p key={s.pages} className="text-xs text-muted-foreground flex items-center gap-1" title={s.reason}>
                            {typeIcon(s.documentType)} {pageLabel(s, summaries.length)}{s.label}
                          </p>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => previewFile(f)} className="p-1 hover:bg-gray-100 rounded" title="เปิดดู">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setFiles((p) => p.filter((_, j) => j !== i)); setFileSummaries([]); setError(null); }}
                        disabled={step === "processing"}
                        className="p-1 hover:bg-red-50 text-red-500 rounded disabled:opacity-40"
                        title="เอาออก"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {tooLarge && <p className="text-sm text-red-600">ขนาดไฟล์รวมเกิน 9MB</p>}

            {error && (
              <div className="flex gap-2 items-start bg-red-50 text-red-700 text-sm p-3 rounded-lg">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === "processing" && (
              <div className="flex items-center justify-center gap-2 text-sm text-sky-700 bg-sky-50 p-3 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                AI กำลังอ่านเอกสาร อาจใช้เวลา 10–60 วินาที...
              </div>
            )}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {fileSummaries.map((s) => (
                <span
                  key={`${s.name}-${s.pages}`}
                  title={s.reason}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border ${
                    s.documentType === "unknown" ? "bg-gray-50 text-gray-500" : "bg-green-50 text-green-800 border-green-200"
                  }`}
                >
                  {typeIcon(s.documentType)}
                  <strong>{s.label}</strong>
                  <span className="max-w-[200px] truncate">{s.name}</span>
                  {fileSummaries.filter((o) => o.name === s.name).length > 1 && <span>หน้า {s.pages}</span>}
                  {files.find((f) => f.name === s.name) && (
                    <button onClick={() => previewFile(files.find((f) => f.name === s.name)!)} title="เปิดดู">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>

            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4" /> สิ่งที่ควรตรวจ ({warnings.length})
                </p>
                <ul className="list-disc list-inside text-xs text-amber-900 space-y-0.5">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <PoRowsTable
                rows={rows}
                editable
                onCellChange={handleCellChange}
                maxHeight="45vh"
                renderRowActions={(_, i) => (
                  <button onClick={() => removeRow(i)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="ลบแถว">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              />
            </div>
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="w-4 h-4 mr-1" /> เพิ่มแถว
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2 mt-2">
          {step === "review" ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>ยกเลิก</Button>
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> บันทึก
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                บันทึก + อัปโหลด job ถัดไป
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={step === "processing"}>ยกเลิก</Button>
              <Button onClick={handleExtract} disabled={step === "processing" || files.length === 0 || tooLarge}>
                {step === "processing" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                อ่านเอกสารด้วย AI
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
