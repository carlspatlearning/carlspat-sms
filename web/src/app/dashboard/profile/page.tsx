"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { clearSession, getUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const router = useRouter();
  const user = getUser();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setMessage({ type: "destructive", text: "New passwords do not match" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.post("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      clearSession();
      router.push("/login");
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to change password" });
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="My Profile" />

      <Card className="mb-4">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div>
            <p className="font-semibold">{user.firstName} {user.lastName}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <Badge variant="secondary" className="mt-1">{ROLE_LABELS[user.role]}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            At least 8 characters with a letter and a number. You will be logged out everywhere after changing it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            {message && <Alert variant={message.type}>{message.text}</Alert>}
            <div>
              <Label htmlFor="cur">Current password</Label>
              <Input id="cur" type="password" required autoComplete="current-password" value={form.currentPassword}
                onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="new">New password</Label>
              <Input id="new" type="password" required minLength={8} autoComplete="new-password" value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="cnf">Confirm new password</Label>
              <Input id="cnf" type="password" required minLength={8} autoComplete="new-password" value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
