"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { getUser, type SessionUser } from "@/lib/auth";
import { api, ApiResponse } from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [school, setSchool] = useState<{ name: string; logoUrl: string | null } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    api
      .get<ApiResponse<{ name: string; logoUrl: string | null }>>("/settings/school")
      .then((r) => setSchool(r.data))
      .catch(() => null);
  }, [router]);

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <div className="no-print">
        <Sidebar user={user} school={school} open={menuOpen} onClose={() => setMenuOpen(false)} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
