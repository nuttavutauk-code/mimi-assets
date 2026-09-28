"use client";

import { PO_COLUMNS, VENDOR_LIST, JOB_TYPE_KEYWORDS, type PoRowField } from "@/lib/po-tracking/constants";

export type EditableRow = { [K in PoRowField]?: string | number | null } & {
  id?: number;
  jobGroupId?: string;
};

interface PoRowsTableProps<T extends EditableRow> {
  rows: T[];
  editable: boolean;
  onCellChange?: (rowIndex: number, field: PoRowField, value: string) => void;
  renderRowActions?: (row: T, rowIndex: number) => React.ReactNode;
  isGroupStart?: (rowIndex: number) => boolean;
  maxHeight?: string;
}

const formatDisplay = (value: string | number | null | undefined, type: "text" | "number") => {
  if (value === null || value === undefined || value === "") return "";
  if (type === "number" && typeof value === "number") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return String(value);
};

const SELECT_OPTIONS: Partial<Record<PoRowField, readonly string[]>> = {
  vendor: VENDOR_LIST,
  jobType: JOB_TYPE_KEYWORDS,
};

export default function PoRowsTable<T extends EditableRow>({
  rows,
  editable,
  onCellChange,
  renderRowActions,
  isGroupStart,
  maxHeight = "60vh",
}: PoRowsTableProps<T>) {
  return (
    <div className="overflow-auto" style={{ maxHeight, WebkitOverflowScrolling: "touch" }}>
      <table className="text-xs border-collapse whitespace-nowrap">
        <thead className="sticky top-0 z-10">
          <tr>
            {renderRowActions && <th className="px-2 py-2 bg-gray-100 border-b border-black/10 sticky left-0 z-20" />}
            {PO_COLUMNS.map((col) => (
              <th
                key={col.field}
                className={`px-2 py-2 text-left font-semibold border-b border-black/10 ${
                  col.kind === "auto" ? "bg-sky-100 text-sky-900" : "bg-gray-100 text-gray-700"
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={row.id ?? rowIndex}
              className={`hover:bg-black/2 ${isGroupStart?.(rowIndex) && rowIndex > 0 ? "border-t-2 border-t-gray-300" : ""}`}
            >
              {renderRowActions && (
                <td className="px-1 py-1 border-b border-black/5 bg-white sticky left-0">{renderRowActions(row, rowIndex)}</td>
              )}
              {PO_COLUMNS.map((col) => {
                const value = row[col.field];
                const cellBg = col.kind === "auto" ? "bg-sky-50/60" : "";
                if (!editable) {
                  return (
                    <td
                      key={col.field}
                      className={`px-2 py-1.5 border-b border-black/5 ${cellBg} ${col.type === "number" ? "text-right" : ""} ${
                        col.field === "assetType" || col.field === "remark1" ? "max-w-[280px] truncate" : ""
                      }`}
                      title={col.field === "assetType" || col.field === "remark1" ? String(value ?? "") : undefined}
                    >
                      {formatDisplay(value, col.type)}
                    </td>
                  );
                }
                const options = SELECT_OPTIONS[col.field];
                const inputValue = value === null || value === undefined ? "" : String(value);
                return (
                  <td key={col.field} className={`px-1 py-1 border-b border-black/5 ${cellBg}`}>
                    <input
                      type="text"
                      inputMode={col.type === "number" ? "decimal" : undefined}
                      list={options ? `po-options-${col.field}` : undefined}
                      value={inputValue}
                      onChange={(e) => onCellChange?.(rowIndex, col.field, e.target.value)}
                      className={`w-full px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 ${
                        col.type === "number" ? "text-right" : ""
                      }`}
                      style={{ minWidth: col.field === "assetType" ? 260 : col.type === "number" ? 90 : 110 }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {editable &&
        Object.entries(SELECT_OPTIONS).map(([field, options]) => (
          <datalist key={field} id={`po-options-${field}`}>
            {options!.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        ))}
    </div>
  );
}
