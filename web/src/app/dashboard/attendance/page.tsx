"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface ClassRoom { id: string; name: string }
interface RegisterRow {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  status: "PRESENT" | "ABSENT" | "LATE" | null;
}

const STATUSES = [
  { value: "PRESENT", label: "Present", activeClass: "bg-green-600 text-white" },
  { value: "LATE", label: "Late", activeClass: "bg-amber-500 text-white" },
  { value: "ABSENT", label: "Absent", activeClass: "bg-red-600 text-white" },
] as const;

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classRoomId, setClassRoomId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);

  useEffect(() => {
    api.get<ApiResponse<ClassRoom[]>>("/classes").then((r) => {
      setClasses(r.data);
      if (r.data.length > 0) setClassRoomId((prev) => prev || r.data[0].id);
    }).catch(() => null);
  }, []);

  const loadRegister = useCallback(() => {
    if (!classRoomId || !date) return;
    setLoading(true);
    setMessage(null);
    api
      .get<ApiResponse<RegisterRow[]>>(`/attendance/class/${classRoomId}?date=${date}`)
      .then((r) => setRows(r.data))
      .catch((e) => setMessage({ type: "destructive", text: e.message }))
      .finally(() => setLoading(false));
  }, [classRoomId, date]);

  useEffect(loadRegister, [loadRegister]);

  function setStatus(studentId: string, status: RegisterRow["status"]) {
    setRows((rs) => rs.map((r) => (r.id === studentId ? { ...r, status } : r)));
  }

  function markAll(status: RegisterRow["status"]) {
    setRows((rs) => rs.map((r) => ({ ...r, status })));
  }

  async function save() {
    const records = rows.filter((r) => r.status).map((r) => ({ studentId: r.id, status: r.status! }));
    if (records.length === 0) {
      setMessage({ type: "destructive", text: "Mark at least one student before saving." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.post<{ message: string }>("/attendance/mark", { classRoomId, date, records });
      setMessage({ type: "success", text: res.message });
    } catch (e) {
      setMessage({ type: "destructive", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Attendance" description="Mark the daily class register">
        <Button onClick={save} disabled={saving || rows.length === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Register
        </Button>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="class">Class</Label>
          <Select id="class" value={classRoomId} onChange={(e) => setClassRoomId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" size="sm" onClick={() => markAll("PRESENT")}>All present</Button>
          <Button variant="outline" size="sm" onClick={() => markAll(null)}>Clear</Button>
        </div>
      </div>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      {loading ? (
        <p className="text-muted-foreground">Loading register…</p>
      ) : (
        <Table>
          <THead>
            <TR><TH>#</TH><TH>Student</TH><TH className="hidden sm:table-cell">Admission No</TH><TH>Status</TH></TR>
          </THead>
          <TBody>
            {rows.map((r, i) => (
              <TR key={r.id}>
                <TD className="text-muted-foreground">{i + 1}</TD>
                <TD className="font-medium">{r.lastName} {r.firstName}</TD>
                <TD className="hidden font-mono text-xs sm:table-cell">{r.admissionNo}</TD>
                <TD>
                  <div className="flex gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setStatus(r.id, s.value)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                          r.status === s.value ? s.activeClass : "hover:bg-secondary"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR><TD colSpan={4} className="py-8 text-center text-muted-foreground">No active students in this class.</TD></TR>
            )}
          </TBody>
        </Table>
      )}
    </div>
  );
}
