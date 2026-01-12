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
import { TRANSACTION_STATUS_OPTIONS } from "@/constants/transactionStatus";

interface TransactionStatusSelectProps {
    value: string;
    onChange: (value: string) => void;
}

const TransactionStatusSelect = ({ value, onChange }: TransactionStatusSelectProps) => {
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
                    <h3 className="font-semibold text-foreground">Transaction Status</h3>
                    <span className="text-red-500">*</span>
                </div>
                <div className="h-11 rounded-xl bg-black/5 flex items-center px-3">
                    <span className="text-muted-foreground text-sm">เลือก Status สำหรับบันทึก Transaction</span>
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
                <h3 className="font-semibold text-foreground">Transaction Status</h3>
                <span className="text-red-500">*</span>
            </div>
            <Select
                value={value || ""}
                onValueChange={(val) => onChange(val)}
            >
                <SelectTrigger className="h-11 glass-input">
                    <SelectValue placeholder="เลือก Status สำหรับบันทึก Transaction" />
                </SelectTrigger>
                <SelectContent>
                    {TRANSACTION_STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                            {status}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
                * ค่านี้จะถูกบันทึกลงคอลัมน์ Status ใน Asset Database
            </p>
        </div>
    );
};

export default TransactionStatusSelect;