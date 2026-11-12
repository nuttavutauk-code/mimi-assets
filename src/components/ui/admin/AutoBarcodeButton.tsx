"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";

interface AutoBarcodeButtonProps {
  onAuto: () => Promise<void> | void;
  disabled?: boolean;
}

// ปุ่ม "Auto" เลือก Barcode อัตโนมัติ (วางข้างปุ่มถังขยะ)
export default function AutoBarcodeButton({ onAuto, disabled }: AutoBarcodeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onAuto();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      title="เลือกโกดังและ Barcode อัตโนมัติ"
      className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center gap-1 text-xs font-medium disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
      Auto
    </button>
  );
}
