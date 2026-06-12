"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

interface ClassRoom { id: string; name: string }
interface Term { id: string; name: string; session: { name: string } }
interface CommentRow {
  student: { id: string; firstName: string; lastName: string; admissionNo: string; passportUrl: string | null };
  teacherComment: string;
  headTeacherComment: string;
}

const SUGGESTIONS = [
  "An excellent result. Keep it up!",
  "A very good performance. Aim higher next term.",
  "A good result, but there is room for improvement.",
  "Average performance. More effort is needed.",
  "Needs to work much harder next term.",
];

export default function CommentsPage() {
  const user = getUser();
  const isAdmin = user && ["SUPER_ADMIN", "ADMIN"].includes(user.role);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classRoomId, setClassRoomId] = useState("");
  const [term, setTerm] = useState<Term | null>(null);
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);

  useEffect(() => {
    api.get<ApiResponse<ClassRoom[]>>("/classes").then((r) => {
      setClasses(r.data);
      if (r.data.length) setClassRoomId((p) => p || r.data[0].id);
    }).catch(() => null);
    api.get<ApiResponse<Term>>("/settings/current-term").then((r) => setTerm(r.data)).catch(() => null);
  }, []);

  const load = useCallback(() => {
    if (!classRoomId || !term) return;
    setLoading(true);
    setMessage(null);
    api
      .get<ApiResponse<{ rows: CommentRow[] }>>(`/results/comments?classRoomId=${classRoomId}&termId=${term.id}`)
      .then((r) => setRows(r.data.rows))
      .catch((e) => setMessage({ type: "destructive", text: e.message }))
      .finally(() => setLoading(false));
  }, [classRoomId, term]);

  useEffect(load, [load]);

  function setField(studentId: string, field: "teacherComment" | "headTeacherComment", value: string) {
    setRows((rs) => rs.map((r) => (r.student.id === studentId ? { ...r, [field]: value } : r)));
  }

  async function saveRow(row: CommentRow) {
    if (!term) return;
    setSavingId(row.student.id);
    setMessage(null);
    try {
      await api.put("/results/comments", {
        studentId: row.student.id,
        termId: term.id,
        teacherComment: row.teacherComment,
        // Only admins may write the head teacher's comment
        ...(isAdmin ? { headTeacherComment: row.headTeacherComment } : {}),
      });
      setMessage({
        type: "success",
        text: `Comments saved for ${row.student.firstName} ${row.student.lastName} — they now appear on the report card.`,
      });
    } catch (e) {
      setMessage({ type: "destructive", text: e instanceof Error ? e.message : "Failed to save comments" });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Report Card Comments"
        description={term ? `Class teacher's and head teacher's comments — ${term.name}, ${term.session.name}` : undefined}
      />

      <div className="mb-4 max-w-xs">
        <Label htmlFor="cclass">Class</Label>
        <Select id="cclass" value={classRoomId} onChange={(e) => setClassRoomId(e.target.value)}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}
      {!isAdmin && (
        <Alert className="mb-4">
          You can write the <b>class teacher&apos;s comment</b>. The head teacher&apos;s comment can only be
          entered by the school admin.
        </Alert>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading students…</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.student.id}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {row.student.passportUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.student.passportUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {row.student.firstName[0]}{row.student.lastName[0]}
                      </span>
                    )}
                    <div>
                      <p className="font-semibold leading-tight">{row.student.lastName} {row.student.firstName}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{row.student.admissionNo}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => saveRow(row)} disabled={savingId !== null}>
                    {savingId === row.student.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor={`tc-${row.student.id}`}>Class teacher&apos;s comment</Label>
                    <Textarea
                      id={`tc-${row.student.id}`}
                      rows={2}
                      maxLength={500}
                      placeholder="e.g. A very good performance. Aim higher next term."
                      value={row.teacherComment}
                      onChange={(e) => setField(row.student.id, "teacherComment", e.target.value)}
                    />
                    <div className="mt-1 flex flex-wrap gap-1">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary"
                          onClick={() => setField(row.student.id, "teacherComment", s)}
                        >
                          {s.split(".")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`hc-${row.student.id}`}>Head teacher&apos;s comment {!isAdmin && "(admin only)"}</Label>
                    <Textarea
                      id={`hc-${row.student.id}`}
                      rows={2}
                      maxLength={500}
                      disabled={!isAdmin}
                      placeholder={isAdmin ? "e.g. An impressive result. Keep flying the school's flag high." : "Only the school admin can write this"}
                      value={row.headTeacherComment}
                      onChange={(e) => setField(row.student.id, "headTeacherComment", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && <p className="text-muted-foreground">No active students in this class.</p>}
        </div>
      )}
    </div>
  );
}
