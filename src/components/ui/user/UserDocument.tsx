"use client";

import { useState } from "react";
import { ArrowLeft, Plus, FileText, Clock, Package, Truck, Shield, Users, Wrench, RotateCcw, ArrowLeftRight } from "lucide-react";

import FormWithdrawAsset from "@/components/ui/user/document/FormWithdrawAsset";
import FormRouting2Shops from "@/components/ui/user/document/FormRouting2Shops";
import FormRouting3Shops from "@/components/ui/user/document/FormRouting3Shops";
import FormRouting4Shops from "@/components/ui/user/document/FormRouting4Shops";
import FormOther from "@/components/ui/user/document/FormOther";
import FormTransfer from "@/components/ui/user/document/FormTransfer";
import FormBorrowSecurity from "@/components/ui/user/document/FormBorrowSecurity";
import FormBorrow from "@/components/ui/user/document/FormBorrow";
import FormReturnAsset from "@/components/ui/user/document/FormReturnAsset";
import FormShopToShop from "@/components/ui/user/document/FormShopToShop";
import FormRepair from "@/components/ui/user/document/FormRepair";

const UserDocument = () => {
  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  const documents = [
    { name: "ใบเบิก Asset", key: "withdraw", icon: FileText, color: "blue" },
    { name: "Routing 2 shops", key: "routing2", icon: Clock, color: "green" },
    { name: "Routing 3 shops", key: "routing3", icon: Clock, color: "pink" },
    { name: "Routing 4 shops", key: "routing4", icon: Clock, color: "purple" },
    { name: "ใบเบิกของอื่นๆ", key: "other", icon: Package, color: "orange" },
    { name: "ใบย้ายของ", key: "transfer", icon: Truck, color: "cyan" },
    { name: "ใบยืม+Security", key: "borrowSecurity", icon: Shield, color: "blue" },
    { name: "ใบยืม", key: "borrow", icon: Users, color: "green" },
    { name: "เก็บ Asset กลับ", key: "returnAsset", icon: RotateCcw, color: "pink" },
    { name: "Shop to Shop", key: "shopToShop", icon: ArrowLeftRight, color: "purple" },
    { name: "ใบแจ้งซ่อม", key: "repair", icon: Wrench, color: "orange" },
  ];

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-500",
    green: "bg-green-50 text-green-500",
    pink: "bg-pink-50 text-pink-500",
    purple: "bg-purple-50 text-purple-500",
    orange: "bg-orange-50 text-orange-500",
    cyan: "bg-cyan-50 text-cyan-500",
  };

  const backButton = (label: string) => (
    <div className="flex items-center gap-3 mb-4 sm:mb-6">
      <button
        onClick={() => setActiveDoc(null)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-black/10 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">ย้อนกลับ</span>
      </button>
      <h1 className="text-lg sm:text-xl font-semibold text-foreground">{label}</h1>
    </div>
  );

  // ✅ แสดงฟอร์มตาม activeDoc
  switch (activeDoc) {
    case "withdraw":
      return (
        <div>
          {backButton("ใบเบิก Asset")}
          <FormWithdrawAsset />
        </div>
      );
    case "routing2":
      return (
        <div>
          {backButton("ใบ Routing 2 Shops")}
          <FormRouting2Shops />
        </div>
      );
    case "routing3":
      return (
        <div>
          {backButton("ใบ Routing 3 Shops")}
          <FormRouting3Shops />
        </div>
      );
    case "routing4":
      return (
        <div>
          {backButton("ใบ Routing 4 Shops")}
          <FormRouting4Shops />
        </div>
      );
    case "other":
      return (
        <div>
          {backButton("ใบเบิกของอื่นๆ")}
          <FormOther />
        </div>
      );
    case "transfer":
      return (
        <div>
          {backButton("ใบย้ายของ")}
          <FormTransfer />
        </div>
      );
    case "borrowSecurity":
      return (
        <div>
          {backButton("ใบยืม + Security")}
          <FormBorrowSecurity />
        </div>
      );
    case "borrow":
      return (
        <div>
          {backButton("ใบยืม")}
          <FormBorrow />
        </div>
      );
    case "returnAsset":
      return (
        <div>
          {backButton("ใบเก็บ Asset กลับ")}
          <FormReturnAsset />
        </div>
      );
    case "shopToShop":
      return (
        <div>
          {backButton("ใบย้ายของ Shop to Shop")}
          <FormShopToShop />
        </div>
      );
    case "repair":
      return (
        <div>
          {backButton("ใบแจ้งซ่อม")}
          <FormRepair />
        </div>
      );
    default:
      break;
  }

  // ✅ หน้า Document หลัก (เลือกฟอร์ม)
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">สร้างเอกสาร</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          เลือกประเภทเอกสารที่ต้องการสร้าง
        </p>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {documents.map((doc, idx) => {
          const Icon = doc.icon;
          return (
            <button
              key={idx}
              onClick={() => setActiveDoc(doc.key)}
              className="glass-card doc-card flex flex-col items-center justify-center p-4 sm:p-6 min-h-[140px] sm:min-h-[160px] text-center cursor-pointer active:scale-95 transition-transform"
            >
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${colorClasses[doc.color]} flex items-center justify-center mb-3`}>
                <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="w-6 h-6 rounded-md border-2 border-dashed border-black/10 flex items-center justify-center mb-2">
                <Plus className="w-3 h-3 text-black/20" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-foreground leading-tight">
                {doc.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default UserDocument;
