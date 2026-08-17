"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, School as SchoolIcon } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Status = "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";

interface SchoolRow {
  id: string;
  slug: string;
  name: string;
  email: string;
  phone: string;
  subscriptionStatus: Status;
  plan: string;
  planAmount: number;
  subscriptionEndsAt: string | null;
  isActive: boolean;
  pupils: number;
  accounts: number;
  createdAt: string;
}

interface Overview {
  schools: number;
  pupilsAcrossPlatform: number;
  recurringRevenue: number;
  expiringSoon: number;
  expired: number;
  byStatus: Record<string, number>;
}

function naira(n: number) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

/** Colour carries the same meaning as the word, for quick scanning. */
function statusTone(s: Status): "default" | "secondary" | "destructive" {
  if (s === "ACTIVE") return "default";
  if (s === "SUSPENDED" || s === "CANCELLED") return "destructive";
  return "secondary";
}

function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  return Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000);
}

export default function PlatformPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [schools, setSchools] = useState<SchoolRow[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "",
    plan: "standard", planAmount: "", subscriptionStatus: "TRIAL",
    adminFirstName: "", adminLastName: "", adminEmail: "", adminPassword: "",
  });

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    api.get<ApiResponse<SchoolRow[]>>(`/platform/schools?${p}`)
      .then((r) => setSchools(r.data))
      .catch((e) => setMessage({ type: "destructive", text: e instanceof Error ? e.message : "Could not load schools" }));
  }, [q, status]);

  useEffect(load, [load]);

  useEffect(() => {
    api.get<ApiResponse<Overview>>("/platform/overview")
      .then((r) => setOverview(r.data))
      .catch(() => null);
  }, []);

  async function addSchool(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.post("/platform/schools", {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        address: form.address || undefined,
        plan: form.plan,
        planAmount: Number(form.planAmount || 0),
        subscriptionStatus: form.subscriptionStatus,
        adminFirstName: form.adminFirstName,
        adminLastName: form.adminLastName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      });
      setAddOpen(false);
      setForm({
        name: "", email: "", phone: "", address: "",
        plan: "standard", planAmount: "", subscriptionStatus: "TRIAL",
        adminFirstName: "", adminLastName: "", adminEmail: "", adminPassword: "",
      });
      setMessage({ type: "success", text: "School created. Give the head teacher their login details." });
      load();
      api.get<ApiResponse<Overview>>("/platform/overview").then((r) => setOverview(r.data)).catch(() => null);
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Could not create the school" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Schools" description="Every school subscribing to the system">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add school
        </Button>
      </PageHeader>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      {overview && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Schools" value={String(overview.schools)} />
          <Stat label="Pupils across all schools" value={overview.pupilsAcrossPlatform.toLocaleString()} />
          <Stat label="Recurring revenue" value={naira(overview.recurringRevenue)} hint="from schools currently active" />
          <Stat
            label="Needs attention"
            value={String(overview.expired + overview.expiringSoon)}
            hint={`${overview.expired} expired · ${overview.expiringSoon} due within 30 days`}
            tone={overview.expired > 0 ? "warn" : undefined}
          />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-56">
          <option value="">All statuses</option>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="PAST_DUE">Past due</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>School</TH>
                <TH>Status</TH>
                <TH>Plan</TH>
                <TH>Pupils</TH>
                <TH>Renews</TH>
              </TR>
            </THead>
            <TBody>
              {schools?.map((s) => {
                const left = daysLeft(s.subscriptionEndsAt);
                return (
                  <TR key={s.id}>
                    <TD>
                      <Link href={`/platform/${s.id}`} className="font-medium hover:underline">
                        {s.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </TD>
                    <TD>
                      <Badge variant={statusTone(s.subscriptionStatus)}>
                        {s.subscriptionStatus.replace("_", " ").toLowerCase()}
                      </Badge>
                    </TD>
                    <TD>
                      {s.plan}
                      <div className="text-xs text-muted-foreground">{naira(s.planAmount)}</div>
                    </TD>
                    <TD>{s.pupils}</TD>
                    <TD>
                      {s.subscriptionEndsAt ? (
                        <>
                          {formatDate(s.subscriptionEndsAt)}
                          {left !== null && (
                            <div className={`text-xs ${left < 0 ? "text-destructive" : left <= 30 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {left < 0 ? `${Math.abs(left)} days overdue` : `${left} days left`}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
              {schools?.length === 0 && (
                <TR>
                  <TD colSpan={5}>
                    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                      <SchoolIcon className="h-8 w-8" />
                      <p>No schools yet. Add your first one to get started.</p>
                    </div>
                  </TD>
                </TR>
              )}
              {schools === null && (
                <TR>
                  <TD colSpan={5}>
                    <div className="py-10 text-center text-muted-foreground">Loading…</div>
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add a school">
        <form onSubmit={addSchool} className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label>School name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="St. Mary's Academy" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>School email</Label>
                <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Plan</Label>
                <Input value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} />
              </div>
              <div>
                <Label>Price per cycle (₦)</Label>
                <Input type="number" min="0" value={form.planAmount} onChange={(e) => setForm({ ...form, planAmount: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.subscriptionStatus} onChange={(e) => setForm({ ...form, subscriptionStatus: e.target.value })}>
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Active</option>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="mb-3 text-sm font-medium">The school&apos;s first login</p>
            <p className="mb-3 text-xs text-muted-foreground">
              This creates the head teacher&apos;s super-admin account. Without it the school
              exists but nobody can get in. Give them these details directly, and ask them to
              change the password when they first sign in.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>First name</Label>
                <Input required value={form.adminFirstName} onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })} />
              </div>
              <div>
                <Label>Last name</Label>
                <Input required value={form.adminLastName} onChange={(e) => setForm({ ...form, adminLastName: e.target.value })} />
              </div>
              <div>
                <Label>Their email</Label>
                <Input type="email" required value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
              </div>
              <div>
                <Label>Temporary password</Label>
                <Input type="text" required minLength={8} value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create school
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-destructive" : ""}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
