// Transaction Status Options สำหรับ Admin เลือกตอนอนุมัติเอกสาร
// ค่าเหล่านี้จะถูกบันทึกลงคอลัมน์ Status ใน Asset Database

export const TRANSACTION_STATUS_OPTIONS = [
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
] as const;

export type TransactionStatus = typeof TRANSACTION_STATUS_OPTIONS[number];