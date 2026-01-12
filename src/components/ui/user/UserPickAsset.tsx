"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, Package, ChevronLeft, ChevronRight, Loader2, SquareArrowOutUpRight } from "lucide-react";

interface PickTask {
  id: string;
  documentId: number;
  docCode: string;
  warehouse: string;
  shopCode: string;
  shopName: string;
  createdAt: string;
  status: string;
  totalItems: number;
  pickedItems: number;
}

export default function UserPickAsset() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<PickTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchPickTasks();
  }, [currentPage]);

  const fetchPickTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/pick-asset/my-tasks?page=${currentPage}`);
      const data = await res.json();

      if (data.success) {
        setTasks(data.tasks);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error("Error fetching pick tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = tasks.filter(
    (item) =>
      item.docCode.toLowerCase().includes(search.toLowerCase()) ||
      item.warehouse.toLowerCase().includes(search.toLowerCase()) ||
      item.shopName.toLowerCase().includes(search.toLowerCase())
  );

  const statusConfig: Record<string, { text: string; className: string }> = {
    pending: { text: "รอดำเนินการ", className: "status-badge pending" },
    picking: { text: "กำลังดำเนินการ", className: "status-badge completed" },
    completed: { text: "เสร็จสิ้น", className: "status-badge approved" },
  };

  const handleViewTask = (documentId: number, shopCode: string) => {
    router.push(`/dashboard/user-pick/${documentId}?shopCode=${encodeURIComponent(shopCode)}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Pick Asset</h1>
        <p className="text-sm text-muted-foreground mt-0.5">รายการงานหยิบ Asset ที่ต้องดำเนินการ</p>
      </div>

      {/* Search */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="ค้นหาเลขที่เอกสาร, โกดัง, ชื่อร้าน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 glass-input"
            />
          </div>
          <button onClick={fetchPickTasks} className="gradient-button px-6 py-2.5 text-sm font-medium flex items-center justify-center gap-2">
            <Search className="w-4 h-4" />
            ค้นหา
          </button>
        </div>
      </div>

      {/* Table - Desktop */}
      <div className="glass-card overflow-hidden hidden sm:block">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            กำลังโหลดข้อมูล...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            ไม่พบรายการ Pick Asset
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="glass-table w-full">
                <thead>
                  <tr className="bg-black/2">
                    <th>Document No.</th>
                    <th>Warehouse</th>
                    <th>Shop Name</th>
                    <th>Progress</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => {
                    const statusInfo = statusConfig[item.status] || { text: item.status, className: "status-badge" };
                    const progress = item.totalItems > 0 ? Math.round((item.pickedItems / item.totalItems) * 100) : 0;
                    return (
                      <tr key={item.id}>
                        <td className="font-medium text-primary">{item.docCode}</td>
                        <td>{item.warehouse}</td>
                        <td>{item.shopName}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-black/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{item.pickedItems}/{item.totalItems}</span>
                          </div>
                        </td>
                        <td className="text-muted-foreground">{formatDate(item.createdAt)}</td>
                        <td>
                          <span className={statusInfo.className}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {statusInfo.text}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleViewTask(item.documentId, item.shopCode || "")}
                              className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                              title="ดำเนินการ"
                            >
                              <SquareArrowOutUpRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center p-4 border-t border-black/5">
              <span className="text-sm text-muted-foreground">
                แสดง {filteredData.length} จาก {tasks.length} รายการ
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => prev - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-sm font-medium">{currentPage}/{totalPages}</span>
                <button
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cards - Mobile */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="glass-card p-8 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            กำลังโหลด...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
            ไม่พบรายการ
          </div>
        ) : (
          <>
            {filteredData.map((item) => {
              const statusInfo = statusConfig[item.status] || { text: item.status, className: "status-badge" };
              const progress = item.totalItems > 0 ? Math.round((item.pickedItems / item.totalItems) * 100) : 0;
              return (
                <div key={item.id} className="glass-card p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{item.docCode}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.shopName}</p>
                    </div>
                    <span className={statusInfo.className}>{statusInfo.text}</span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Warehouse</span>
                      <span className="font-medium">{item.warehouse}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{item.pickedItems}/{item.totalItems}</span>
                      </div>
                      <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleViewTask(item.documentId, item.shopCode || "")}
                    className="w-full py-2.5 rounded-lg bg-blue-50 text-blue-600 font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <SquareArrowOutUpRight className="w-4 h-4" />
                    ดำเนินการ
                  </button>
                </div>
              );
            })}

            {/* Mobile Pagination */}
            <div className="flex justify-center items-center gap-4 py-4">
              <button
                onClick={() => setCurrentPage((prev) => prev - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-black/5 text-sm disabled:opacity-50"
              >
                ก่อนหน้า
              </button>
              <span className="text-sm font-medium">{currentPage}/{totalPages}</span>
              <button
                onClick={() => setCurrentPage((prev) => prev + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-black/5 text-sm disabled:opacity-50"
              >
                ถัดไป
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}