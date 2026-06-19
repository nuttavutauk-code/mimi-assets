"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import debounce from "lodash.debounce";

interface BarcodeOption {
  barcode: string;
  assetName: string;
  size: string | null;
}

interface BarcodeAssignSelectorProps {
  warehouse: string;
  assetName: string;
  qty: number;
  value: string[]; // length must equal qty
  onChange: (next: string[]) => void;
  isSecuritySet?: boolean;
  disabled?: boolean;
}

const BarcodeAssignSelector = ({
  warehouse,
  assetName,
  qty,
  value,
  onChange,
  isSecuritySet = false,
  disabled = false,
}: BarcodeAssignSelectorProps) => {
  // Ensure value array length === qty
  useEffect(() => {
    if (value.length !== qty) {
      const next = Array.from({ length: qty }, (_, i) => value[i] || "");
      onChange(next);
    }
  }, [qty, value, onChange]);

  const handleSlotChange = (idx: number, barcode: string) => {
    const next = [...value];
    while (next.length < qty) next.push("");
    next[idx] = barcode;
    onChange(next);
  };

  if (!warehouse || !assetName) {
    return (
      <p className="text-xs text-amber-600">เลือก Asset Name และ โกดัง ก่อน</p>
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: qty }).map((_, idx) => (
        <BarcodeSlot
          key={idx}
          slotIndex={idx}
          warehouse={warehouse}
          assetName={assetName}
          isSecuritySet={isSecuritySet}
          value={value[idx] || ""}
          excludeBarcodes={value.filter((b, i) => i !== idx && b)}
          onChange={(bc) => handleSlotChange(idx, bc)}
          disabled={disabled}
        />
      ))}
    </div>
  );
};

interface BarcodeSlotProps {
  slotIndex: number;
  warehouse: string;
  assetName: string;
  isSecuritySet: boolean;
  value: string;
  excludeBarcodes: string[];
  onChange: (barcode: string) => void;
  disabled?: boolean;
}

const BarcodeSlot = ({
  slotIndex,
  warehouse,
  assetName,
  isSecuritySet,
  value,
  excludeBarcodes,
  onChange,
  disabled,
}: BarcodeSlotProps) => {
  const [input, setInput] = useState(value);
  const [options, setOptions] = useState<BarcodeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setInput(value);
  }, [value]);

  const fetchOptions = useCallback(
    async (query: string) => {
      if (!warehouse || !assetName) return;
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          warehouse,
          balanceFilter: "1",
          excludeAssigned: "true",
          assetName,
        });
        if (isSecuritySet) params.append("isSecuritySet", "true");
        if (query) params.append("query", query);
        const res = await fetch(`/api/asset/searchByBarcode?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        const assets: BarcodeOption[] = json.assets || [];
        setOptions(assets);
      } catch (err) {
        if ((err as any)?.name !== "AbortError") console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [warehouse, assetName, isSecuritySet]
  );

  // Keep ref current so debounce always calls the latest fetchOptions (avoids stale closure)
  const fetchOptionsRef = useRef(fetchOptions);
  useEffect(() => {
    fetchOptionsRef.current = fetchOptions;
  }, [fetchOptions]);

  const debouncedFetch = useRef(debounce((query: string) => fetchOptionsRef.current(query), 250)).current;

  useEffect(() => {
    return () => debouncedFetch.cancel?.();
  }, [debouncedFetch]);

  // Clear stale options when warehouse changes
  useEffect(() => {
    setOptions([]);
  }, [warehouse]);

  const handleFocus = () => {
    setOpen(true);
    if (options.length === 0) fetchOptions("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInput(v);
    setOpen(true);
    debouncedFetch(v);
  };

  const handleSelect = (barcode: string) => {
    setInput(barcode);
    setOpen(false);
    onChange(barcode);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setOpen(false);
      if (input !== value) onChange(input);
    }, 200);
  };

  const filtered = options.filter((o) => !excludeBarcodes.includes(o.barcode));

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input
          value={input}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={`Barcode #${slotIndex + 1}`}
          className="glass-input pl-8 pr-8 text-sm h-9"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
        )}
      </div>
      {open && !disabled && (
        <div className="absolute top-full left-0 z-30 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-56 overflow-auto">
          {loading ? (
            <div className="px-3 py-2 text-xs text-gray-500 text-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-2" />
              กำลังโหลด...
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((opt) => (
              <div
                key={opt.barcode}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt.barcode);
                }}
              >
                <div className="font-mono text-gray-900">{opt.barcode}</div>
                {opt.size && (
                  <div className="text-xs text-gray-500">Size: {opt.size}</div>
                )}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-gray-500 text-center">
              ไม่พบ Barcode ในโกดัง {warehouse}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BarcodeAssignSelector;
