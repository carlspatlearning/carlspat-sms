"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiResponse, Paginated } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface TeacherRow {
  id: string;
  staffNo: string;
  qualification: string | null;
  specialization: string | null;
  user: { email: string; firstName: string; lastName: string; phone: string | null; isActive: boolean };
  formClasses: { name: string }[];
  classSubjects: { classRoomId: string; subjectId: string; subject: { name: string }; classRoom: { name: string } }[];
}
interface ClassRoom { id: string; name: string }
interface Subject { id: string; name: string }

export default function TeachersPage() {
  const [data, setData] = useState<Paginated<TeacherRow> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Add teacher dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", qualification: "", specialization: "",
  });

  // Edit teacher dialog
  const [editTeacher, setEditTeacher] = useState<TeacherRow | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", qualification: "", specialization: "",
  });

  // Assign subjects dialog
  const [assignTeacher, setAssignTeacher] = useState<TeacherRow | null>(null);
  const [allClasses, setAllClasses] = useState<ClassRoom[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [assignClassId, setAssignClassId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [assignSaving, setAssignSaving] = useState(false);

  function openAssign(t: TeacherRow) {
    setAssignTeacher(t);
    setAssignClassId((prev) => prev || allClasses[0]?.id || "");
  }

  // When class changes in the assign dialog, pre-check what this teacher already teaches there
  useEffect(() => {
    if (!assignTeacher || !assignClassId) return;
    const already = new Set(
      assignTeacher.classSubjects
        .filter((cs) => cs.classRoomId === assignClassId)
        .map((cs) => cs.subjectId)
    );
    setSelectedSubjectIds(already);
  }, [assignTeacher, assignClassId]);

  // Initialise assign class when dialog opens
  useEffect(() => {
    if (assignTeacher && allClasses.length && !assignClassId) {
      setAssignClassId(allClasses[0].id);
    }
  }, [assignTeacher, allClasses, assignClassId]);

  function toggleSubject(id: string) {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedSubjectIds.size === allSubjects.length) {
      setSelectedSubjectIds(new Set());
    } else {
      setSelectedSubjectIds(new Set(allSubjects.map((s) => s.id)));
    }
  }

  async function saveAssignments() {
    if (!assignTeacher || !assignClassId) return;
    setAssignSaving(true);
    try {
      await api.put(`/teachers/${assignTeacher.id}/subjects`, {
        classRoomId: assignClassId,
        subjectIds: [...selectedSubjectIds],
      });
      setMessage({ type: "success", text: "Subject assignments saved." });
      setAssignTeacher(null);
      setAssignClassId("");
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setAssignSaving(false);
    }
  }

  function openEdit(t: TeacherRow) {
    setEditTeacher(t);
    setEditForm({
      firstName: t.user.firstName,
      lastName: t.user.lastName,
      email: t.user.email,
      phone: t.user.phone ?? "",
      qualification: t.qualification ?? "",
      specialization: t.specialization ?? "",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTeacher) return;
    setSaving(true);
    try {
      await api.put(`/teachers/${editTeacher.id}`, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone || undefined,
        qualification: editForm.qualification || undefined,
        specialization: editForm.specialization || undefined,
      });
      setEditTeacher(null);
      setMessage({ type: "success", text: "Teacher updated." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to update teacher" });
    } finally {
      setSaving(false);
    }
  }

  async function removeTeacher(t: TeacherRow) {
    if (!confirm(`Remove ${t.user.firstName} ${t.user.lastName}? If they have recorded scores or attendance, their account will be deactivated instead.`)) return;
    try {
      const r = await api.delete<{ message: string }>(`/teachers/${t.id}`);
      setMessage({ type: "success", text: r.message });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to remove teacher" });
    }
  }

  const load = useCallback(() => {
    api.get<ApiResponse<Paginated<TeacherRow>>>("/teachers?pageSize=50").then((r) => setData(r.data)).catch(() => null);
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    api.get<ApiResponse<ClassRoom[]>>("/classes").then((r) => setAllClasses(r.data)).catch(() => null);
    api.get<ApiResponse<Subject[]>>("/subjects").then((r) => setAllSubjects(r.data)).catch(() => null);
  }, []);

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
            <TH></TH>
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
              <TD className="text-right">
                <div className="flex justify-end gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => openAssign(t)} title="Assign subjects">
                    <BookOpen className="h-3.5 w-3.5" /> Subjects
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => removeTeacher(t)} aria-label="Remove teacher">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
          {data && data.items.length === 0 && (
            <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">No teachers yet.</TD></TR>
          )}
        </TBody>
      </Table>

      {/* ── Assign Subjects dialog ───────────────────────────────────────── */}
      <Dialog
        open={Boolean(assignTeacher)}
        onClose={() => { setAssignTeacher(null); setAssignClassId(""); }}
        title={`Assign Subjects — ${assignTeacher ? `${assignTeacher.user.firstName} ${assignTeacher.user.lastName}` : ""}`}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="aclass">Class</Label>
            <Select
              id="aclass"
              value={assignClassId}
              onChange={(e) => setAssignClassId(e.target.value)}
            >
              {allClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Subjects</Label>
              <button
                type="button"
                className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={toggleAll}
              >
                {selectedSubjectIds.size === allSubjects.length ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border p-3 space-y-2">
              {allSubjects.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={selectedSubjectIds.has(s.id)}
                    onChange={() => toggleSubject(s.id)}
                  />
                  {s.name}
                </label>
              ))}
              {allSubjects.length === 0 && (
                <p className="text-sm text-muted-foreground">No subjects configured yet.</p>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {selectedSubjectIds.size} of {allSubjects.length} selected
            </p>
          </div>

          <Button className="w-full" onClick={saveAssignments} disabled={assignSaving}>
            {assignSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save assignments
          </Button>
        </div>
      </Dialog>

      {/* ── Edit teacher dialog ──────────────────────────────────────────── */}
      <Dialog open={Boolean(editTeacher)} onClose={() => setEditTeacher(null)} title={`Edit teacher — ${editTeacher?.staffNo ?? ""}`}>
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="efn">First name</Label>
              <Input id="efn" required value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="eln">Last name</Label>
              <Input id="eln" required value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="eem">Email (login)</Label>
            <Input id="eem" type="email" required value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="eph">Phone</Label>
              <Input id="eph" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="eq">Qualification</Label>
              <Input id="eq" value={editForm.qualification} onChange={(e) => setEditForm((f) => ({ ...f, qualification: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="es">Specialization</Label>
            <Input id="es" value={editForm.specialization} onChange={(e) => setEditForm((f) => ({ ...f, specialization: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </Button>
        </form>
      </Dialog>

      {/* ── Add teacher dialog ───────────────────────────────────────────── */}
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
