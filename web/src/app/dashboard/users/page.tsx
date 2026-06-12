"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  phone: string | null;
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
  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "ADMIN" });

  function openEdit(u: UserRow) {
    setEditUser(u);
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone ?? "",
      role: u.role,
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      await api.patch(`/users/${editUser.id}`, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone || undefined,
        ...(editForm.role !== editUser.role ? { role: editForm.role } : {}),
      });
      setEditUser(null);
      setMessage({ type: "success", text: "Account updated." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to update account" });
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(u: UserRow) {
    if (!confirm(`Remove the account of ${u.firstName} ${u.lastName} (${u.email})?`)) return;
    try {
      const r = await api.delete<{ message: string }>(`/users/${u.id}`);
      setMessage({ type: "success", text: r.message });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to remove account" });
    }
  }

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

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwUser) return;
    setSaving(true);
    try {
      await api.patch(`/users/${pwUser.id}`, { newPassword: pwValue });
      setMessage({
        type: "success",
        text: `Password reset for ${pwUser.firstName} ${pwUser.lastName} (${pwUser.email}). They are now logged out everywhere and must use the new password.`,
      });
      setPwUser(null);
      setPwValue("");
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to reset password" });
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
                <div className="flex justify-end gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setPwUser(u); setPwValue(""); }}>
                    <KeyRound className="h-3.5 w-3.5" /> Reset password
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleActive(u)}>
                    {u.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => removeUser(u)} aria-label="Remove account">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={Boolean(editUser)} onClose={() => setEditUser(null)} title={`Edit account — ${editUser?.email ?? ""}`}>
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="eufn">First name</Label>
              <Input id="eufn" required value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="euln">Last name</Label>
              <Input id="euln" required value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="euem">Email (login)</Label>
            <Input id="euem" type="email" required value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="euph">Phone</Label>
              <Input id="euph" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="eurole">Role</Label>
              <Select id="eurole" value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">School Admin</option>
                <option value="ACCOUNTANT">Bursar / Accountant</option>
                <option value="TEACHER">Teacher</option>
                <option value="PARENT">Parent</option>
                <option value="STUDENT">Student</option>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Role changes only apply to standalone accounts (admins/bursars). Accounts linked to a teacher,
            parent or student profile keep their role.
          </p>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </Button>
        </form>
      </Dialog>

      <Dialog open={Boolean(pwUser)} onClose={() => setPwUser(null)} title={`Reset password — ${pwUser?.firstName ?? ""} ${pwUser?.lastName ?? ""}`}>
        <form onSubmit={resetPassword} className="space-y-4">
          <div className="rounded-lg border bg-secondary/40 p-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Login email</p>
            <p className="mt-0.5 font-mono">{pwUser?.email}</p>
          </div>
          <div>
            <Label htmlFor="rpw">New password</Label>
            <Input id="rpw" required minLength={8} value={pwValue}
              placeholder="At least 8 characters with a letter and a number"
              onChange={(e) => setPwValue(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Reset password
          </Button>
        </form>
      </Dialog>

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
