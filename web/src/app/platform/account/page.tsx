"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { clearSession, getUser, type SessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The platform owner's own account.
 *
 * Exists because the console had no way to change the bootstrap password: that
 * account is created by a script with a generated password, and without this
 * screen the only way to change it was to re-run the script on the server.
 */
export default function PlatformAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);

  useEffect(() => setUser(getUser()), []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (next.length < 8) {
      setMessage({ type: "destructive", text: "The new password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setMessage({ type: "destructive", text: "The two new passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      await api.post("/auth/change-password", { currentPassword: current, newPassword: next });
      // Changing a password revokes every session, including this one, so there
      // is no point staying on the page — send them back to sign in.
      setMessage({ type: "success", text: "Password changed. Signing you out…" });
      setTimeout(() => {
        clearSession();
        router.replace("/login");
      }, 1500);
    } catch (err) {
      setMessage({
        type: "destructive",
        text: err instanceof Error ? err.message : "Could not change the password",
      });
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/platform" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to schools
      </Link>

      <PageHeader title="Your account" description={user?.email} />

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      <Card>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            This account controls every school on the platform, so give it a password you
            use nowhere else. Changing it signs you out of all devices.
          </p>
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <Label>Current password</Label>
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div>
              <Label>New password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
