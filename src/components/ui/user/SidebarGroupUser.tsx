"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SidebarGroupUserProps {
  label: string;
  icon: React.ReactNode;
  items: { key: string; label: string; icon?: React.ReactNode }[];
  activeKey?: string;
  onSelect: (key: string) => void;
}

export default function SidebarGroupUser({
  label,
  icon,
  items,
  activeKey,
  onSelect,
}: SidebarGroupUserProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-1">
      {/* ปุ่มหลัก เช่น Library */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition hover:bg-muted"
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          {icon}
          {label}
        </div>

        <ChevronDown
          className={cn(
            "w-4 h-4 text-gray-500 transition-transform duration-200",
            expanded ? "rotate-180" : "rotate-0"
          )}
        />
      </button>

      {/* เมนูย่อย */}
      {expanded && (
        <div className="pl-6 mt-1 space-y-1">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition text-left",
                activeKey === item.key
                  ? "bg-black text-white"
                  : "hover:bg-gray-100 text-gray-800"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
