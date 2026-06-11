"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface SubjectRow {
  id: string;
  name: string;
  code: string;
  _count: { classSubjects: number };
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });

  const load = useCallback(() => {
    api.get<ApiResponse<SubjectRow[]>>("/subjects").then((r) => setSubjects(r.data)).catch(() => null);
  }, []);
  useEffect(load, [load]);

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/subjects", { name: form.name, code: form.code.toUpperCase() });
      setDialogOpen(false);
      setForm({ name: "", code: "" });
      setMessage({ type: "success", text: "Subject created" });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Subjects" description="Subjects offered across the school">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add Subject
        </Button>
      </PageHeader>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      <Table>
        <THead><TR><TH>Subject</TH><TH>Code</TH><TH className="text-center">Classes</TH></TR></THead>
        <TBody>
          {subjects.map((s) => (
            <TR key={s.id}>
              <TD className="font-medium">{s.name}</TD>
              <TD className="font-mono text-xs">{s.code}</TD>
              <TD className="text-center">{s._count.classSubjects}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add subject">
        <form onSubmit={addSubject} className="space-y-4">
          <div>
            <Label htmlFor="subname">Subject name</Label>
            <Input id="subname" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="subcode">Code (2–8 letters)</Label>
            <Input id="subcode" required minLength={2} maxLength={8} placeholder="ENG" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create subject
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
