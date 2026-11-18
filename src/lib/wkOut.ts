// Helper คอลัมน์ WK ขาออก — ใช้ร่วมกันระหว่าง pick-asset/complete และ pick-asset/edit-barcode

// ✅ Helper: กำหนดคอลัมน์ WK ที่ต้องบันทึกตามประเภทเอกสาร (สำหรับขาออก)
export type WkOutColumn = "wkOut" | "wkOutForRepair" | "wkInForRepair" | "borrow";

export function getWkOutColumnForDocumentType(documentType: string): WkOutColumn {
    switch (documentType) {
        // ขาออก - เบิกปกติ
        case "withdraw":
        case "routing2shops":
        case "routing3shops":
        case "routing4shops":
        case "withdrawother":
            return "wkOut";

        // ขาออก - ย้ายระหว่างโกดัง (WK OUT for Repair = ออก, WK IN for Repair = เข้า)
        case "transfer":
            return "wkOutForRepair";

        // ขาออก - ยืม
        case "borrow":
        case "borrowsecurity":
        case "borrowSecurityRouting":
            return "borrow";

        default:
            return "wkOut";
    }
}

// ✅ Helper: สร้าง WK data object ตาม otherActivity หรือ logic ปกติ
export type WkData = {
    wkOut?: string | null;
    wkIn?: string | null;
    wkOutForRepair?: string | null;
    wkInForRepair?: string | null;
    newInStock?: string | null;
    refurbishedInStock?: string | null;
    borrow?: string | null;
    return?: string | null;
    outToRentalWarehouse?: string | null;
    inToRentalWarehouse?: string | null;
    discarded?: string | null;
    adjustError?: string | null;
};

export function getWkDataForOutTransaction(
    documentType: string,
    weekNumber: string,
    otherActivity?: string | null
): WkData {
    // ถ้ามี otherActivity → บันทึกในคอลัมน์ที่เลือกแทน (ไม่แตะคอลัมน์อื่น)
    if (otherActivity) {
        const result: WkData = {};
        switch (otherActivity) {
            case "outToRentalWarehouse":
                result.outToRentalWarehouse = weekNumber;
                break;
            case "inToRentalWarehouse":
                result.inToRentalWarehouse = weekNumber;
                break;
            case "discarded":
                result.discarded = weekNumber;
                break;
            case "adjustError":
                result.adjustError = weekNumber;
                break;
        }
        return result;
    }

    // ถ้าไม่มี otherActivity → ใช้ logic ปกติ (ไม่แตะคอลัมน์อื่น)
    const normalColumn = getWkOutColumnForDocumentType(documentType);

    // ✅ บันทึกเฉพาะคอลัมน์ที่ตรงกับ normalColumn เท่านั้น (ไม่เขียนทับคอลัมน์อื่น)
    const result: WkData = {};

    switch (normalColumn) {
        case "wkOut":
            result.wkOut = weekNumber;
            break;
        case "wkOutForRepair":
            result.wkOutForRepair = weekNumber;
            break;
        case "borrow":
            result.borrow = weekNumber;
            break;
    }

    return result;
}

// ✅ คอลัมน์ WK ที่ขา OUT ของเอกสารนี้เขียนลงไป (ใช้ตอนย้าย/ล้างขา OUT เช่น แก้ Barcode หลัง Complete)
export function getWkOutColumnsWritten(
    documentType: string,
    otherActivity?: string | null
): (keyof WkData)[] {
    return Object.keys(getWkDataForOutTransaction(documentType, "-", otherActivity)) as (keyof WkData)[];
}
