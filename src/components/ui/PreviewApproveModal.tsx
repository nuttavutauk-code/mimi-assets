"use client";

import { useState } from "react";
import { X, ZoomIn, ZoomOut, CheckCircle, Loader2 } from "lucide-react";
import DocumentTemplateSelector from "@/components/ui/document/DocumentTemplateSelector";

interface PreviewApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  documentType: string;
  documentData: {
    docCode: string;
    fullName: string;
    company: string;
    phone: string;
    note: string;
    vendor: string;
  };
  shopInfo: {
    shopCode: string;
    shopName: string;
    startInstallDate: string;
    endInstallDate: string;
    q7b7: string;
    shopFocus: string;
  };
  assets: Array<{
    name: string;
    size: string;
    grade: string;
    kv: string;
    qty: number;
    withdrawFor: string;
    barcode?: string;
    assignedBarcodes?: string[];
  }>;
  securitySets: Array<{
    name: string;
    qty: number;
    withdrawFor: string;
    barcode?: string;
    assignedBarcodes?: string[];
  }>;
  // สำหรับ Routing forms
  shops?: Array<{
    shopCode: string;
    shopName: string;
    startInstallDate: string;
    endInstallDate: string;
    q7b7: string;
    shopFocus: string;
    assets: Array<any>;
    securitySets?: Array<any>;
  }>;
  // สำหรับ Return Asset
  returnCondition?: string;
  // สำหรับ Shop to Shop
  shopFrom?: { shopCode: string; shopName: string };
  shopTo?: { shopCode: string; shopName: string };
}

const PreviewApproveModal = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  documentType,
  documentData,
  shopInfo,
  assets,
  securitySets,
  shops,
  returnCondition,
  shopFrom,
  shopTo,
}: PreviewApproveModalProps) => {
  const [zoom, setZoom] = useState(60);

  if (!isOpen) return null;

  // สร้าง document object ที่ DocumentTemplateSelector ต้องการ
  const buildDocumentObject = () => {
    const baseDoc = {
      docCode: documentData.docCode,
      fullName: documentData.fullName,
      company: documentData.company,
      phone: documentData.phone,
      note: documentData.note,
      documentType: documentType,
      returnCondition: returnCondition,
      createdBy: {
        vendor: documentData.vendor,
      },
      approvedAt: new Date().toISOString(),
    };

    // สำหรับ Routing forms ที่มีหลาย shops
    if (shops && shops.length > 0) {
      return {
        ...baseDoc,
        shops: shops.map(shop => ({
          shopCode: shop.shopCode,
          shopName: shop.shopName,
          startInstallDate: shop.startInstallDate,
          endInstallDate: shop.endInstallDate,
          q7b7: shop.q7b7,
          shopFocus: shop.shopFocus,
          assets: shop.assets || [],
          securitySets: shop.securitySets || [],
        })),
      };
    }

    // สำหรับ Shop to Shop
    if (documentType === "shoptoshop" || documentType === "shop-to-shop") {
      return {
        ...baseDoc,
        shops: [
          {
            shopCode: shopFrom?.shopCode || shopInfo.shopCode.split(" → ")[0] || "",
            shopName: shopFrom?.shopName || shopInfo.shopName.split(" → ")[0] || "",
            startInstallDate: shopInfo.startInstallDate,
            assets: assets,
            securitySets: securitySets,
          },
          {
            shopCode: shopTo?.shopCode || shopInfo.shopCode.split(" → ")[1] || "",
            shopName: shopTo?.shopName || shopInfo.shopName.split(" → ")[1] || "",
          },
        ],
      };
    }

    // สำหรับ form อื่นๆ ที่มี shop เดียว
    return {
      ...baseDoc,
      shops: [
        {
          shopCode: shopInfo.shopCode,
          shopName: shopInfo.shopName,
          startInstallDate: shopInfo.startInstallDate,
          endInstallDate: shopInfo.endInstallDate,
          q7b7: shopInfo.q7b7,
          shopFocus: shopInfo.shopFocus,
          assets: assets,
          securitySets: securitySets,
        },
      ],
    };
  };

  const documentObject = buildDocumentObject();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <h2 className="text-lg font-semibold">📄 ตรวจสอบเอกสารก่อนอนุมัติ</h2>
          <div className="flex items-center gap-3">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1">
              <button
                onClick={() => setZoom(Math.max(30, zoom - 10))}
                className="p-1 hover:bg-white/20 rounded"
                title="ซูมออก"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(100, zoom + 10))}
                className="p-1 hover:bg-white/20 rounded"
                title="ซูมเข้า"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          <div
            className="mx-auto bg-white shadow-lg"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
              width: "794px",
            }}
          >
            <DocumentTemplateSelector document={documentObject} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-medium hover:from-green-600 hover:to-green-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังอนุมัติ...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                ยืนยันอนุมัติ
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewApproveModal;