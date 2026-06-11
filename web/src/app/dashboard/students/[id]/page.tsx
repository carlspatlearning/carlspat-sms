"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiResponse } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { cn, formatDate, formatNaira, fullName } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";

interface Student {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gender: string;
  dateOfBirth: string;
  address: string | null;
  status: string;
  passportUrl: string | null;
  bloodGroup: string | null;
  genotype: string | null;
  allergies: string | null;
  medicalNotes: string | null;
  previousSchool: string | null;
  admissionDate: string;
  classRoom: { id: string; name: string; section: string | null } | null;
  parent: { user: { firstName: string; lastName: string; email: string; phone: string | null } } | null;
  promotions: { id: string; fromClass: string; toClass: string; sessionName: string; promotedAt: string }[];
}

interface AttendanceData {
  records: { id: string; date: string; status: string; remark: string | null }[];
  summary: { present: number; late: number; absent: number; total: number };
}

interface ResultData {
  subjects: {
    subjectId: string; subject: string;
    scores: { assessment: string; maxScore: number; score: number | null }[];
    total: number; maxTotal: number; percentage: number; grade: string; remark: string;
  }[];
  average: number; grade: string; remark: string; positionLabel: string | null; classSize: number;
}

interface FeeBalance {
  expected: number; waived: number; paid: number; outstanding: number; fullyPaid: boolean;
  items: { category: string; amount: number }[];
}

type Tab = "profile" | "attendance" | "results" | "fees";

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = getUser();
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [fees, setFees] = useState<FeeBalance | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ApiResponse<Student>>(`/students/${id}`).then((r) => setStudent(r.data)).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (tab === "attendance" && !attendance) {
      api.get<ApiResponse<AttendanceData>>(`/attendance/student/${id}`).then((r) => setAttendance(r.data)).catch(() => null);
    }
    if (tab === "results" && !result) {
      api.get<ApiResponse<ResultData>>(`/results/student/${id}`).then((r) => setResult(r.data)).catch(() => null);
    }
    if (tab === "fees" && !fees) {
      api.get<ApiResponse<FeeBalance>>(`/fees/balance/${id}`).then((r) => setFees(r.data)).catch(() => null);
    }
  }, [tab, id, attendance, result, fees]);

  if (error) return <Alert variant="destructive">{error}</Alert>;
  if (!student) return <p className="text-muted-foreground">Loading…</p>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "attendance", label: "Attendance" },
    { key: "results", label: "Results" },
    { key: "fees", label: "Fees" },
  ];

  return (
    <div>
      <PageHeader title={fullName(student)} description={`${student.admissionNo} · ${student.classRoom?.name ?? "No class"}`}>
        <Badge variant={student.status === "ACTIVE" ? "success" : "secondary"}>{student.status}</Badge>
      </PageHeader>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardContent className="flex flex-col items-center p-6 text-center">
              {student.passportUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={student.passportUrl} alt="Passport" className="h-28 w-28 rounded-full object-cover" />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary">
                  {student.firstName[0]}{student.lastName[0]}
                </div>
              )}
              <h2 className="mt-3 font-semibold">{fullName(student)}</h2>
              <p className="font-mono text-xs text-muted-foreground">{student.admissionNo}</p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {(
                [
                  ["Gender", student.gender],
                  ["Date of birth", formatDate(student.dateOfBirth)],
                  ["Admitted", formatDate(student.admissionDate)],
                  ["Class", student.classRoom?.name ?? "—"],
                  ["Address", student.address ?? "—"],
                  ["Previous school", student.previousSchool ?? "—"],
                  ["Blood group", student.bloodGroup ?? "—"],
                  ["Genotype", student.genotype ?? "—"],
                  ["Allergies", student.allergies ?? "—"],
                  ["Medical notes", student.medicalNotes ?? "—"],
                  ["Parent / Guardian", student.parent ? `${student.parent.user.firstName} ${student.parent.user.lastName}` : "—"],
                  ["Parent contact", student.parent ? `${student.parent.user.phone ?? ""} ${student.parent.user.email}` : "—"],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-0.5">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {student.promotions.length > 0 && (
            <Card className="lg:col-span-3">
              <CardHeader><CardTitle>Promotion History</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {student.promotions.map((p) => (
                    <li key={p.id}>
                      {formatDate(p.promotedAt)} — {p.fromClass} → <b>{p.toClass}</b> ({p.sessionName})
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-4">
          {attendance ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Present</p><p className="text-2xl font-bold text-green-600">{attendance.summary.present}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Late</p><p className="text-2xl font-bold text-amber-600">{attendance.summary.late}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Absent</p><p className="text-2xl font-bold text-destructive">{attendance.summary.absent}</p></CardContent></Card>
              </div>
              <Table>
                <THead><TR><TH>Date</TH><TH>Status</TH><TH>Remark</TH></TR></THead>
                <TBody>
                  {attendance.records.map((r) => (
                    <TR key={r.id}>
                      <TD>{formatDate(r.date)}</TD>
                      <TD>
                        <Badge variant={r.status === "PRESENT" ? "success" : r.status === "LATE" ? "warning" : "destructive"}>
                          {r.status}
                        </Badge>
                      </TD>
                      <TD>{r.remark ?? "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </>
          ) : (
            <p className="text-muted-foreground">Loading attendance…</p>
          )}
        </div>
      )}

      {tab === "results" && (
        <div className="space-y-4">
          {result ? (
            result.subjects.length > 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Average</p><p className="text-2xl font-bold">{result.average}%</p></CardContent></Card>
                  <Card><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Grade</p><p className="text-2xl font-bold">{result.grade} <span className="text-sm font-normal text-muted-foreground">({result.remark})</span></p></CardContent></Card>
                  <Card><CardContent className="p-5"><p className="text-xs uppercase text-muted-foreground">Position</p><p className="text-2xl font-bold">{result.positionLabel ?? "—"} <span className="text-sm font-normal text-muted-foreground">of {result.classSize}</span></p></CardContent></Card>
                </div>
                <Table>
                  <THead>
                    <TR>
                      <TH>Subject</TH>
                      {result.subjects[0].scores.map((s) => (
                        <TH key={s.assessment} className="text-center">{s.assessment} ({s.maxScore})</TH>
                      ))}
                      <TH className="text-center">Total</TH>
                      <TH className="text-center">Grade</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {result.subjects.map((subj) => (
                      <TR key={subj.subjectId}>
                        <TD className="font-medium">{subj.subject}</TD>
                        {subj.scores.map((s) => (
                          <TD key={s.assessment} className="text-center">{s.score ?? "—"}</TD>
                        ))}
                        <TD className="text-center font-semibold">{subj.total}/{subj.maxTotal}</TD>
                        <TD className="text-center">{subj.grade}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </>
            ) : (
              <Alert>No results recorded for the current term yet.</Alert>
            )
          ) : (
            <p className="text-muted-foreground">Loading results…</p>
          )}
        </div>
      )}

      {tab === "fees" && (
        <div className="space-y-4">
          {fees ? (
            <>
              {fees.fullyPaid ? (
                <Alert variant="success" title="Fees fully paid">There is no outstanding balance for the current term.</Alert>
              ) : (
                <Alert variant="destructive" title={`Outstanding: ${formatNaira(fees.outstanding)}`}>
                  Access to the report card is restricted until school fees have been fully paid.
                </Alert>
              )}
              <Table>
                <THead><TR><TH>Fee Item</TH><TH className="text-right">Amount</TH></TR></THead>
                <TBody>
                  {fees.items.map((item) => (
                    <TR key={item.category}>
                      <TD>{item.category}</TD>
                      <TD className="text-right">{formatNaira(item.amount)}</TD>
                    </TR>
                  ))}
                  <TR><TD className="font-semibold">Expected total</TD><TD className="text-right font-semibold">{formatNaira(fees.expected)}</TD></TR>
                  {fees.waived > 0 && <TR><TD>Waivers / discounts</TD><TD className="text-right">-{formatNaira(fees.waived)}</TD></TR>}
                  <TR><TD>Paid</TD><TD className="text-right text-green-600">{formatNaira(fees.paid)}</TD></TR>
                  <TR><TD className="font-bold">Outstanding</TD><TD className={cn("text-right font-bold", fees.outstanding > 0 && "text-destructive")}>{formatNaira(fees.outstanding)}</TD></TR>
                </TBody>
              </Table>
            </>
          ) : (
            <p className="text-muted-foreground">Loading fees…</p>
          )}
        </div>
      )}
    </div>
  );
}
