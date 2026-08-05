"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, RotateCcw, GraduationCap, Loader2 } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface ClassRoom { id: string; name: string; level: number }
interface Term { id: string; name: string; isCurrent: boolean }
interface Session { id: string; name: string; isCurrent: boolean; terms: Term[] }
interface StudentReview {
  id: string; firstName: string; lastName: string; admissionNo: string;
  averagePercent: number | null; subjectsScored: number;
}

type Action = "PROMOTE" | "REPEAT" | "GRADUATE";
interface Decision { studentId: string; action: Action; toClassRoomId?: string }

export default function PromotionPage() {
  const router = useRouter();
  const user = getUser();

  useEffect(() => {
    if (user && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      router.replace("/dashboard/students");
    }
  }, [user, router]);

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classRoomId, setClassRoomId] = useState("");
  const [termId, setTermId] = useState("");
  const [cutoff, setCutoff] = useState(40);
  const [promoteToClassId, setPromoteToClassId] = useState("");
  const [students, setStudents] = useState<StudentReview[]>([]);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<ClassRoom[]>>("/classes"),
      api.get<ApiResponse<Session[]>>("/settings/sessions"),
    ]).then(([cls, sess]) => {
      setClasses(cls.data);
      setSessions(sess.data);
      const currentTerm = sess.data.flatMap((s) => s.terms).find((t) => t.isCurrent);
      if (currentTerm) setTermId(currentTerm.id);
    }).catch(() => null);
  }, []);

  const allTerms = sessions.flatMap((s) => s.terms.map((t) => ({ ...t, sessionName: s.name })));
  const selectedClass = classes.find((c) => c.id === classRoomId);
  const destClasses = selectedClass ? classes.filter((c) => c.level > selectedClass.level) : classes;

  const buildDecisions = useCallback(
    (studs: StudentReview[], cutoffPct: number, toClass: string) => {
      const map = new Map<string, Decision>();
      for (const s of studs) {
        const avg = s.averagePercent ?? 0;
        const action: Action = avg >= cutoffPct ? "PROMOTE" : "REPEAT";
        map.set(s.id, { studentId: s.id, action, toClassRoomId: action === "PROMOTE" ? toClass : undefined });
      }
      setDecisions(map);
    },
    []
  );

  async function loadReview() {
    if (!classRoomId || !termId) return;
    setLoading(true);
    setReviewed(false);
    setMessage(null);
    try {
      const r = await api.get<ApiResponse<StudentReview[]>>(
        `/students/promotion-review?classRoomId=${classRoomId}&termId=${termId}`
      );
      setStudents(r.data);
      buildDecisions(r.data, cutoff, promoteToClassId);
      setReviewed(true);
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to load" });
    } finally {
      setLoading(false);
    }
  }

  function setAction(studentId: string, action: Action) {
    setDecisions((prev) => {
      const next = new Map(prev);
      const existing = next.get(studentId);
      next.set(studentId, {
        studentId, action,
        toClassRoomId: action === "PROMOTE" ? (existing?.toClassRoomId ?? promoteToClassId) : undefined,
      });
      return next;
    });
  }

  function setStudentDest(studentId: string, toClassRoomId: string) {
    setDecisions((prev) => {
      const next = new Map(prev);
      const existing = next.get(studentId)!;
      next.set(studentId, { ...existing, toClassRoomId });
      return next;
    });
  }

  async function execute() {
    const list = Array.from(decisions.values());
    if (list.some((d) => d.action === "PROMOTE" && !d.toClassRoomId)) {
      setMessage({ type: "destructive", text: 'Some students marked "PROMOTE" have no destination class. Please select one.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const r = await api.post<ApiResponse<{ promoted: number; repeated: number; graduated: number }>>(
        "/students/promote", { decisions: list }
      );
      setMessage({ type: "success", text: r.message ?? `Done: ${r.data.promoted} promoted, ${r.data.repeated} repeating, ${r.data.graduated} graduated.` });
      setStudents([]);
      setReviewed(false);
      setDecisions(new Map());
      setClassRoomId("");
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  const counts = {
    promote: [...decisions.values()].filter((d) => d.action === "PROMOTE").length,
    repeat: [...decisions.values()].filter((d) => d.action === "REPEAT").length,
    graduate: [...decisions.values()].filter((d) => d.action === "GRADUATE").length,
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="End-of-Session Promotion"
        description="Review student averages and set each student's decision before confirming."
      >
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </PageHeader>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      <div className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label>Class to review</Label>
          <Select value={classRoomId} onChange={(e) => { setClassRoomId(e.target.value); setReviewed(false); }}>
            <option value="">— Select class —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <Label>Term</Label>
          <Select value={termId} onChange={(e) => { setTermId(e.target.value); setReviewed(false); }}>
            <option value="">— Select term —</option>
            {allTerms.map((t) => <option key={t.id} value={t.id}>{t.sessionName} — {t.name}</option>)}
          </Select>
        </div>
        <div>
          <Label>Promote passing students to</Label>
          <Select value={promoteToClassId} onChange={(e) => { setPromoteToClassId(e.target.value); setReviewed(false); }}>
            <option value="">— Next class —</option>
            {destClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <Label>Pass mark (%)</Label>
          <Input type="number" min={0} max={100} value={cutoff}
            onChange={(e) => { setCutoff(Number(e.target.value)); setReviewed(false); }} />
        </div>
        <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
          <Button onClick={loadReview} disabled={!classRoomId || !termId || loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Loading…" : "Load students"}
          </Button>
        </div>
      </div>

      {reviewed && students.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">No active students found in this class.</p>
      )}

      {reviewed && students.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle className="h-3.5 w-3.5" /> {counts.promote} promote
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <RotateCcw className="h-3.5 w-3.5" /> {counts.repeat} repeat
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              <GraduationCap className="h-3.5 w-3.5" /> {counts.graduate} graduate
            </span>
            <span className="ml-auto text-xs text-muted-foreground">Pass mark: {cutoff}% — adjust decisions below, then confirm</span>
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Student</TH>
                <TH>Average %</TH>
                <TH>Decision</TH>
                <TH>Destination</TH>
              </TR>
            </THead>
            <TBody>
              {students.map((s) => {
                const d = decisions.get(s.id);
                const avg = s.averagePercent;
                const passing = avg !== null && avg >= cutoff;
                return (
                  <TR key={s.id}>
                    <TD>
                      <p className="font-medium">{s.lastName} {s.firstName}</p>
                      <p className="text-xs text-muted-foreground">{s.admissionNo}</p>
                    </TD>
                    <TD>
                      {avg !== null ? (
                        <span className={cn("font-semibold tabular-nums", passing ? "text-green-600" : "text-destructive")}>
                          {avg}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No scores</span>
                      )}
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        {(["PROMOTE", "REPEAT", "GRADUATE"] as Action[]).map((a) => (
                          <button
                            key={a}
                            onClick={() => setAction(s.id, a)}
                            className={cn(
                              "flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors",
                              d?.action === a
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-muted-foreground hover:bg-secondary"
                            )}
                          >
                            {a === "PROMOTE" && <CheckCircle className="h-3 w-3" />}
                            {a === "REPEAT" && <RotateCcw className="h-3 w-3" />}
                            {a === "GRADUATE" && <GraduationCap className="h-3 w-3" />}
                            {a}
                          </button>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      {d?.action === "PROMOTE" ? (
                        <Select
                          className="h-8 text-xs"
                          value={d.toClassRoomId ?? ""}
                          onChange={(e) => setStudentDest(s.id, e.target.value)}
                        >
                          <option value="">— Pick class —</option>
                          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                      ) : d?.action === "REPEAT" ? (
                        <span className="text-xs text-muted-foreground">Stays in current class</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Removed from class</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          <div className="mt-6 flex justify-end">
            <Button onClick={execute} disabled={saving || decisions.size === 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Processing…" : `Confirm promotion (${decisions.size} students)`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
