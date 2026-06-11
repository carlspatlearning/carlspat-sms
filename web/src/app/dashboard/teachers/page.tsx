"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { api, ApiResponse, Paginated } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface TeacherRow {
  id: string;
  staffNo: string;
  qualification: string | null;
  specialization: string | null;
  user: { email: string; firstName: string; lastName: string; phone: string | null; isActive: boolean };
  formClasses: { name: string }[];
  classSubjects: { subject: { name: string }; classRoom: { name: string } }[];
}

export default function TeachersPage() {
  const [data, setData] = useState<Paginated<TeacherRow> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", qualification: "", specialization: "",
  });

  const load = useCallback(() => {
    api.get<ApiResponse<Paginated<TeacherRow>>>("/teachers?pageSize=50").then((r) => setData(r.data)).catch(() => null);
  }, []);
  useEffect(load, [load]);

  async function addTeacher(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/teachers", {
        ...form,
        phone: form.phone || undefined,
        qualification: form.qualification || undefined,
        specialization: form.specialization || undefined,
      });
      setDialogOpen(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", password: "", qualification: "", specialization: "" });
      setMessage({ type: "success", text: "Teacher account created. Share the login details with them securely." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to create teacher" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Teachers" description={data ? `${data.total} teacher(s)` : undefined}>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add Teacher
        </Button>
      </PageHeader>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      <Table>
        <THead>
          <TR>
            <TH>Teacher</TH>
            <TH>Staff No</TH>
            <TH className="hidden md:table-cell">Contact</TH>
            <TH className="hidden lg:table-cell">Assignments</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {data?.items.map((t) => (
            <TR key={t.id}>
              <TD>
                <span className="font-medium">{t.user.firstName} {t.user.lastName}</span>
                <span className="block text-xs text-muted-foreground">
                  {[t.qualification, t.specialization].filter(Boolean).join(" · ") || "—"}
                </span>
              </TD>
              <TD className="font-mono text-xs">{t.staffNo}</TD>
              <TD className="hidden text-xs md:table-cell">
                {t.user.email}
                {t.user.phone && <span className="block">{t.user.phone}</span>}
              </TD>
              <TD className="hidden text-xs lg:table-cell">
                {t.formClasses.map((c) => (
                  <Badge key={c.name} variant="secondary" className="mb-0.5 mr-1">Form: {c.name}</Badge>
                ))}
                {t.classSubjects.slice(0, 3).map((cs, i) => (
                  <Badge key={i} variant="outline" className="mb-0.5 mr-1">{cs.subject.name} · {cs.classRoom.name}</Badge>
                ))}
                {t.classSubjects.length > 3 && <span className="text-muted-foreground">+{t.classSubjects.length - 3} more</span>}
              </TD>
              <TD>
                <Badge variant={t.user.isActive ? "success" : "destructive"}>{t.user.isActive ? "Active" : "Disabled"}</Badge>
              </TD>
            </TR>
          ))}
          {data && data.items.length === 0 && (
            <TR><TD colSpan={5} className="py-8 text-center text-muted-foreground">No teachers yet.</TD></TR>
          )}
        </TBody>
      </Table>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add teacher">
        <form onSubmit={addTeacher} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tfn">First name</Label>
              <Input id="tfn" required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="tln">Last name</Label>
              <Input id="tln" required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="tem">Email (login)</Label>
            <Input id="tem" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tph">Phone</Label>
              <Input id="tph" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="tpw">Temporary password</Label>
              <Input id="tpw" required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tq">Qualification</Label>
              <Input id="tq" placeholder="B.Ed, NCE…" value={form.qualification} onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="ts">Specialization</Label>
              <Input id="ts" placeholder="Mathematics…" value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create teacher account
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
