"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Contact, LayoutDashboard, Users, GraduationCap, BookOpen, School, CalendarCheck,
  ClipboardList, FileText, PenLine, Wallet, Receipt, Megaphone, MessageSquare,
  Settings, UserCog, X, TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: SessionUser["role"][];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT", "STUDENT", "ACCOUNTANT"] },
  { href: "/dashboard/students", label: "Students", icon: GraduationCap, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"] },
  { href: "/dashboard/parents", label: "Parents", icon: Contact, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"] },
  { href: "/dashboard/teachers", label: "Teachers", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/dashboard/classes", label: "Classes", icon: School, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
  { href: "/dashboard/subjects", label: "Subjects", icon: BookOpen, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
  { href: "/dashboard/results", label: "Results", icon: ClipboardList, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
  { href: "/dashboard/comments", label: "Report Comments", icon: PenLine, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
  { href: "/dashboard/report-cards", label: "Report Cards", icon: FileText, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT", "STUDENT"] },
  { href: "/dashboard/fees", label: "Fees", icon: Wallet, roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "PARENT", "STUDENT"] },
  { href: "/dashboard/payments", label: "Payments", icon: Receipt, roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "PARENT"] },
  { href: "/dashboard/expenditures", label: "Expenditures", icon: TrendingDown, roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT", "STUDENT", "ACCOUNTANT"] },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT", "STUDENT", "ACCOUNTANT"] },
  { href: "/dashboard/users", label: "User Accounts", icon: UserCog, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/dashboard/settings", label: "School Settings", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN"] },
];

export function Sidebar({
  user,
  school,
  open,
  onClose,
}: {
  user: SessionUser;
  school: { name: string; logoUrl: string | null } | null;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b px-4">
          {school?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logoUrl} alt="School logo" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {(school?.name ?? "CPS").slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">{school?.name ?? "Carlspat Private School"}</p>
            <p className="truncate text-[11px] text-muted-foreground">Management System</p>
          </div>
          <button className="ml-auto rounded-md p-1 hover:bg-secondary lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map((item) => {
            const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
