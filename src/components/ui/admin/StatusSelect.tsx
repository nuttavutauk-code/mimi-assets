"use client";

import { useState, useEffect } from "react";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Tag } from "lucide-react";

// 19 ค่า Status
const STATUS_OPTIONS = [
    "Discarded",
    "Repairing",
    "Send to Rental warehouse",
    "Send to repair",
    "Event",
    "Lettermark",
    "QSS",
    "SAS",
    "SES",
    "SPS",
    "GDS",
    "Subdealer",
    "Temp shop",
    "VIP",
    "Office",
    "Asset Production",
    "Modify",
    "Shop to Shop",
    "Routing",
] as const;

type StatusOption = typeof STATUS_OPTIONS[number] | "";

interface StatusSelectProps {
    value: StatusOption;
    onChange: (value: StatusOption) => void;
}

const StatusSelect = ({ value, onChange }: StatusSelectProps) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // ป้องกัน Hydration mismatch
    if (!mounted) {
        return (
            <div className="glass-card p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                    <div className="icon-container blue !w-8 !h-8">
                        <Tag className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-foreground">Status</h3>
                    <span className="text-red-500">*</span>
                </div>
                <div className="h-11 rounded-xl bg-black/5 flex items-center px-3">
                    <span className="text-muted-foreground text-sm">เลือก Status</span>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
                <div className="icon-container blue !w-8 !h-8">
                    <Tag className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-foreground">Status</h3>
                <span className="text-red-500">*</span>
            </div>
            <Select
                value={value || ""}
                onValueChange={(val) => onChange(val as StatusOption)}
            >
                <SelectTrigger className="h-11 glass-input">
                    <SelectValue placeholder="เลือก Status (บังคับ)" />
                </SelectTrigger>
                <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                            {option}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
                * บังคับเลือก - จะบันทึกลงคอลัมน์ Status ใน Transaction History
            </p>
        </div>
    );
};

export default StatusSelect;
export type { StatusOption };
export { STATUS_OPTIONS };