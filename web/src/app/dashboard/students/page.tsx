"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, TrendingUp } from "lucide-react";
import { api, ApiResponse, Paginated } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { fullName, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface StudentRow {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gender: string;
  status: string;
  admissionDate: string;
  passportUrl: string | null;
  classRoom: { id: string; name: string; section: string | null } | null;
  parent: { user: { firstName: string; lastName: string; phone: string | null } } | null;
}

interface ClassRoom {
  id: string;
  name: string;
}

const statusVariant: Record<string, "success" | "secondary" | "warning" | "destructive"> = {
  ACTIVE: "success",
  GRADUATED: "secondary",
  TRANSFERRED: "warning",
  SUSPENDED: "destructive",
  WITHDRAWN: "destructive",
};

export default function StudentsPage() {
  const user = getUser();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [data, setData] = useState<Paginated<StudentRow> | null>(null);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [q, setQ] = useState("");
  const [classRoomId, setClassRoomId] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (q) params.set("q", q);
    if (classRoomId) params.set("classRoomId", classRoomId);
    api
      .get<ApiResponse<Paginated<StudentRow>>>(`/students?${params}`)
      .then((r) => setData(r.data))
      .catch(() => null);
  }, [q, classRoomId, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0); // debounce typing
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    api.get<ApiResponse<ClassRoom[]>>("/classes").then((r) => setClasses(r.data)).catch(() => null);
  }, []);

  return (
    <div>
      <PageHeader title="Students" description={data ? `${data.total} student(s)` : undefined}>
        {isAdmin && (
          <>
            <Link href="/dashboard/students/promote">
              <Button variant="outline">
                <TrendingUp className="h-4 w-4" /> Promotion
              </Button>
            </Link>
            <Link href="/dashboard/students/new">
              <Button>
                <Plus className="h-4 w-4" /> Register Student
              </Button>
            </Link>
          </>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name or admission number…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          className="sm:w-56"
          value={classRoomId}
          onChange={(e) => {
            setClassRoomId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Student</TH>
            <TH>Admission No</TH>
            <TH className="hidden md:table-cell">Class</TH>
            <TH className="hidden lg:table-cell">Parent</TH>
            <TH className="hidden lg:table-cell">Admitted</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {data?.items.map((s) => (
            <TR key={s.id}>
              <TD>
                <Link href={`/dashboard/students/${s.id}`} className="flex items-center gap-2.5 font-medium text-primary hover:underline">
                  {s.passportUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.passportUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {s.firstName[0]}
                      {s.lastName[0]}
                    </span>
                  )}
                  {fullName(s)}
                </Link>
              </TD>
              <TD className="font-mono text-xs">{s.admissionNo}</TD>
              <TD className="hidden md:table-cell">{s.classRoom?.name ?? "—"}</TD>
              <TD className="hidden lg:table-cell">
                {s.parent ? `${s.parent.user.firstName} ${s.parent.user.lastName}` : "—"}
              </TD>
              <TD className="hidden lg:table-cell">{formatDate(s.admissionDate)}</TD>
              <TD>
                <Badge variant={statusVariant[s.status] ?? "secondary"}>{s.status}</Badge>
              </TD>
            </TR>
          ))}
          {data && data.items.length === 0 && (
            <TR>
              <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                No students found.
              </TD>
            </TR>
          )}
        </TBody>
      </Table>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
