"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface SimplePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function SimplePagination({ currentPage, totalPages, onPageChange, disabled = false }: SimplePaginationProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
        className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <select
        value={currentPage}
        onChange={(e) => onPageChange(Number(e.target.value))}
        disabled={disabled || totalPages <= 1}
        className="border border-black/10 rounded-lg text-sm px-2 py-1.5 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {Array.from({ length: Math.max(totalPages, 1) }, (_, i) => i + 1).map((num) => (
          <option key={num} value={num}>{num}</option>
        ))}
      </select>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || totalPages <= 1 || disabled}
        className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
