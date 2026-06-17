"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface ClassRoom { id: string; name: string }
interface Subject { id: string; name: string }
interface Term { id: string; name: string; session: { name: string } }
interface Assessment { id: string; name: string; maxScore: number }
interface SheetRow {
  student: { id: string; firstName: string; lastName: string; admissionNo: string };
  scores: { assessmentTypeId: string; score: number | null }[];
}
interface TeacherAssignment {
  formClasses: { id: string; name: string }[];
  classSubjects: { classRoomId: string; subjectId: string; classRoom: { id: string; name: string }; subject: { id: string; name: string } }[];
}

export default function ResultsPage() {
  const user = getUser();
  const isTeacher = user?.role === "TEACHER";

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [teacherAssignment, setTeacherAssignment] = useState<TeacherAssignment | null>(null);
  const [term, setTerm] = useState<Term | null>(null);
  const [classRoomId, setClassRoomId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingCol, setSavingCol] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);

  useEffect(() => {
    api.get<ApiResponse<Term>>("/settings/current-term").then((r) => setTerm(r.data)).catch(() => null);

    if (isTeacher) {
      api.get<ApiResponse<TeacherAssignment>>("/teachers/me/classes").then((r) => {
        const assignment = r.data;
        setTeacherAssignment(assignment);
        // Build unique class list from form classes + teaching classes
        const classMap = new Map<string, ClassRoom>();
        assignment.formClasses.forEach((c) => classMap.set(c.id, c));
        assignment.classSubjects.forEach((cs) => classMap.set(cs.classRoom.id, cs.classRoom));
        const classList = [...classMap.values()];
        setClasses(classList);
        if (classList.length) setClassRoomId((p) => p || classList[0].id);
      }).catch(() => null);
    } else {
      api.get<ApiResponse<ClassRoom[]>>("/classes").then((r) => {
        setClasses(r.data);
        if (r.data.length) setClassRoomId((p) => p || r.data[0].id);
      }).catch(() => null);
      api.get<ApiResponse<Subject[]>>("/subjects").then((r) => {
        setAllSubjects(r.data);
        if (r.data.length) setSubjectId((p) => p || r.data[0].id);
      }).catch(() => null);
    }
  }, [isTeacher]);

  // When class changes, update available subjects
  useEffect(() => {
    if (!classRoomId) return;
    if (isTeacher && teacherAssignment) {
      const subs = teacherAssignment.classSubjects
        .filter((cs) => cs.classRoomId === classRoomId)
        .map((cs) => cs.subject);
      if (subs.length) setSubjectId((p) => (subs.find((s) => s.id === p) ? p : subs[0].id));
      // allSubjects not needed for teachers — subjects derived from assignment
    }
  }, [classRoomId, isTeacher, teacherAssignment]);

  const availableSubjects: Subject[] = isTeacher && teacherAssignment
    ? teacherAssignment.classSubjects.filter((cs) => cs.classRoomId === classRoomId).map((cs) => cs.subject)
    : allSubjects;

  const loadSheet = useCallback(() => {
    if (!classRoomId || !subjectId || !term) return;
    setLoading(true);
    setMessage(null);
    api
      .get<ApiResponse<{ assessments: Assessment[]; rows: SheetRow[] }>>(
        `/results/scores?classRoomId=${classRoomId}&subjectId=${subjectId}&termId=${term.id}`
      )
      .then((r) => {
        setAssessments(r.data.assessments);
        setRows(r.data.rows);
      })
      .catch((e) => setMessage({ type: "destructive", text: e.message }))
      .finally(() => setLoading(false));
  }, [classRoomId, subjectId, term]);

  useEffect(loadSheet, [loadSheet]);

  function setScore(studentId: string, assessmentTypeId: string, value: string) {
    const score = value === "" ? null : Number(value);
    setRows((rs) =>
      rs.map((r) =>
        r.student.id === studentId
          ? { ...r, scores: r.scores.map((s) => (s.assessmentTypeId === assessmentTypeId ? { ...s, score } : s)) }
          : r
      )
    );
  }

  async function saveColumn(assessment: Assessment) {
    if (!term) return;
    const scores = rows
      .map((r) => ({
        studentId: r.student.id,
        score: r.scores.find((s) => s.assessmentTypeId === assessment.id)?.score,
      }))
      .filter((s): s is { studentId: string; score: number } => s.score !== null && s.score !== undefined);
    if (scores.length === 0) {
      setMessage({ type: "destructive", text: `No ${assessment.name} scores entered yet.` });
      return;
    }
    setSavingCol(assessment.id);
    setMessage(null);
    try {
      const res = await api.post<{ message: string }>("/results/scores", {
        classRoomId,
        subjectId,
        termId: term.id,
        assessmentTypeId: assessment.id,
        scores,
      });
      setMessage({ type: "success", text: `${assessment.name}: ${res.message}` });
    } catch (e) {
      setMessage({ type: "destructive", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSavingCol(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Results & Score Entry"
        description={term ? `${term.name}, ${term.session.name} session` : undefined}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <div>
          <Label htmlFor="class">Class</Label>
          <Select id="class" value={classRoomId} onChange={(e) => setClassRoomId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Select id="subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {availableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      </div>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      {loading ? (
        <p className="text-muted-foreground">Loading score sheet…</p>
      ) : availableSubjects.length === 0 && isTeacher ? (
        <p className="text-muted-foreground">You have no subjects assigned for this class.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Student</TH>
              {assessments.map((a) => (
                <TH key={a.id} className="min-w-[110px] text-center">
                  <div>{a.name}</div>
                  <div className="font-normal normal-case">max {a.maxScore}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-6 px-2 text-[11px]"
                    onClick={() => saveColumn(a)}
                    disabled={savingCol !== null}
                  >
                    {savingCol === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save
                  </Button>
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.student.id}>
                <TD className="font-medium">
                  {r.student.lastName} {r.student.firstName}
                  <span className="block font-mono text-[11px] text-muted-foreground">{r.student.admissionNo}</span>
                </TD>
                {assessments.map((a) => {
                  const cell = r.scores.find((s) => s.assessmentTypeId === a.id);
                  return (
                    <TD key={a.id} className="text-center">
                      <Input
                        type="number"
                        min={0}
                        max={a.maxScore}
                        step="0.5"
                        className="mx-auto h-8 w-20 text-center"
                        value={cell?.score ?? ""}
                        onChange={(e) => setScore(r.student.id, a.id, e.target.value)}
                        aria-label={`${a.name} score for ${r.student.firstName} ${r.student.lastName}`}
                      />
                    </TD>
                  );
                })}
              </TR>
            ))}
            {rows.length === 0 && (
              <TR><TD colSpan={assessments.length + 1} className="py-8 text-center text-muted-foreground">No students found.</TD></TR>
            )}
          </TBody>
        </Table>
      )}
    </div>
  );
}
