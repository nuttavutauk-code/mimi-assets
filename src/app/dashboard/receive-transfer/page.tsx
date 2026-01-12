"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Search, ArrowRight, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type TransferDocument = {
    id: number;
    docCode: string;
    fromWarehouse: string;
    senderName: string;
    senderPhone: string;
    transferDate: string;
    totalAssets: number;
    receivedAssets: number;
    rejectedAssets: number;
    status: "pending" | "received" | "received_with_rejected";
};

const statusConfig = {
    pending: { label: "รอตรวจสอบ", color: "bg-yellow-100 text-yellow-700", icon: Clock },
    received: { label: "รับครบแล้ว", color: "bg-green-100 text-green-700", icon: CheckCircle },
    received_with_rejected: { label: "รับแล้ว(มียกเลิก)", color: "bg-orange-100 text-orange-700", icon: AlertTriangle },
};

export default function ReceiveTransferPage() {
    const router = useRouter();
    const [documents, setDocuments] = useState<TransferDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/receive-transfer");
            const data = await res.json();
            if (data.success) {
                setDocuments(data.documents);
            }
        } catch (error) {
            console.error("Error fetching documents:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDocuments = documents.filter((doc) => {
        const matchesSearch =
            doc.docCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.fromWarehouse.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const formatDate = (dateString: string) => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        return date.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="icon-container blue !w-10 !h-10">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">รับของโอนย้าย</h1>
                        <p className="text-sm text-muted-foreground">ตรวจสอบและรับของที่ส่งมาจากโกดังอื่น</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="ค้นหาเลขที่เอกสาร, ชื่อผู้ส่ง, โกดัง..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 glass-input"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-48 glass-input">
                            <SelectValue placeholder="สถานะ" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">ทั้งหมด</SelectItem>
                            <SelectItem value="pending">รอตรวจสอบ</SelectItem>
                            <SelectItem value="received">รับครบแล้ว</SelectItem>
                            <SelectItem value="received_with_rejected">รับแล้ว(มียกเลิก)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table - Desktop */}
            <div className="glass-card overflow-hidden hidden lg:block">
                {loading ? (
                    <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">ไม่พบรายการ</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-black/5">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">เลขที่เอกสาร</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">จากโกดัง</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ผู้ส่ง</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">เบอร์โทร</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">วันที่ส่ง</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">จำนวน Asset</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">สถานะ</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                                {filteredDocuments.map((doc, index) => {
                                    const config = statusConfig[doc.status];
                                    const StatusIcon = config.icon;
                                    return (
                                        <tr key={doc.id} className="hover:bg-black/2">
                                            <td className="px-4 py-3 text-sm">{index + 1}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-primary">{doc.docCode}</td>
                                            <td className="px-4 py-3 text-sm">{doc.fromWarehouse}</td>
                                            <td className="px-4 py-3 text-sm">{doc.senderName}</td>
                                            <td className="px-4 py-3 text-sm">{doc.senderPhone}</td>
                                            <td className="px-4 py-3 text-sm">{formatDate(doc.transferDate)}</td>
                                            <td className="px-4 py-3 text-sm">{doc.totalAssets} รายการ</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {config.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => router.push(`/dashboard/receive-transfer/${doc.id}`)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium transition-colors"
                                                >
                                                    {doc.status === "pending" ? "ตรวจสอบ" : "ดูรายละเอียด"}
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
                {loading ? (
                    <div className="glass-card p-8 text-center text-muted-foreground">กำลังโหลด...</div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="glass-card p-8 text-center text-muted-foreground">ไม่พบรายการ</div>
                ) : (
                    filteredDocuments.map((doc, index) => {
                        const config = statusConfig[doc.status];
                        const StatusIcon = config.icon;
                        return (
                            <div key={doc.id} className="glass-card p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground">#{index + 1}</p>
                                        <p className="font-semibold text-primary">{doc.docCode}</p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {config.label}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground">จากโกดัง</p>
                                        <p className="font-medium">{doc.fromWarehouse}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">วันที่ส่ง</p>
                                        <p className="font-medium">{formatDate(doc.transferDate)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">ผู้ส่ง</p>
                                        <p className="font-medium">{doc.senderName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">เบอร์โทร</p>
                                        <p className="font-medium">{doc.senderPhone}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">จำนวน Asset</p>
                                        <p className="font-medium">{doc.totalAssets} รายการ</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push(`/dashboard/receive-transfer/${doc.id}`)}
                                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium transition-colors"
                                >
                                    {doc.status === "pending" ? "ตรวจสอบ" : "ดูรายละเอียด"}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}