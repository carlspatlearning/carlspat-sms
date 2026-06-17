"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Lock } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatNaira } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

interface ClassOption { id: string; name: string; section: string | null }

interface Term { id: string; name: string; session?: { name: string } }
interface SessionRow { id: string; name: string; terms: Term[] }
interface StudentOption { id: string; label: string }
interface Access { allowed: boolean; outstanding: number; message: string | null }

export default function ReportCardsPage() {
  const user = getUser();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStaff = user && ["SUPER_ADMIN", "ADMIN", "TEACHER"].includes(user.role);

  // Populate the student picker according to role
  useEffect(() => {
    if (!user) return;
    if (user.role === "PARENT") {
      api
        .get<ApiResponse<{ id: string; firstName: string; lastName: string; admissionNo: string }[]>>("/parents/me/children")
        .then((r) => {
          const opts = r.data.map((s) => ({ id: s.id, label: `${s.firstName} ${s.lastName} (${s.admissionNo})` }));
          setStudents(opts);
          if (opts.length) setStudentId(opts[0].id);
        })
        .catch((e) => setError(e.message));
    } else if (user.role === "STUDENT") {
      api.get<ApiResponse<{ student: { id: string } }>>("/auth/me").then((r) => {
        const meStudent = (r.data as unknown as { student?: { id: string } }).student;
        if (meStudent) {
          setStudents([{ id: meStudent.id, label: "My report card" }]);
          setStudentId(meStudent.id);
        }
      }).catch(() => null);
    } else {
      api
        .get<ApiResponse<{ items: { id: string; firstName: string; lastName: string; admissionNo: string }[] }>>("/students?pageSize=100")
        .then((r) => {
          const opts = r.data.items.map((s) => ({ id: s.id, label: `${s.firstName} ${s.lastName} (${s.admissionNo})` }));
          setStudents(opts);
          if (opts.length) setStudentId(opts[0].id);
        })
        .catch((e) => setError(e.message));
    }
    api.get<ApiResponse<SessionRow[]>>("/settings/sessions").then((r) => {
      setSessions(r.data);
      const current = r.data.flatMap((s) => s.terms).find((t) => (t as Term & { isCurrent?: boolean }).isCurrent);
      if (current) setTermId(current.id);
    }).catch(() => null);
    api.get<ApiResponse<ClassOption[]>>("/classes").then((r) => setClasses(r.data)).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAccess = useCallback(() => {
    if (!studentId || !termId) return;
    setChecking(true);
    setAccess(null);
    api
      .get<ApiResponse<Access>>(`/report-cards/${studentId}/access?termId=${termId}`)
      .then((r) => setAccess(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setChecking(false));
  }, [studentId, termId]);

  useEffect(checkAccess, [checkAccess]);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      await api.download(`/report-cards/${studentId}/pdf?termId=${termId}`, "report-card.pdf");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function downloadClassAll() {
    if (!classId || !termId) return;
    setBulkDownloading(true);
    setError(null);
    try {
      const cls = classes.find((c) => c.id === classId);
      await api.download(
        `/report-cards/class/${classId}/pdf?termId=${termId}`,
        `report-cards-${cls?.name ?? "class"}.pdf`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk download failed");
    } finally {
      setBulkDownloading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Report Cards"
        description="Download or print the official end-of-term report card (PDF, with QR verification)."
      />
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

      {isStaff && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-semibold">Download All — Entire Class at Once</p>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-36">
                <Label htmlFor="bulkclass">Class</Label>
                <Select id="bulkclass" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <option value="">— Select class —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ""}</option>
                  ))}
                </Select>
              </div>
              <div className="flex-1 min-w-36">
                <Label>Term</Label>
                <p className="text-sm mt-1 text-muted-foreground">(uses term selected below)</p>
              </div>
            </div>
            <Button className="mt-3" onClick={downloadClassAll} disabled={!classId || !termId || bulkDownloading}>
              {bulkDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download All Report Cards (PDF)
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="student">Student</Label>
              <Select id="student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="term">Term</Label>
              <Select id="term" value={termId} onChange={(e) => setTermId(e.target.value)}>
                {sessions.map((sess) => (
                  <optgroup key={sess.id} label={sess.name}>
                    {sess.terms.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
          </div>

          {checking && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking fee status…
            </p>
          )}

          {access && !access.allowed && (
            <Alert variant="destructive" title="Report card locked">
              <span className="flex items-start gap-1.5">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {access.message}
                  <br />
                  <b>Outstanding balance: {formatNaira(access.outstanding)}</b>
                </span>
              </span>
            </Alert>
          )}

          {access?.allowed && (
            <Alert variant="success" title="Report card available">
              Fees are fully settled for this term. You can download and print the report card.
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={download} disabled={!access?.allowed || downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </Button>
            <p className="self-center text-xs text-muted-foreground">
              Open the PDF and use your browser&apos;s print dialog to print.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
