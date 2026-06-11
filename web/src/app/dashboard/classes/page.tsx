"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface ClassRow {
  id: string;
  name: string;
  level: number;
  section: string | null;
  capacity: number | null;
  formTeacher: { user: { firstName: string; lastName: string } } | null;
  _count: { students: number; classSubjects: number };
}

export default function ClassesPage() {
  const user = getUser();
  const isAdmin = user && ["SUPER_ADMIN", "ADMIN"].includes(user.role);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", level: "", capacity: "" });

  const load = useCallback(() => {
    api.get<ApiResponse<ClassRow[]>>("/classes").then((r) => setClasses(r.data)).catch(() => null);
  }, []);
  useEffect(load, [load]);

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/classes", {
        name: form.name,
        level: Number(form.level),
        capacity: form.capacity ? Number(form.capacity) : undefined,
      });
      setDialogOpen(false);
      setForm({ name: "", level: "", capacity: "" });
      setMessage({ type: "success", text: "Class created" });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Classes" description="Class arms, form teachers and enrolment">
        {isAdmin && (
          <Button onClick={() => setDialogOpen(true)}>
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
          </TR>
        </THead>
        <TBody>
          {classes.map((c) => (
            <TR key={c.id}>
              <TD className="font-medium">{c.name}{c.section ? ` ${c.section}` : ""}</TD>
              <TD className="hidden sm:table-cell">
                {c.formTeacher ? `${c.formTeacher.user.firstName} ${c.formTeacher.user.lastName}` : <span className="text-muted-foreground">—</span>}
              </TD>
              <TD className="text-center">{c._count.students}</TD>
              <TD className="hidden text-center sm:table-cell">{c._count.classSubjects}</TD>
              <TD className="hidden text-center md:table-cell">{c.capacity ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add class">
        <form onSubmit={addClass} className="space-y-4">
          <div>
            <Label htmlFor="cname">Class name</Label>
            <Input id="cname" required placeholder="Primary 5" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="clevel">Level (for promotion order)</Label>
              <Input id="clevel" type="number" min="1" required value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="ccap">Capacity</Label>
              <Input id="ccap" type="number" min="1" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create class
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
