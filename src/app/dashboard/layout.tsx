"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogCancel,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";

import Link from "next/link";

import {
    FileText,
    ListChecks,
    PackageOpen,
    BookOpen,
    BookOpenText,
    Settings2,
    Database,
    Store,
    Users,
    Library,
    Menu,
    X,
    Wrench,
    ShieldCheck,
    Package,
    LogOut,
    ChevronDown,
    LayoutDashboard,
} from "lucide-react";
import { signOut } from "next-auth/react";

// แยกเมนู USER
const USER_MENU = [
    { href: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
    { href: "/dashboard/user-document", label: "สร้างเอกสาร", icon: FileText },
    { href: "/dashboard/user-list", label: "รายการเอกสาร", icon: ListChecks },
    { href: "/dashboard/user-pick", label: "Pick Asset", icon: PackageOpen },
    { href: "/dashboard/receive-transfer", label: "รับของโอนย้าย", icon: Package },
    { href: "/dashboard/repair-asset", label: "Repair Asset", icon: Wrench },
    {
        group: "คลังข้อมูล",
        icon: BookOpen,
        items: [
            { href: "/dashboard/library-ses", label: "Library SES", icon: BookOpen },
            { href: "/dashboard/library-sis", label: "Library SIS", icon: BookOpenText },
        ],
    },
];

// แยกเมนู ADMIN
const ADMIN_MENU = [
    { href: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
    { href: "/dashboard/admin-list", label: "รายการเอกสาร", icon: ListChecks },
    { href: "/dashboard/admin-database", label: "Database", icon: Database },
    { href: "/dashboard/admin-database-security-set", label: "Database Security Set", icon: ShieldCheck },
    {
        group: "จัดการระบบ",
        icon: Settings2,
        items: [
            { href: "/dashboard/admin-user", label: "User", icon: Users },
            { href: "/dashboard/admin-shop", label: "Shop", icon: Store },
            { href: "/dashboard/admin-asset", label: "Asset", icon: PackageOpen },
            { href: "/dashboard/admin-library-ses", label: "Library SES", icon: Library },
            { href: "/dashboard/admin-library-sis", label: "Library SIS", icon: Library },
        ],
    },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<string[]>(["คลังข้อมูล", "จัดการระบบ"]);

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login");
    }, [status, router]);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    // ปิด scroll เมื่อเปิด mobile menu
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileMenuOpen]);

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-muted-foreground">กำลังโหลด...</div>
            </div>
        );
    }

    const role = session?.user?.role?.toUpperCase() || "USER";
    const vendor = session?.user?.vendor || "";
    const username = session?.user?.username || session?.user?.name || "";
    const initials = vendor ? vendor.substring(0, 2).toUpperCase() : username.substring(0, 2).toUpperCase();

    const MENU = role === "ADMIN" ? ADMIN_MENU : USER_MENU;

    const handleLogout = async () => {
        await signOut({ redirect: false });
        router.replace("/login");
        router.refresh();
    };

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev =>
            prev.includes(group)
                ? prev.filter(g => g !== group)
                : [...prev, group]
        );
    };

    // Component สำหรับ render menu items
    const MenuItems = ({ onItemClick }: { onItemClick?: () => void }) => (
        <div className="space-y-1">
            {MENU.map((item, idx) =>
                item.group ? (
                    <div key={item.group} className="mt-4">
                        <button
                            onClick={() => toggleGroup(item.group!)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                        >
                            <span>{item.group}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedGroups.includes(item.group!) ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedGroups.includes(item.group!) && (
                            <div className="mt-1 space-y-0.5">
                                {item.items.map((sub) => {
                                    const SubIcon = sub.icon;
                                    return (
                                        <Link
                                            key={sub.href}
                                            href={sub.href}
                                            onClick={onItemClick}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname === sub.href
                                                ? "nav-link-active"
                                                : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                                                }`}
                                        >
                                            <SubIcon className="w-5 h-5" />
                                            {sub.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <Link
                        key={item.href}
                        href={item.href!}
                        onClick={onItemClick}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname === item.href
                            ? "nav-link-active"
                            : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                            }`}
                    >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                    </Link>
                )
            )}
        </div>
    );

    return (
        <div className="min-h-screen relative bg-background">
            {/* Background - Desktop only */}
            <div className="liquid-glass-bg hidden lg:block" />
            <div className="orb orb-1 hidden lg:block" />
            <div className="orb orb-2 hidden lg:block" />
            <div className="orb orb-3 hidden lg:block" />

            {/* ===== Mobile Header ===== */}
            <header className="lg:hidden sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-black/5">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9">
                            <img src="/mimi-logo.png" alt="MiMi Assets" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold text-foreground">MiMi Assets</h1>
                            <p className="text-xs text-muted-foreground">
                                {role === "ADMIN" ? "Admin" : "User"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 -mr-2 text-foreground"
                    >
                        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div 
                    className="lg:hidden fixed inset-0 z-40 bg-black/20"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Menu Drawer */}
            <div className={`lg:hidden fixed top-0 left-0 bottom-0 w-[280px] z-50 bg-white transform transition-transform duration-200 ease-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* User Profile */}
                <div className="p-4 border-b border-black/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-semibold text-sm">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{username || "-"}</p>
                            <p className="text-xs text-muted-foreground truncate">{vendor || "-"}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto p-3">
                    <MenuItems onItemClick={() => setMobileMenuOpen(false)} />
                </nav>

                {/* Logout */}
                <div className="p-3 border-t border-black/5">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-50 text-red-500 font-medium text-sm">
                                <LogOut className="w-5 h-5" />
                                ออกจากระบบ
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>ยืนยันการออกระบบ</AlertDialogTitle>
                                <AlertDialogDescription>
                                    คุณต้องการออกจากระบบหรือไม่?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-red-500 hover:bg-red-600 text-white"
                                    onClick={handleLogout}
                                >
                                    ยืนยัน
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* ===== Main Layout ===== */}
            <div className="flex">
                {/* ===== Desktop Sidebar ===== */}
                <aside className="hidden lg:flex lg:flex-col lg:w-[260px] lg:fixed lg:inset-y-0 glass-sidebar z-40">
                    {/* Brand */}
                    <div className="p-5 border-b border-black/5">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11">
                                <img src="/mimi-logo.png" alt="MiMi Assets" className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <h1 className="text-base font-semibold text-foreground">MiMi Assets</h1>
                                <p className="text-xs text-muted-foreground">
                                    {role === "ADMIN" ? "Admin Panel" : "User Portal"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* User Profile */}
                    <div className="px-4 py-3 border-b border-black/5">
                        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-black/3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-semibold text-sm">
                                {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{username || "-"}</p>
                                <p className="text-xs text-muted-foreground truncate">{vendor || "-"}</p>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto p-3">
                        <MenuItems />
                    </nav>

                    {/* Logout Button */}
                    <div className="p-3 border-t border-black/5">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 text-red-500 font-medium text-sm hover:bg-red-100 transition-colors">
                                    <LogOut className="w-4 h-4" />
                                    ออกจากระบบ
                                </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>ยืนยันการออกระบบ</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        คุณต้องการออกจากระบบหรือไม่?
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-red-500 hover:bg-red-600 text-white"
                                        onClick={handleLogout}
                                    >
                                        ยืนยัน
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </aside>

                {/* ===== Main Content ===== */}
                <main className="flex-1 lg:ml-[260px] min-h-screen">
                    {/* Page Content */}
                    <div className="p-4 lg:p-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}