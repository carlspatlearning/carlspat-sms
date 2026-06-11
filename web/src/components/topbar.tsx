"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Menu, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { clearSession, type SessionUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/utils";

export function Topbar({ user, onMenu }: { user: SessionUser; onMenu: () => void }) {
  const router = useRouter();

  function logout() {
    clearSession();
    router.push("/login");
  }

  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <Link href="/dashboard/profile" className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary">
          <UserCircle className="h-6 w-6 text-muted-foreground" />
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight">
              {user.firstName} {user.lastName}
            </span>
            <span className="block text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </span>
        </Link>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out" title="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
