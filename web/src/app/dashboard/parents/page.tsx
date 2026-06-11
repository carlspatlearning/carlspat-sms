"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, Plus, Search } from "lucide-react";
import { api, ApiResponse, Paginated } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface ParentRow {
  id: string;
  occupation: string | null;
  address: string | null;
  user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; isActive: boolean };
  students: { id: string; firstName: string; lastName: string; admissionNo: string; classRoom: { name: string } | null }[];
}
interface StudentOpt { id: string; firstName: string; lastName: string; admissionNo: string }

export default function ParentsPage() {
  const user = getUser();
  const isAdmin = user && ["SUPER_ADMIN", "ADMIN"].includes(user.role);
  const [data, setData] = useState<Paginated<ParentRow> | null>(null);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [linkParent, setLinkParent] = useState<ParentRow | null>(null);
  const [linkStudentId, setLinkStudentId] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", occupation: "", address: "",
  });

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (q) params.set("q", q);
    api.get<ApiResponse<Paginated<ParentRow>>>(`/parents?${params}`).then((r) => setData(r.data)).catch(() => null);
  }, [q, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    api.get<ApiResponse<{ items: StudentOpt[] }>>("/students?pageSize=100")
      .then((r) => setStudents(r.data.items))
      .catch(() => null);
  }, []);

  async function addParent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/parents", {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        occupation: form.occupation || undefined,
        address: form.address || undefined,
      });
      setAddOpen(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", password: "", occupation: "", address: "" });
      setMessage({ type: "success", text: "Parent account created. Share the login details with them securely." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to create parent" });
    } finally {
      setSaving(false);
    }
  }

  async function linkChild(e: React.FormEvent) {
    e.preventDefault();
    if (!linkParent || !linkStudentId) return;
    setSaving(true);
    try {
      await api.post(`/parents/${linkParent.id}/link`, { studentIds: [linkStudentId] });
      setMessage({ type: "success", text: "Student linked to parent." });
      setLinkParent(null);
      setLinkStudentId("");
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to link student" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Parents / Guardians" description={data ? `${data.total} parent(s)` : undefined}>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Parent
          </Button>
        )}
      </PageHeader>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search by name or email…" value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Parent</TH>
            <TH className="hidden md:table-cell">Contact</TH>
            <TH>Children</TH>
            {isAdmin && <TH></TH>}
          </TR>
        </THead>
        <TBody>
          {data?.items.map((p) => (
            <TR key={p.id}>
              <TD>
                <span className="font-medium">{p.user.firstName} {p.user.lastName}</span>
                <span className="block text-xs text-muted-foreground">{p.occupation ?? "—"}</span>
              </TD>
              <TD className="hidden text-xs md:table-cell">
                {p.user.email}
                {p.user.phone && <span className="block font-medium">{p.user.phone}</span>}
              </TD>
              <TD>
                {p.students.length === 0 && <span className="text-xs text-muted-foreground">No children linked</span>}
                {p.students.map((s) => (
                  <Badge key={s.id} variant="secondary" className="mb-0.5 mr-1">
                    {s.firstName} {s.lastName}{s.classRoom ? ` · ${s.classRoom.name}` : ""}
                  </Badge>
                ))}
              </TD>
              {isAdmin && (
                <TD className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setLinkParent(p)}>
                    <Link2 className="h-3.5 w-3.5" /> Link child
                  </Button>
                </TD>
              )}
            </TR>
          ))}
          {data && data.items.length === 0 && (
            <TR><TD colSpan={4} className="py-8 text-center text-muted-foreground">No parents found.</TD></TR>
          )}
        </TBody>
      </Table>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {data.page} of {data.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add parent / guardian">
        <form onSubmit={addParent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pfn">First name</Label>
              <Input id="pfn" required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="pln">Last name</Label>
              <Input id="pln" required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pph">Phone number</Label>
              <Input id="pph" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="080…" />
            </div>
            <div>
              <Label htmlFor="pem">Email (their portal login)</Label>
              <Input id="pem" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="ppw">Temporary password (give this to the parent)</Label>
            <Input id="ppw" required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="At least 8 characters with a letter and a number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pocc">Occupation</Label>
              <Input id="pocc" value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="paddr">Address</Label>
              <Input id="paddr" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create parent account
          </Button>
        </form>
      </Dialog>

      <Dialog open={Boolean(linkParent)} onClose={() => setLinkParent(null)} title={`Link a child to ${linkParent?.user.firstName ?? ""} ${linkParent?.user.lastName ?? ""}`}>
        <form onSubmit={linkChild} className="space-y-4">
          <div>
            <Label htmlFor="lstu">Student</Label>
            <Select id="lstu" required value={linkStudentId} onChange={(e) => setLinkStudentId(e.target.value)}>
              <option value="">— Select student —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Link student
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
