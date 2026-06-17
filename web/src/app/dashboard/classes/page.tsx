"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import Link from "next/link";

interface Teacher {
  id: string;
  user: { firstName: string; lastName: string };
}

interface ClassRow {
  id: string;
  name: string;
  level: number;
  section: string | null;
  capacity: number | null;
  formTeacherId: string | null;
  formTeacher: { user: { firstName: string; lastName: string } } | null;
  _count: { students: number; classSubjects: number };
}

const emptyForm = { name: "", level: "", section: "", capacity: "", formTeacherId: "" };

export default function ClassesPage() {
  const user = getUser();
  const isAdmin = user && ["SUPER_ADMIN", "ADMIN"].includes(user.role);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassRow | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    api.get<ApiResponse<ClassRow[]>>("/classes").then((r) => setClasses(r.data)).catch(() => null);
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    api.get<ApiResponse<{ items: Teacher[] }>>("/teachers?pageSize=200")
      .then((r) => setTeachers(r.data.items ?? []))
      .catch(() => null);
  }, []);

  function openAdd() {
    setEditClass(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(c: ClassRow) {
    setEditClass(c);
    setForm({
      name: c.name,
      level: String(c.level),
      section: c.section ?? "",
      capacity: c.capacity ? String(c.capacity) : "",
      formTeacherId: c.formTeacherId ?? "",
    });
    setDialogOpen(true);
  }

  async function saveClass(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      level: Number(form.level),
      section: form.section || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      formTeacherId: form.formTeacherId || null,
    };
    try {
      if (editClass) {
        await api.put(`/classes/${editClass.id}`, payload);
        setMessage({ type: "success", text: "Class updated." });
      } else {
        await api.post("/classes", payload);
        setMessage({ type: "success", text: "Class created." });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteClass(c: ClassRow) {
    if (!confirm(`Delete class "${c.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/classes/${c.id}`);
      setMessage({ type: "success", text: "Class deleted." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    }
  }

  return (
    <div>
      <PageHeader title="Classes" description="Class arms, form teachers and enrolment">
        {isAdmin && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Class
          </Button>
        )}
      </PageHeader>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      <Table>
        <THead>
          <TR>
            <TH>Class</TH>
            <TH className="hidden sm:table-cell">Form Teacher</TH>
            <TH className="text-center">Students</TH>
            <TH className="hidden text-center sm:table-cell">Subjects</TH>
            <TH className="hidden text-center md:table-cell">Capacity</TH>
            {isAdmin && <TH></TH>}
          </TR>
        </THead>
        <TBody>
          {classes.map((c) => (
            <TR key={c.id}>
              <TD className="font-medium">
                <Link href={`/dashboard/classes/${c.id}`} className="hover:underline">
                  {c.name}{c.section ? ` ${c.section}` : ""}
                </Link>
              </TD>
              <TD className="hidden sm:table-cell">
                {c.formTeacher
                  ? `${c.formTeacher.user.firstName} ${c.formTeacher.user.lastName}`
                  : <span className="text-muted-foreground italic text-xs">Not assigned</span>}
              </TD>
              <TD className="text-center">{c._count.students}</TD>
              <TD className="hidden text-center sm:table-cell">{c._count.classSubjects}</TD>
              <TD className="hidden text-center md:table-cell">{c.capacity ?? "—"}</TD>
              {isAdmin && (
                <TD className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/classes/${c.id}`}>
                        <Users className="h-3.5 w-3.5" /> Manage
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteClass(c)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editClass ? `Edit class — ${editClass.name}` : "Add class"}
      >
        <form onSubmit={saveClass} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="cname">Class name</Label>
              <Input id="cname" required placeholder="e.g. Primary 5" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="clevel">Level (promotion order)</Label>
              <Input id="clevel" type="number" min="1" required value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="csec">Section (optional)</Label>
              <Input id="csec" placeholder="A" value={form.section}
                onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="ccap">Capacity</Label>
              <Input id="ccap" type="number" min="1" value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="cft">Assign Form Teacher</Label>
            <Select id="cft" value={form.formTeacherId}
              onChange={(e) => setForm((f) => ({ ...f, formTeacherId: e.target.value }))}>
              <option value="">— No form teacher —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.user.firstName} {t.user.lastName}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editClass ? "Save changes" : "Create class"}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
