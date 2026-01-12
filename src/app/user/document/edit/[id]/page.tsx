"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

export default function EditDocumentPage() {
    const { id } = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [document, setDocument] = useState<any>(null);

    const typeMap: Record<string, string> = {
        withdraw: "ใบเบิก Asset",
        routing2shops: "ใบ Routing 2 shops",
        routing3shops: "ใบ Routing 3 shops",
        routing4shops: "ใบ Routing 4 shops",
        other: "ใบเบิกของอื่นๆ",
        transfer: "ใบย้ายของ",
        borrowSecurity: "ใบยืม+Security",
        borrow: "ใบยืม",
        returnAsset: "ใบเก็บ Asset กลับ",
        shopToShop: "ใบย้ายของ Shop to Shop",
    };

    const statusMap = {
        submitted: "รออนุมัติ",
        approved: "อนุมัติแล้ว",
        rejected: "รอแก้ไข",
    };

    // ✅ โหลดข้อมูลเอกสาร
    const fetchDocument = async () => {
        try {
            const res = await fetch(`/api/document/${id}`);
            const json = await res.json();
            if (json.success) {
                setDocument(json.document);
            } else {
                throw new Error(json.message || "ไม่พบเอกสาร");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchDocument();
    }, [id]);

    // ✅ บันทึกข้อมูล
    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/document/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(document),
            });
            const json = await res.json();

            if (res.ok && json.success) {
                toast.success("บันทึกข้อมูลสำเร็จ");
                router.push("/user/document/list");
            } else {
                toast.error(json.message || "บันทึกไม่สำเร็จ");
            }
        } catch (err) {
            console.error(err);
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6 text-center text-gray-500">กำลังโหลดข้อมูล...</div>;
    if (error) return <div className="p-6 text-center text-red-500">{error}</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-lg font-semibold">แก้ไขเอกสาร</h1>

            <Card className="rounded-xl shadow-sm p-6 space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-600">Document No.</label>
                    <Input
                        value={document.docCode || ""}
                        onChange={(e) => setDocument({ ...document, docCode: e.target.value })}
                        className="mt-1"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-600">Vendor</label>
                    <Input
                        value={document.company || ""}
                        onChange={(e) => setDocument({ ...document, company: e.target.value })}
                        className="mt-1"
                    />
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-600">Document Type</label>
                    <Select
                        value={document.documentType || ""}
                        onValueChange={(v) => setDocument({ ...document, documentType: v })}
                    >
                        <SelectTrigger className="mt-1">
                            <SelectValue placeholder="เลือกประเภทเอกสาร" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(typeMap).map(([key, label]) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <Select
                        value={document.status || ""}
                        onValueChange={(v) => setDocument({ ...document, status: v })}
                    >
                        <SelectTrigger className="mt-1">
                            <SelectValue placeholder="เลือกสถานะ" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(statusMap).map(([key, label]) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={() => router.back()}>
                        ยกเลิก
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-black text-white hover:bg-gray-800">
                        {saving ? "กำลังบันทึก..." : "บันทึก"}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
