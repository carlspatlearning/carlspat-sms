"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { api, ApiResponse, Paginated } from "@/lib/api";
import { formatDate, ROLE_LABELS } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface UserRow {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function UsersPage() {
  const [data, setData] = useState<Paginated<UserRow> | null>(null);
  const [role, setRole] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "ACCOUNTANT" });

  const load = useCallback(() => {
    const params = new URLSearchParams({ pageSize: "50" });
    if (role) params.set("role", role);
    api.get<ApiResponse<Paginated<UserRow>>>(`/users?${params}`).then((r) => setData(r.data)).catch(() => null);
  }, [role]);
  useEffect(load, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/users", form);
      setDialogOpen(false);
      setForm({ firstName: "", lastName: "", email: "", password: "", role: "ACCOUNTANT" });
      setMessage({ type: "success", text: "Account created." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserRow) {
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    }
  }

  return (
    <div>
      <PageHeader title="User Accounts" description="Login accounts and account status">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add Account
        </Button>
      </PageHeader>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      <div className="mb-4 max-w-xs">
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>User</TH>
            <TH>Role</TH>
            <TH className="hidden md:table-cell">Last Login</TH>
            <TH>Status</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {data?.items.map((u) => (
            <TR key={u.id}>
              <TD>
                <span className="font-medium">{u.firstName} {u.lastName}</span>
                <span className="block text-xs text-muted-foreground">{u.email}</span>
              </TD>
              <TD><Badge variant="secondary">{ROLE_LABELS[u.role]}</Badge></TD>
              <TD className="hidden text-xs md:table-cell">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</TD>
              <TD><Badge variant={u.isActive ? "success" : "destructive"}>{u.isActive ? "Active" : "Disabled"}</Badge></TD>
              <TD className="text-right">
                <Button variant="outline" size="sm" onClick={() => toggleActive(u)}>
                  {u.isActive ? "Disable" : "Enable"}
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Create account">
        <form onSubmit={createUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ufn">First name</Label>
              <Input id="ufn" required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="uln">Last name</Label>
              <Input id="uln" required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="uem">Email</Label>
            <Input id="uem" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="upw">Temporary password</Label>
              <Input id="upw" required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="urole">Role</Label>
              <Select id="urole" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="ACCOUNTANT">Bursar / Accountant</option>
                <option value="ADMIN">School Admin</option>
                <option value="TEACHER">Teacher</option>
                <option value="PARENT">Parent</option>
                <option value="STUDENT">Student</option>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create account
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
