// src/lib/email.ts
// ระบบส่ง Email Notification ผ่าน Resend

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@mimiassets.com";
const APP_URL = process.env.NEXTAUTH_URL || "https://mimiassets.com";

// ประเภทเอกสารภาษาไทย (ตรงกับหน้า Admin List)
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
    withdraw: "ใบเบิก Asset",
    routing2shops: "Routing 2 shops",
    routing3shops: "Routing 3 shops",
    routing4shops: "Routing 4 shops",
    other: "ใบเบิกของอื่นๆ",
    transfer: "ใบย้ายของ",
    borrowsecurity: "ใบยืม+Security",
    borrow: "ใบยืม",
    return: "เก็บ Asset กลับ",
    returnasset: "เก็บ Asset กลับ",
    shoptoshop: "Shop to Shop",
    "shop-to-shop": "Shop to Shop",
    repair: "ใบแจ้งซ่อม",
};

// ฟังก์ชันแปลงประเภทเอกสารเป็นภาษาไทย
function getDocumentTypeLabel(type: string): string {
    return DOCUMENT_TYPE_LABELS[type] || type;
}

// ฟังก์ชันจัด format วันที่
function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
}

// Interface สำหรับข้อมูลส่ง email
interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
}

// ฟังก์ชันส่ง email ผ่าน Resend API
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
    if (!RESEND_API_KEY) {
        console.error("RESEND_API_KEY is not set");
        return { success: false, error: "Email service not configured" };
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: `MiMi Assets <${FROM_EMAIL}>`,
                to: [to],
                subject,
                html,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Resend API error:", errorData);
            return { success: false, error: errorData.message || "Failed to send email" };
        }

        const data = await response.json();
        console.log("Email sent successfully:", data.id);
        return { success: true };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

// ========== Email Templates ==========

// Template: เอกสารได้รับการอนุมัติ
export function generateApprovalEmailHtml(params: {
    userName: string;
    docCode: string;
    documentType: string;
    approvedAt: Date;
    approvedBy?: string;
}): string {
    const { userName, docCode, documentType, approvedAt, approvedBy } = params;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>เอกสารได้รับการอนุมัติ</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 8px;">✅</div>
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                                เอกสารได้รับการอนุมัติแล้ว!
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px;">
                            <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                                สวัสดีคุณ <strong>${userName}</strong>,
                            </p>
                            <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                                เอกสารของคุณได้รับการอนุมัติเรียบร้อยแล้ว
                            </p>
                            
                            <!-- Document Details Box -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 12px; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">📄 เลขที่เอกสาร</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${docCode}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">📋 ประเภท</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${getDocumentTypeLabel(documentType)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">📅 วันที่อนุมัติ</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${formatDate(approvedAt)}</td>
                                            </tr>
                                            ${approvedBy ? `
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">👤 อนุมัติโดย</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${approvedBy}</td>
                                            </tr>
                                            ` : ""}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td align="center">
                                        <a href="${APP_URL}/dashboard/user-list" 
                                           style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                            ดูรายละเอียดเอกสาร
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
                                ระบบส่งอีเมลนี้โดยอัตโนมัติ กรุณาอย่าตอบกลับ
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                © ${new Date().getFullYear()} MiMi Assets - ระบบจัดการ Asset
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

// Template: เอกสารถูกปฏิเสธ
export function generateRejectionEmailHtml(params: {
    userName: string;
    docCode: string;
    documentType: string;
    rejectedAt: Date;
    rejectedBy?: string;
    reason?: string;
}): string {
    const { userName, docCode, documentType, rejectedAt, rejectedBy, reason } = params;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>เอกสารถูกปฏิเสธ</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px; text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 8px;">❌</div>
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                                เอกสารถูกปฏิเสธ
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px;">
                            <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                                สวัสดีคุณ <strong>${userName}</strong>,
                            </p>
                            <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                                เอกสารของคุณถูกปฏิเสธ กรุณาตรวจสอบและแก้ไขข้อมูลแล้วส่งใหม่อีกครั้ง
                            </p>
                            
                            <!-- Document Details Box -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef2f2; border-radius: 12px; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">📄 เลขที่เอกสาร</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${docCode}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">📋 ประเภท</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${getDocumentTypeLabel(documentType)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">📅 วันที่ปฏิเสธ</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${formatDate(rejectedAt)}</td>
                                            </tr>
                                            ${rejectedBy ? `
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">👤 ปฏิเสธโดย</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${rejectedBy}</td>
                                            </tr>
                                            ` : ""}
                                            ${reason ? `
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">📝 เหตุผล</td>
                                                <td style="padding: 8px 0; color: #dc2626; font-size: 14px; font-weight: 600;">${reason}</td>
                                            </tr>
                                            ` : ""}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td align="center">
                                        <a href="${APP_URL}/dashboard/user-list" 
                                           style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                            ดูรายละเอียดเอกสาร
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
                                ระบบส่งอีเมลนี้โดยอัตโนมัติ กรุณาอย่าตอบกลับ
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                © ${new Date().getFullYear()} MiMi Assets - ระบบจัดการ Asset
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

// Template: มีงาน Pick Asset ใหม่
export function generatePickTaskEmailHtml(params: {
    userName: string;
    docCode: string;
    documentType: string;
    tasksCount: number;
    warehouse: string;
}): string {
    const { userName, docCode, documentType, tasksCount, warehouse } = params;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>มีงาน Pick Asset ใหม่</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 8px;">📦</div>
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                                มีงาน Pick Asset ใหม่!
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px;">
                            <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                                สวัสดีคุณ <strong>${userName}</strong>,
                            </p>
                            <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
                                มีงาน Pick Asset ใหม่ที่รอดำเนินการในโกดังของคุณ
                            </p>
                            
                            <!-- Task Details Box -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fffbeb; border-radius: 12px; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">📄 เลขที่เอกสาร</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${docCode}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">📋 ประเภท</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${getDocumentTypeLabel(documentType)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">🏭 โกดัง</td>
                                                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${warehouse}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">📊 จำนวนรายการ</td>
                                                <td style="padding: 8px 0; color: #f59e0b; font-size: 14px; font-weight: 600;">${tasksCount} รายการ</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td align="center">
                                        <a href="${APP_URL}/dashboard/user-pick" 
                                           style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                            ไปหน้า Pick Asset
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
                                ระบบส่งอีเมลนี้โดยอัตโนมัติ กรุณาอย่าตอบกลับ
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                © ${new Date().getFullYear()} MiMi Assets - ระบบจัดการ Asset
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

// ========== High-level Email Functions ==========

// ส่ง email แจ้งอนุมัติเอกสาร
export async function sendApprovalEmail(params: {
    toEmail: string;
    userName: string;
    docCode: string;
    documentType: string;
    approvedBy?: string;
}): Promise<{ success: boolean; error?: string }> {
    const html = generateApprovalEmailHtml({
        userName: params.userName,
        docCode: params.docCode,
        documentType: params.documentType,
        approvedAt: new Date(),
        approvedBy: params.approvedBy,
    });

    return sendEmail({
        to: params.toEmail,
        subject: `✅ เอกสาร ${params.docCode} ได้รับการอนุมัติแล้ว`,
        html,
    });
}

// ส่ง email แจ้งปฏิเสธเอกสาร
export async function sendRejectionEmail(params: {
    toEmail: string;
    userName: string;
    docCode: string;
    documentType: string;
    rejectedBy?: string;
    reason?: string;
}): Promise<{ success: boolean; error?: string }> {
    const html = generateRejectionEmailHtml({
        userName: params.userName,
        docCode: params.docCode,
        documentType: params.documentType,
        rejectedAt: new Date(),
        rejectedBy: params.rejectedBy,
        reason: params.reason,
    });

    return sendEmail({
        to: params.toEmail,
        subject: `❌ เอกสาร ${params.docCode} ถูกปฏิเสธ`,
        html,
    });
}

// ส่ง email แจ้งมีงาน Pick Asset ใหม่
export async function sendPickTaskEmail(params: {
    toEmail: string;
    userName: string;
    docCode: string;
    documentType: string;
    tasksCount: number;
    warehouse: string;
}): Promise<{ success: boolean; error?: string }> {
    const html = generatePickTaskEmailHtml({
        userName: params.userName,
        docCode: params.docCode,
        documentType: params.documentType,
        tasksCount: params.tasksCount,
        warehouse: params.warehouse,
    });

    return sendEmail({
        to: params.toEmail,
        subject: `📦 มีงาน Pick Asset ใหม่ - ${params.docCode}`,
        html,
    });
}