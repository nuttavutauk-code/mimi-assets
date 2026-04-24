import { prisma } from "@/lib/prisma";

export const AuditAction = {
  // Document
  DOCUMENT_CREATE: "DOCUMENT_CREATE",
  DOCUMENT_SUBMIT: "DOCUMENT_SUBMIT",
  DOCUMENT_UPDATE: "DOCUMENT_UPDATE",
  DOCUMENT_DELETE: "DOCUMENT_DELETE",
  DOCUMENT_APPROVE: "DOCUMENT_APPROVE",
  DOCUMENT_REJECT: "DOCUMENT_REJECT",

  // Pick Asset
  PICK_TASK_COMPLETE: "PICK_TASK_COMPLETE",
  PICK_TASK_CANCEL: "PICK_TASK_CANCEL",
  PICK_TASK_BARCODE_UPDATE: "PICK_TASK_BARCODE_UPDATE",

  // Repair
  REPAIR_TASK_COMPLETE: "REPAIR_TASK_COMPLETE",

  // Transfer Receive
  TRANSFER_RECEIVE_COMPLETE: "TRANSFER_RECEIVE_COMPLETE",
  TRANSFER_RECEIVE_REJECT: "TRANSFER_RECEIVE_REJECT",

  // User management
  USER_CREATE: "USER_CREATE",
  USER_UPDATE: "USER_UPDATE",
  USER_DELETE: "USER_DELETE",
  USER_LOGIN: "USER_LOGIN",

  // Shop management
  SHOP_CREATE: "SHOP_CREATE",
  SHOP_UPDATE: "SHOP_UPDATE",
  SHOP_DELETE: "SHOP_DELETE",
  SHOP_TOGGLE_STATUS: "SHOP_TOGGLE_STATUS",
  SHOP_IMPORT: "SHOP_IMPORT",

  // Asset management
  ASSET_IMPORT_NEW: "ASSET_IMPORT_NEW",
  ASSET_IMPORT_USED: "ASSET_IMPORT_USED",
  ASSET_IMPORT_REFURBISHED: "ASSET_IMPORT_REFURBISHED",

  // Database
  DATABASE_IMPORT: "DATABASE_IMPORT",
  DATABASE_ROW_UPDATE: "DATABASE_ROW_UPDATE",
  DATABASE_SECURITY_IMPORT: "DATABASE_SECURITY_IMPORT",
  DATABASE_SECURITY_ROW_UPDATE: "DATABASE_SECURITY_ROW_UPDATE",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

interface WriteAuditLogParams {
  userId?: number | null;
  username?: string | null;
  userRole?: string | null;
  action: AuditActionType | string;
  entity: string;
  entityId?: string | null;
  detail?: Record<string, unknown> | null;
  req?: Request | { headers: { get: (key: string) => string | null } };
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  try {
    const ipAddress = params.req
      ? (params.req.headers.get("x-forwarded-for") ||
          params.req.headers.get("x-real-ip") ||
          "unknown")
      : null;
    const userAgent = params.req?.headers.get("user-agent") || null;

    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        username: params.username ?? null,
        userRole: params.userRole ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detail: (params.detail as any) ?? undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // ไม่ให้ audit log error กระทบ request หลัก
    console.error("[AUDIT LOG ERROR]", error);
  }
}

export function getSessionUser(session: {
  user?: {
    id?: string | null;
    username?: string | null;
    role?: string | null;
    name?: string | null;
  } | null;
}) {
  const user = session?.user;
  return {
    userId: user?.id ? parseInt(user.id) : null,
    username: user?.username || user?.name || null,
    userRole: user?.role || null,
  };
}
