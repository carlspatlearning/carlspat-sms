"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Users, Wallet, CalendarCheck, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatNaira } from "@/lib/utils";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

interface StaffStats {
  currentTerm: { id: string; name: string; session: string } | null;
  totals: { students: number; teachers: number; parents: number; classes: number };
  attendanceRate: number;
  fees: { expected: number; collected: number; waived: number; outstanding: number; collectionRate: number };
  finance: { income: number; expenditure: number; balance: number };
  classPerformance: { classRoomId: string; className: string; average: number; students: number }[];
}

interface ParentStats {
  currentTerm: { id: string; name: string } | null;
  children: {
    id: string; name: string; admissionNo: string; className: string;
    passportUrl: string | null; outstanding: number; fullyPaid: boolean;
  }[];
}

export default function DashboardPage() {
  const user = typeof window !== "undefined" ? getUser() : null;
  const isStaff = user && ["SUPER_ADMIN", "ADMIN", "TEACHER", "ACCOUNTANT"].includes(user.role);

  const [staff, setStaff] = useState<StaffStats | null>(null);
  const [me, setMe] = useState<ParentStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (isStaff) {
      api.get<ApiResponse<StaffStats>>("/dashboard/stats").then((r) => setStaff(r.data)).catch((e) => setError(e.message));
    } else {
      api.get<ApiResponse<ParentStats>>("/dashboard/me").then((r) => setMe(r.data)).catch((e) => setError(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.firstName}`}
        description={
          staff?.currentTerm
            ? `${staff.currentTerm.name}, ${staff.currentTerm.session} session`
            : me?.currentTerm
              ? `${me.currentTerm.name}`
              : undefined
        }
      />
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

      {isStaff && staff && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Students" value={staff.totals.students} icon={<GraduationCap className="h-5 w-5" />} />
            <StatCard label="Total Teachers" value={staff.totals.teachers} icon={<Users className="h-5 w-5" />} />
            <StatCard
              label="Attendance Rate"
              value={`${staff.attendanceRate}%`}
              hint="Last 30 days"
              icon={<CalendarCheck className="h-5 w-5" />}
              tone={staff.attendanceRate >= 90 ? "success" : staff.attendanceRate >= 75 ? "warning" : "danger"}
            />
            <StatCard
              label="Fee Collection"
              value={`${staff.fees.collectionRate}%`}
              hint={`${formatNaira(staff.fees.collected)} of ${formatNaira(staff.fees.expected)}`}
              icon={<Wallet className="h-5 w-5" />}
              tone={staff.fees.collectionRate >= 80 ? "success" : "warning"}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Outstanding Fees</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-destructive">{formatNaira(staff.fees.outstanding)}</p>
                <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                  <p>Expected: <span className="font-medium text-foreground">{formatNaira(staff.fees.expected)}</span></p>
                  <p>Collected: <span className="font-medium text-green-600">{formatNaira(staff.fees.collected)}</span></p>
                  {staff.fees.waived > 0 && (
                    <p>Discounts: <span className="font-medium text-blue-600">-{formatNaira(staff.fees.waived)}</span></p>
                  )}
                </div>
                {(user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "ACCOUNTANT") && (
                  <Link href="/dashboard/fees" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                    View debtors report →
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Summary (current term)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-950">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Total Income</span>
                  </div>
                  <span className="font-bold text-green-600">{formatNaira(staff.finance.income)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-red-50 p-3 dark:bg-red-950">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">Total Expenditure</span>
                  </div>
                  <span className="font-bold text-destructive">{formatNaira(staff.finance.expenditure)}</span>
                </div>
                <div className={`flex items-center justify-between rounded-lg p-3 ${staff.finance.balance >= 0 ? "bg-blue-50 dark:bg-blue-950" : "bg-orange-50 dark:bg-orange-950"}`}>
                  <div className="flex items-center gap-2">
                    <Scale className={`h-4 w-4 ${staff.finance.balance >= 0 ? "text-blue-600" : "text-orange-600"}`} />
                    <span className="text-sm font-medium">Net Balance</span>
                  </div>
                  <span className={`font-bold ${staff.finance.balance >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                    {staff.finance.balance < 0 ? "-" : ""}{formatNaira(Math.abs(staff.finance.balance))}
                  </span>
                </div>
                {(user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "ACCOUNTANT") && (
                  <Link href="/dashboard/expenditures" className="inline-block text-sm font-medium text-primary hover:underline">
                    View expenditures →
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Academic Performance by Class</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {staff.classPerformance.filter((c) => c.students > 0).map((c) => (
                  <div key={c.classRoomId} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-sm">{c.className}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, c.average)}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-sm font-medium">{c.average}%</span>
                  </div>
                ))}
                {staff.classPerformance.every((c) => c.students === 0) && (
                  <p className="text-sm text-muted-foreground col-span-full">No scores recorded yet this term.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!isStaff && me && (
        <div className="grid gap-4 md:grid-cols-2">
          {user.role === "PARENT" &&
            me.children.map((child) => (
              <Card key={child.id}>
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  {child.passportUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={child.passportUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                      {child.name.slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <CardTitle>{child.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {child.className} · {child.admissionNo}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  {child.fullyPaid ? (
                    <Badge variant="success">Fees fully paid</Badge>
                  ) : (
                    <Badge variant="destructive">Outstanding: {formatNaira(child.outstanding)}</Badge>
                  )}
                  <div className="flex gap-3 text-sm font-medium">
                    <Link className="text-primary hover:underline" href={`/dashboard/students/${child.id}`}>
                      Profile
                    </Link>
                    <Link className="text-primary hover:underline" href="/dashboard/report-cards">
                      Report card
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          {user.role === "PARENT" && me.children.length === 0 && (
            <Alert title="No children linked">
              Your account is not linked to any student yet. Please contact the school admin.
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
