"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Settings2 } from "lucide-react";

type OtherActivity = "" | "outToRentalWarehouse" | "inToRentalWarehouse" | "discarded" | "adjustError";

interface OtherActivitiesSelectProps {
  value: OtherActivity;
  onChange: (value: OtherActivity) => void;
}

const OtherActivitiesSelect = ({ value, onChange }: OtherActivitiesSelectProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ป้องกัน Hydration mismatch
  if (!mounted) {
    return (
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="icon-container orange !w-8 !h-8">
            <Settings2 className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-foreground">Other Activities</h3>
        </div>
        <div className="h-11 rounded-xl bg-black/5 flex items-center px-3">
          <span className="text-muted-foreground text-sm">เลือก Other Activity (ไม่บังคับ)</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          * ถ้าเลือก จะบันทึก WK ในคอลัมน์ที่เลือกแทน Logic ปกติ
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="icon-container orange !w-8 !h-8">
          <Settings2 className="w-4 h-4" />
        </div>
        <h3 className="font-semibold text-foreground">Other Activities</h3>
      </div>
      <Select
        value={value || "none"}
        onValueChange={(val) => onChange(val === "none" ? "" : val as OtherActivity)}
      >
        <SelectTrigger className="h-11 glass-input">
          <SelectValue placeholder="เลือก Other Activity (ไม่บังคับ)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">— ไม่เลือก (ใช้ Logic ปกติ) —</span>
          </SelectItem>
          <SelectItem value="outToRentalWarehouse">Out to Rental WH</SelectItem>
          <SelectItem value="inToRentalWarehouse">In to Rental WH</SelectItem>
          <SelectItem value="discarded">Discarded</SelectItem>
          <SelectItem value="adjustError">Adjust Error</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground mt-2">
        * ถ้าเลือก จะบันทึก WK ในคอลัมน์ที่เลือกแทน Logic ปกติ
      </p>
    </div>
  );
};

export default OtherActivitiesSelect;
export type { OtherActivity };
