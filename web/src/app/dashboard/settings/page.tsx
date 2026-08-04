"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Loader2, Plus, Save } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";

interface School {
  name: string; motto: string; address: string; phone: string; email: string;
  logoUrl: string | null; headTeacherName: string | null;
}
interface Term { id: string; name: string; isCurrent: boolean; startDate: string; endDate: string }
interface SessionRow { id: string; name: string; isCurrent: boolean; terms: Term[] }
interface GradeScale { minScore: number; maxScore: number; grade: string; remark: string }
interface Assessment { name: string; maxScore: number; order: number; isExam: boolean }

type Tab = "school" | "sessions" | "grading";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("school");
  const tabs: { key: Tab; label: string }[] = [
    { key: "school", label: "School Information" },
    { key: "sessions", label: "Sessions & Terms" },
    { key: "grading", label: "Grading System" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="School Settings"
        description="Everything here is editable without touching the source code."
      />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium",
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "school" && <SchoolInfo />}
      {tab === "sessions" && <Sessions />}
      {tab === "grading" && <Grading />}
    </div>
  );
}

function SchoolInfo() {
  const [school, setSchool] = useState<School | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    api.get<ApiResponse<School>>("/settings/school").then((r) => setSchool(r.data)).catch(() => null);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!school) return;
    setSaving(true);
    setMessage(null);
    try {
      let logoUrl = school.logoUrl;
      if (logoFile) {
        const up = await api.upload<ApiResponse<{ url: string }>>("/uploads/logo", logoFile);
        logoUrl = up.data.url;
      }
      const r = await api.put<ApiResponse<School>>("/settings/school", {
        name: school.name,
        motto: school.motto,
        address: school.address,
        phone: school.phone,
        email: school.email,
        headTeacherName: school.headTeacherName,
        logoUrl,
      });
      setSchool(r.data);
      setLogoFile(null);
      setMessage({ type: "success", text: "School information updated. It now appears on the portal, receipts and report cards." });
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  if (!school) return <p className="text-muted-foreground">Loading…</p>;
  const set = (key: keyof School) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSchool((s) => (s ? { ...s, [key]: e.target.value } : s));

  return (
    <form onSubmit={save}>
      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}
      <Card>
        <CardHeader>
          <CardTitle>School Profile</CardTitle>
          <CardDescription>Shown on the login page, portal header, report cards and receipts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="sname">School name</Label>
            <Input id="sname" required value={school.name} onChange={set("name")} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="smotto">Motto</Label>
            <Input id="smotto" required value={school.motto} onChange={set("motto")} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="saddress">Address</Label>
            <Input id="saddress" required value={school.address} onChange={set("address")} />
          </div>
          <div>
            <Label htmlFor="sphone">Phone number</Label>
            <Input id="sphone" required value={school.phone} onChange={set("phone")} />
          </div>
          <div>
            <Label htmlFor="semail">Email address</Label>
            <Input id="semail" type="email" required value={school.email} onChange={set("email")} />
          </div>
          <div>
            <Label htmlFor="shead">Head teacher&apos;s name</Label>
            <Input id="shead" value={school.headTeacherName ?? ""} onChange={set("headTeacherName")} />
          </div>
          <div>
            <Label htmlFor="slogo">School logo</Label>
            <div className="flex items-center gap-3">
              {school.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={school.logoUrl} alt="Logo" className="h-10 w-10 rounded-full border object-cover" />
              )}
              <Input id="slogo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
        </Button>
      </div>
    </form>
  );
}

function Sessions() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [termForm, setTermForm] = useState({ sessionId: "", name: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [confirmPromote, setConfirmPromote] = useState<SessionRow | null>(null);

  const load = () =>
    api.get<ApiResponse<SessionRow[]>>("/settings/sessions").then((r) => setSessions(r.data)).catch(() => null);
  useEffect(() => {
    load();
  }, []);

  async function promoteAll(session: SessionRow) {
    setPromotingId(session.id);
    setConfirmPromote(null);
    try {
      const r = await api.post<{ data: { promoted: number; graduated: number; total: number }; message: string }>(
        `/settings/sessions/${session.id}/promote`, {}
      );
      setMessage({ type: "success", text: r.message ?? `Done: ${r.data.promoted} promoted, ${r.data.graduated} graduated.` });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Promotion failed" });
    } finally {
      setPromotingId(null);
    }
  }

  async function addSession(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/settings/sessions", { ...form, isCurrent: sessions.length === 0 });
      setForm({ name: "", startDate: "", endDate: "" });
      setMessage({ type: "success", text: "Session created" });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/settings/sessions/${termForm.sessionId}/terms`, {
        name: termForm.name,
        startDate: termForm.startDate,
        endDate: termForm.endDate,
      });
      setTermForm({ sessionId: "", name: "", startDate: "", endDate: "" });
      setMessage({ type: "success", text: "Term created" });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function makeCurrent(termId: string) {
    try {
      const r = await api.patch<{ message: string }>(`/settings/terms/${termId}/current`);
      setMessage({ type: "success", text: r.message });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    }
  }

  return (
    <div className="space-y-4">
      {message && <Alert variant={message.type}>{message.text}</Alert>}

      {sessions.map((s) => (
        <Card key={s.id}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>
              {s.name} {s.isCurrent && <Badge variant="success" className="ml-2">Current session</Badge>}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmPromote(s)}
              disabled={promotingId === s.id}
            >
              {promotingId === s.id
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Promoting…</>
                : <><GraduationCap className="h-3.5 w-3.5" /> Promote All Students</>}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Term</TH><TH>Period</TH><TH></TH></TR></THead>
              <TBody>
                {s.terms.map((t) => (
                  <TR key={t.id}>
                    <TD className="font-medium">
                      {t.name} {t.isCurrent && <Badge variant="success" className="ml-1">Current</Badge>}
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {new Date(t.startDate).toLocaleDateString()} – {new Date(t.endDate).toLocaleDateString()}
                    </TD>
                    <TD className="text-right">
                      {!t.isCurrent && (
                        <Button variant="outline" size="sm" onClick={() => makeCurrent(t.id)}>Make current</Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Promotion confirmation dialog */}
      <Dialog open={Boolean(confirmPromote)} onClose={() => setConfirmPromote(null)} title="Promote All Students">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will move <strong>every active student</strong> in <strong>{confirmPromote?.name}</strong> up one class level for the next session:
          </p>
          <ul className="rounded-lg border bg-secondary/40 p-3 text-sm space-y-1">
            <li>• Primary 1 → Primary 2, Primary 2 → Primary 3, etc.</li>
            <li>• Students in the <strong>highest class</strong> will be marked <strong>Graduated</strong>.</li>
            <li>• Promotion history is recorded for each student.</li>
          </ul>
          <p className="text-sm font-medium text-destructive">This cannot be undone. Make sure the session has ended before proceeding.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmPromote(null)}>Cancel</Button>
            <Button onClick={() => confirmPromote && promoteAll(confirmPromote)}>
              <GraduationCap className="h-4 w-4" /> Yes, promote all
            </Button>
          </div>
        </div>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>New academic session</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addSession} className="space-y-3">
              <div>
                <Label htmlFor="sessname">Name (e.g. 2026/2027)</Label>
                <Input id="sessname" required pattern="\d{4}/\d{4}" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="sessstart">Start</Label>
                  <Input id="sessstart" type="date" required value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="sessend">End</Label>
                  <Input id="sessend" type="date" required value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                <Plus className="h-4 w-4" /> Create session
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>New term</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addTerm} className="space-y-3">
              <div>
                <Label htmlFor="tsess">Session</Label>
                <select
                  id="tsess"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={termForm.sessionId}
                  onChange={(e) => setTermForm((f) => ({ ...f, sessionId: e.target.value }))}
                >
                  <option value="">— Select —</option>
                  {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="tname">Term name</Label>
                <Input id="tname" required placeholder="First Term" value={termForm.name} onChange={(e) => setTermForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="tstart">Start</Label>
                  <Input id="tstart" type="date" required value={termForm.startDate} onChange={(e) => setTermForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="tend">End</Label>
                  <Input id="tend" type="date" required value={termForm.endDate} onChange={(e) => setTermForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                <Plus className="h-4 w-4" /> Create term
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Grading() {
  const [scales, setScales] = useState<GradeScale[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<ApiResponse<{ gradeScales: GradeScale[]; assessmentTypes: (Assessment & { isActive: boolean })[] }>>("/settings/grading")
      .then((r) => {
        setScales(r.data.gradeScales);
        setAssessments(r.data.assessmentTypes.filter((a) => a.isActive));
      })
      .catch(() => null);
  }, []);

  const totalMax = assessments.reduce((s, a) => s + Number(a.maxScore || 0), 0);

  async function saveScales() {
    setSaving(true);
    try {
      await api.put("/settings/grading/scales", { scales: scales.map((s) => ({ ...s, minScore: Number(s.minScore), maxScore: Number(s.maxScore) })) });
      setMessage({ type: "success", text: "Grade scale updated" });
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function saveAssessments() {
    setSaving(true);
    try {
      await api.put("/settings/grading/assessments", {
        assessments: assessments.map((a, i) => ({ name: a.name, maxScore: Number(a.maxScore), order: i + 1, isExam: a.isExam })),
      });
      setMessage({ type: "success", text: "Assessment structure updated" });
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {message && <Alert variant={message.type}>{message.text}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Assessment structure</CardTitle>
          <CardDescription>
            Continuous assessment and exam components. Max scores must add up to 100 — currently{" "}
            <b className={cn(totalMax !== 100 && "text-destructive")}>{totalMax}</b>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {assessments.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={a.name}
                onChange={(e) => setAssessments((as) => as.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className="flex-1"
                aria-label="Assessment name"
              />
              <Input
                type="number"
                min={1}
                max={100}
                value={a.maxScore}
                onChange={(e) => setAssessments((as) => as.map((x, j) => (j === i ? { ...x, maxScore: Number(e.target.value) } : x)))}
                className="w-24"
                aria-label="Max score"
              />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={a.isExam}
                  onChange={(e) => setAssessments((as) => as.map((x, j) => (j === i ? { ...x, isExam: e.target.checked } : x)))}
                />
                Exam
              </label>
              <Button variant="ghost" size="sm" onClick={() => setAssessments((as) => as.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setAssessments((as) => [...as, { name: "", maxScore: 10, order: as.length + 1, isExam: false }])}>
              <Plus className="h-4 w-4" /> Add component
            </Button>
            <Button size="sm" onClick={saveAssessments} disabled={saving || totalMax !== 100}>
              <Save className="h-4 w-4" /> Save structure
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grade scale</CardTitle>
          <CardDescription>Percentage bands used on report cards.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {scales.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input type="number" className="w-20" value={s.minScore} aria-label="Min score"
                onChange={(e) => setScales((sc) => sc.map((x, j) => (j === i ? { ...x, minScore: Number(e.target.value) } : x)))} />
              <span className="text-muted-foreground">–</span>
              <Input type="number" className="w-20" value={s.maxScore} aria-label="Max score"
                onChange={(e) => setScales((sc) => sc.map((x, j) => (j === i ? { ...x, maxScore: Number(e.target.value) } : x)))} />
              <Input className="w-16 text-center font-bold" value={s.grade} aria-label="Grade"
                onChange={(e) => setScales((sc) => sc.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} />
              <Input className="flex-1" value={s.remark} aria-label="Remark"
                onChange={(e) => setScales((sc) => sc.map((x, j) => (j === i ? { ...x, remark: e.target.value } : x)))} />
              <Button variant="ghost" size="sm" onClick={() => setScales((sc) => sc.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setScales((sc) => [...sc, { minScore: 0, maxScore: 0, grade: "", remark: "" }])}>
              <Plus className="h-4 w-4" /> Add band
            </Button>
            <Button size="sm" onClick={saveScales} disabled={saving}>
              <Save className="h-4 w-4" /> Save scale
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
