"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit2, Trash2, X, Users, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  vendor?: string;
  initials?: string;
  company?: string;
  phone?: string;
  role?: string;
  email?: string;
  createdAt?: string;
}

export default function AdminUserManage() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isModalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: "", email: "", password: "", firstName: "", lastName: "",
    vendor: "", initials: "", company: "", phone: "", role: "USER",
  });

  const fetchUsers = async (pageNum = 1) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/user?page=${pageNum}&limit=10`);
      const data = await res.json();
      setUsers(data.data || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(page); }, [page]);

  const filtered = users.filter((u) =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(search.toLowerCase()) ||
    u.company?.toLowerCase().includes(search.toLowerCase()) ||
    u.vendor?.toLowerCase().includes(search.toLowerCase())
  );

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ username: "", email: "", password: "", firstName: "", lastName: "", vendor: "", initials: "", company: "", phone: "", role: "USER" });
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username || "", email: user.email || "", password: "",
      firstName: user.firstName || "", lastName: user.lastName || "",
      vendor: user.vendor || "", initials: user.initials || "",
      company: user.company || "", phone: user.phone || "", role: user.role || "USER",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const url = editingUser ? `/api/user/${editingUser.id}` : "/api/user";
      const method = editingUser ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(editingUser ? "อัปเดตผู้ใช้สำเร็จ" : "เพิ่มผู้ใช้สำเร็จ");
        setModalOpen(false);
        fetchUsers(page);
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      toast.error("ไม่สามารถเชื่อมต่อ API ได้");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await fetch(`/api/user/${confirmDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("ลบผู้ใช้สำเร็จ");
        setConfirmDelete(null);
        fetchUsers(page);
      } else {
        toast.error("เกิดข้อผิดพลาดในการลบ");
      }
    } catch (err) {
      toast.error("ไม่สามารถเชื่อมต่อ API ได้");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-container blue !w-10 !h-10"><Users className="w-5 h-5" /></div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">User Management</h1>
          </div>
          <p className="text-sm text-muted-foreground">จัดการบัญชีผู้ใช้งานในระบบ</p>
        </div>
        <button onClick={openAddModal} className="gradient-button px-5 py-2.5 text-sm font-medium flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />เพิ่มผู้ใช้
        </button>
      </div>

      {/* Search */}
      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input placeholder="ค้นหา username, ชื่อ, company..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 glass-input" />
        </div>
      </div>

      {/* Table - Desktop */}
      <div className="glass-card overflow-hidden hidden sm:block">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" />ไม่พบผู้ใช้</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="glass-table w-full">
                <thead><tr className="bg-black/2"><th>Username</th><th>ชื่อ</th><th>Vendor</th><th>Company</th><th>Role</th><th className="text-center">จัดการ</th></tr></thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                            {user.username?.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium">{user.username}</span>
                        </div>
                      </td>
                      <td>{user.firstName} {user.lastName}</td>
                      <td>{user.vendor || "-"}</td>
                      <td>{user.company || "-"}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${user.role === "ADMIN" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-center gap-1">
                          <button onClick={() => openEditModal(user)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setConfirmDelete(user)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center p-4 border-t border-black/5">
              <span className="text-sm text-muted-foreground">หน้า {page}/{totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-3 text-sm font-medium">{page}</span>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cards - Mobile */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="glass-card p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">ไม่พบผู้ใช้</div>
        ) : (
          <>
            {filtered.map((user) => (
              <div key={user.id} className="glass-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium">
                    {user.username?.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{user.username}</p>
                    <p className="text-xs text-muted-foreground">{user.firstName} {user.lastName}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${user.role === "ADMIN" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"}`}>
                    {user.role}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(user)} className="flex-1 py-2.5 rounded-lg bg-blue-50 text-blue-600 font-medium text-sm flex items-center justify-center gap-1">
                    <Edit2 className="w-4 h-4" />แก้ไข
                  </button>
                  <button onClick={() => setConfirmDelete(user)} className="py-2.5 px-4 rounded-lg bg-red-50 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">{editingUser ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}</h2>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg hover:bg-black/5"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Username *</label>
                  <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="glass-input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="glass-input" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Password {editingUser ? "(เว้นว่างถ้าไม่เปลี่ยน)" : "*"}</label>
                <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="glass-input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">ชื่อ</label>
                  <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="glass-input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">นามสกุล</label>
                  <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="glass-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Vendor</label>
                  <Input value={formData.vendor} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} className="glass-input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Initials</label>
                  <Input value={formData.initials} onChange={(e) => setFormData({ ...formData, initials: e.target.value })} className="glass-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Company</label>
                  <Input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="glass-input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
                  <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="glass-input" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-3 py-2 rounded-xl glass-input">
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl bg-black/5 text-foreground font-medium">ยกเลิก</button>
              <button onClick={handleSave} className="flex-1 gradient-button py-2.5 font-medium">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="glass-card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-2">ยืนยันการลบ</h3>
            <p className="text-sm text-muted-foreground mb-6">คุณต้องการลบผู้ใช้ <span className="font-medium text-foreground">{confirmDelete.username}</span> หรือไม่?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl bg-black/5 text-foreground font-medium">ยกเลิก</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium">ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
