"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, LogOut } from "lucide-react";
import { clearSession, getUser, type SessionUser } from "@/lib/auth";

/**
 * Chrome for the platform console. Deliberately separate from the school
 * dashboard layout: this area has no school context, so none of the school
 * navigation, branding or current-term lookups apply here.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    // A school user who wanders in is sent to their own dashboard. The API
    // refuses them regardless; this only avoids showing an empty console.
    if (u.role !== "PLATFORM_OWNER") {
      router.replace("/dashboard");
      return;
    }
    setUser(u);
  }, [router]);

  if (!user) return null;

  function signOut() {
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/platform" className="flex items-center gap-2 font-semibold">
            <Building2 className="h-5 w-5" />
            School Platform
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              {user.firstName} {user.lastName}
            </span>
            <button onClick={signOut} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
