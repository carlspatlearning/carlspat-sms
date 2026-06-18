"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Pencil, Plus, Trash2, UserCheck } from "lucide-react";
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
interface UserOption { id: string; email: string; firstName: string; lastName: string; role: string }

export default function TeachersPage() {
  const [data, setData] = useState<Paginated<TeacherRow> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Add teacher dialog — two tabs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addTab, setAddTab] = useState<"new" | "existing">("new");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", qualification: "", specialization: "",
  });

  // Existing-user tab state
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [fromUserForm, setFromUserForm] = useState({ qualification: "", specialization: "" });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Search users as admin types (debounced)
  useEffect(() => {
    if (!userQuery.trim()) { setUserResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setUserSearching(true);
      api.get<ApiResponse<Paginated<UserOption>>>(`/users?q=${encodeURIComponent(userQuery)}&pageSize=10`)
        .then((r) => {
          // Exclude users already listed as teachers
          const teacherEmails = new Set(data?.items.map((t) => t.user.email) ?? []);
          setUserResults(r.data.items.filter((u) => !teacherEmails.has(u.email)));
        })
        .catch(() => null)
        .finally(() => setUserSearching(false));
    }, 350);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userQuery]);

  function resetAddDialog() {
    setDialogOpen(false);
    setAddTab("new");
    setForm({ firstName: "", lastName: "", email: "", phone: "", password: "", qualification: "", specialization: "" });
    setUserQuery("");
    setUserResults([]);
    setSelectedUser(null);
    setFromUserForm({ qualification: "", specialization: "" });
  }

  function openAssign(t: TeacherRow) {
    setAssignTeacher(t);
    setAssignClassId((prev) => prev || allClasses[0]?.id || "");
  }

  useEffect(() => {
    if (!assignTeacher || !assignClassId) return;
    const already = new Set(
      assignTeacher.classSubjects
        .filter((cs) => cs.classRoomId === assignClassId)
        .map((cs) => cs.subjectId)
    );
    setSelectedSubjectIds(already);
  }, [assignTeacher, assignClassId]);

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
    setSelectedSubjectIds(
      selectedSubjectIds.size === allSubjects.length ? new Set() : new Set(allSubjects.map((s) => s.id))
    );
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
      firstName: t.user.firstName, lastName: t.user.lastName,
      email: t.user.email, phone: t.user.phone ?? "",
      qualification: t.qualification ?? "", specialization: t.specialization ?? "",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTeacher) return;
    setSaving(true);
    try {
      await api.put(`/teachers/${editTeacher.id}`, {
        firstName: editForm.firstName, lastName: editForm.lastName,
        email: editForm.email, phone: editForm.phone || undefined,
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
      resetAddDialog();
      setMessage({ type: "success", text: "Teacher account created. Share the login details with them securely." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to create teacher" });
    } finally {
      setSaving(false);
    }
  }

  async function addTeacherFromUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    try {
      await api.post("/teachers/from-user", {
        userId: selectedUser.id,
        qualification: fromUserForm.qualification || undefined,
        specialization: fromUserForm.specialization || undefined,
      });
      resetAddDialog();
      setMessage({ type: "success", text: `${selectedUser.firstName} ${selectedUser.lastName} has been promoted to teacher.` });
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

      {/* ── Assign Subjects dialog ─────────────────────────────────── */}
      <Dialog
        open={Boolean(assignTeacher)}
        onClose={() => { setAssignTeacher(null); setAssignClassId(""); }}
        title={`Assign Subjects — ${assignTeacher ? `${assignTeacher.user.firstName} ${assignTeacher.user.lastName}` : ""}`}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="aclass">Class</Label>
            <Select id="aclass" value={assignClassId} onChange={(e) => setAssignClassId(e.target.value)}>
              {allClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Subjects</Label>
              <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={toggleAll}>
                {selectedSubjectIds.size === allSubjects.length ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border p-3 space-y-2">
              {allSubjects.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                    checked={selectedSubjectIds.has(s.id)} onChange={() => toggleSubject(s.id)} />
                  {s.name}
                </label>
              ))}
              {allSubjects.length === 0 && <p className="text-sm text-muted-foreground">No subjects configured yet.</p>}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{selectedSubjectIds.size} of {allSubjects.length} selected</p>
          </div>
          <Button className="w-full" onClick={saveAssignments} disabled={assignSaving}>
            {assignSaving && <Loader2 className="h-4 w-4 animate-spin" />} Save assignments
          </Button>
        </div>
      </Dialog>

      {/* ── Edit teacher dialog ────────────────────────────────────── */}
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

      {/* ── Add Teacher dialog (two tabs) ─────────────────────────── */}
      <Dialog open={dialogOpen} onClose={resetAddDialog} title="Add Teacher">
        {/* Tab switcher */}
        <div className="mb-5 flex rounded-lg border p-1 text-sm">
          <button
            type="button"
            onClick={() => setAddTab("new")}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${addTab === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Plus className="mr-1.5 inline h-3.5 w-3.5" />New account
          </button>
          <button
            type="button"
            onClick={() => setAddTab("existing")}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${addTab === "existing" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <UserCheck className="mr-1.5 inline h-3.5 w-3.5" />From existing user
          </button>
        </div>

        {addTab === "new" ? (
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
        ) : (
          <form onSubmit={addTeacherFromUser} className="space-y-4">
            <div>
              <Label htmlFor="usearch">Search existing users</Label>
              <div className="relative">
                <Input
                  id="usearch"
                  placeholder="Type name or email…"
                  value={userQuery}
                  onChange={(e) => { setUserQuery(e.target.value); setSelectedUser(null); }}
                  autoComplete="off"
                />
                {userSearching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {userResults.length > 0 && !selectedUser && (
                <ul className="mt-1 rounded-md border bg-background shadow-sm divide-y">
                  {userResults.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                        onClick={() => { setSelectedUser(u); setUserQuery(`${u.firstName} ${u.lastName}`); setUserResults([]); }}
                      >
                        <span className="font-medium">{u.firstName} {u.lastName}</span>
                        <span className="ml-2 text-muted-foreground">{u.email}</span>
                        <Badge variant="outline" className="ml-2 text-[11px]">{u.role}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedUser && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</p>
                <p className="text-muted-foreground">{selectedUser.email} · current role: <span className="capitalize">{selectedUser.role.toLowerCase().replace("_", " ")}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Their role will be changed to Teacher and a staff profile will be created.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fuq">Qualification</Label>
                <Input id="fuq" placeholder="B.Ed, NCE…" value={fromUserForm.qualification} onChange={(e) => setFromUserForm((f) => ({ ...f, qualification: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="fus">Specialization</Label>
                <Input id="fus" placeholder="Mathematics…" value={fromUserForm.specialization} onChange={(e) => setFromUserForm((f) => ({ ...f, specialization: e.target.value }))} />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={saving || !selectedUser}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Promote to teacher
            </Button>
          </form>
        )}
      </Dialog>
    </div>
  );
}
