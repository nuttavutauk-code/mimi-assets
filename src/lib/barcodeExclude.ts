// Flattens every barcode value in a Record<rowId, barcode[]> into one array,
// optionally skipping one row (used to exclude "this row" when computing
// cross-row dedup so the row's own already-picked value stays visible).
export function flattenBarcodes(
  record: Record<number, string[]>,
  excludeId?: number
): string[] {
  return Object.entries(record)
    .flatMap(([id, barcodes]) =>
      excludeId !== undefined && Number(id) === excludeId ? [] : barcodes || []
    )
    .filter(Boolean);
}
