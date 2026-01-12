"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  FileText,
  CheckCircle2,
  Clock,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Wrench,
  Store,
  XCircle,
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  totalDocuments: number;
  approvedDocuments: number;
  pendingDocuments: number;
  rejectedDocuments: number;
  totalAssets: number;
  totalShops: number;
  changes: {
    documents: number;
    approved: number;
    pending: number;
  };
}

interface RecentDocument {
  id: number;
  docCode: string;
  documentType: string;
  status: string;
  createdAt: string;
  fullName: string;
}

interface RecentActivity {
  id: number;
  docCode: string;
  documentType: string;
  status: string;
  createdAt: string;
}

export default function DashboardHome() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0,
    approvedDocuments: 0,
    pendingDocuments: 0,
    rejectedDocuments: 0,
    totalAssets: 0,
    totalShops: 0,
    changes: { documents: 0, approved: 0, pending: 0 },
  });
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const role = session?.user?.role?.toUpperCase() || "USER";

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();

        if (json.success) {
          setStats(json.stats);
          setRecentDocuments(json.recentDocuments || []);
          setRecentActivities(json.recentActivities || []);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const typeMap: Record<string, string> = {
    withdraw: "ใบเบิก Asset",
    withdrawSecurity: "ใบเบิก Security",
    routing2shops: "Routing 2 shops",
    routing3shops: "Routing 3 shops",
    routing4shops: "Routing 4 shops",
    other: "ใบเบิกของอื่นๆ",
    transfer: "ใบย้ายของ",
    borrowSecurity: "ใบยืม+Security",
    borrow: "ใบยืม",
    returnAsset: "เก็บ Asset กลับ",
    shopToShop: "Shop to Shop",
    repair: "ใบแจ้งซ่อม",
  };

  const statusConfig: Record<string, { text: string; className: string }> = {
    submitted: { text: "รออนุมัติ", className: "status-badge pending" },
    approved: { text: "อนุมัติแล้ว", className: "status-badge approved" },
    rejected: { text: "รอแก้ไข", className: "status-badge rejected" },
  };

  const getActivityIcon = (status: string, docType: string) => {
    if (status === "approved") return { icon: CheckCircle2, iconClass: "icon-container green" };
    if (status === "rejected") return { icon: XCircle, iconClass: "icon-container red" };
    if (docType === "repair") return { icon: Wrench, iconClass: "icon-container orange" };
    return { icon: FileText, iconClass: "icon-container blue" };
  };

  const getActivityTitle = (activity: RecentActivity) => {
    const typeName = typeMap[activity.documentType] || activity.documentType;
    if (activity.status === "approved") return `อนุมัติ ${typeName}`;
    if (activity.status === "rejected") return `ปฏิเสธ ${typeName}`;
    return `สร้าง ${typeName}`;
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} นาที`;
    if (diffHours < 24) return `${diffHours} ชม.`;
    return `${diffDays} วัน`;
  };

  const renderChange = (value: number) => {
    if (value === 0) return null;
    const isPositive = value > 0;
    return (
      <div className={`hidden sm:flex items-center gap-1 text-xs font-medium ${isPositive ? "text-green-600" : "text-red-500"}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive ? "+" : ""}{value}%
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">แดชบอร์ด</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          ภาพรวมกิจกรรมล่าสุด{role === "ADMIN" ? "ของระบบ" : "ของคุณ"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Documents */}
        <div className="glass-card stat-card blue p-4 sm:p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="icon-container blue">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            {renderChange(stats.changes.documents)}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground mb-0.5">
            {loading ? "-" : stats.totalDocuments.toLocaleString()}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">เอกสารทั้งหมด</div>
        </div>

        {/* Approved */}
        <div className="glass-card stat-card green p-4 sm:p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="icon-container green">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            {renderChange(stats.changes.approved)}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground mb-0.5">
            {loading ? "-" : stats.approvedDocuments.toLocaleString()}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">อนุมัติแล้ว</div>
        </div>

        {/* Pending */}
        <div className="glass-card stat-card pink p-4 sm:p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="icon-container pink">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            {renderChange(stats.changes.pending)}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground mb-0.5">
            {loading ? "-" : stats.pendingDocuments.toLocaleString()}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">รอดำเนินการ</div>
        </div>

        {/* Assets */}
        <div className="glass-card stat-card purple p-4 sm:p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="icon-container purple">
              <Package className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground mb-0.5">
            {loading ? "-" : stats.totalAssets.toLocaleString()}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">Assets ในคลัง</div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Documents - Takes 2 columns */}
        <div className="lg:col-span-2 glass-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">เอกสารล่าสุด</h2>
            <Link
              href={role === "ADMIN" ? "/dashboard/admin-list" : "/dashboard/user-list"}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              ดูทั้งหมด
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
          ) : recentDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีเอกสาร</div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="glass-table w-full">
                  <thead>
                    <tr>
                      <th>เลขเอกสาร</th>
                      <th>ประเภท</th>
                      <th>วันที่</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDocuments.map((doc, i) => {
                      const status = statusConfig[doc.status] || { text: doc.status, className: "status-badge" };
                      return (
                        <tr key={i}>
                          <td className="font-medium">{doc.docCode}</td>
                          <td>{typeMap[doc.documentType] || doc.documentType}</td>
                          <td>
                            {new Date(doc.createdAt).toLocaleDateString("th-TH", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </td>
                          <td>
                            <span className={status.className}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {status.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile List */}
              <div className="sm:hidden space-y-3">
                {recentDocuments.map((doc, i) => {
                  const status = statusConfig[doc.status] || { text: doc.status, className: "status-badge" };
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-black/3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{doc.docCode}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{typeMap[doc.documentType] || doc.documentType}</p>
                      </div>
                      <span className={status.className}>
                        {status.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Activity Feed */}
        <div className="glass-card p-4 sm:p-5">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4">กิจกรรมล่าสุด</h2>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
          ) : recentActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีกิจกรรม</div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity, i) => {
                const { icon: Icon, iconClass } = getActivityIcon(activity.status, activity.documentType);
                return (
                  <div key={i} className="flex items-start gap-3 pb-3 border-b border-black/5 last:border-0 last:pb-0">
                    <div className={`${iconClass} !w-10 !h-10`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{getActivityTitle(activity)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{activity.docCode}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{getTimeAgo(activity.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-4 sm:p-5">
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3">ทางลัด</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {role === "ADMIN" ? (
            <>
              <Link
                href="/dashboard/admin-list"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <FileText className="w-6 h-6 text-blue-500" />
                <span className="text-sm font-medium text-foreground text-center">รายการเอกสาร</span>
              </Link>
              <Link
                href="/dashboard/admin-database"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-50 hover:bg-green-100 transition-colors"
              >
                <Package className="w-6 h-6 text-green-500" />
                <span className="text-sm font-medium text-foreground text-center">Database</span>
              </Link>
              <Link
                href="/dashboard/admin-shop"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-orange-50 hover:bg-orange-100 transition-colors"
              >
                <Store className="w-6 h-6 text-orange-500" />
                <span className="text-sm font-medium text-foreground text-center">Shop ({stats.totalShops})</span>
              </Link>
              <Link
                href="/dashboard/admin-asset"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                <Package className="w-6 h-6 text-purple-500" />
                <span className="text-sm font-medium text-foreground text-center">Asset</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/dashboard/user-document"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <FileText className="w-6 h-6 text-blue-500" />
                <span className="text-sm font-medium text-foreground text-center">สร้างเอกสาร</span>
              </Link>
              <Link
                href="/dashboard/user-pick"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-50 hover:bg-green-100 transition-colors"
              >
                <Package className="w-6 h-6 text-green-500" />
                <span className="text-sm font-medium text-foreground text-center">Pick Asset</span>
              </Link>
              <Link
                href="/dashboard/repair-asset"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-orange-50 hover:bg-orange-100 transition-colors"
              >
                <Wrench className="w-6 h-6 text-orange-500" />
                <span className="text-sm font-medium text-foreground text-center">Repair Asset</span>
              </Link>
              <Link
                href="/dashboard/library-sis"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                <CheckCircle2 className="w-6 h-6 text-purple-500" />
                <span className="text-sm font-medium text-foreground text-center">Library SIS</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}