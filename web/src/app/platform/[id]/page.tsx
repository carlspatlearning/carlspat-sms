"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Status = "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";

interface SchoolDetail {
  id: string;
  slug: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  headTeacherName: string | null;
  numberPrefix: string;
  isActive: boolean;
  subscriptionStatus: Status;
  plan: string;
  planAmount: number;
  subscriptionEndsAt: string | null;
  platformNotes: string | null;
  createdAt: string;
  pupils: number;
  accounts: number;
  teachers: number;
  onlinePaymentConfigured: boolean;
  feesCollected: number;
  admins: { id: string; firstName: string; lastName: string; email: string; isActive: boolean; lastLoginAt: string | null }[];
}

function naira(n: number) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [sub, setSub] = useState({ subscriptionStatus: "", plan: "", planAmount: "", platformNotes: "" });
  const [renewMonths, setRenewMonths] = useState("12");
  const [paystackKey, setPaystackKey] = useState("");

  const load = useCallback(() => {
    api.get<ApiResponse<SchoolDetail>>(`/platform/schools/${id}`)
      .then((r) => {
        setSchool(r.data);
        setSub({
          subscriptionStatus: r.data.subscriptionStatus,
          plan: r.data.plan,
          planAmount: String(r.data.planAmount),
          platformNotes: r.data.platformNotes ?? "",
        });
      })
      .catch((e) => setMessage({ type: "destructive", text: e instanceof Error ? e.message : "Could not load the school" }));
  }, [id]);

  useEffect(load, [load]);

  async function saveSubscription(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.patch(`/platform/schools/${id}`, {
        subscriptionStatus: sub.subscriptionStatus,
        plan: sub.plan,
        planAmount: Number(sub.planAmount || 0),
        platformNotes: sub.platformNotes,
      });
      setMessage({ type: "success", text: "Subscription updated." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  async function renew() {
    setSaving(true);
    setMessage(null);
    try {
      const r = await api.post<ApiResponse<SchoolDetail>>(`/platform/schools/${id}/renew`, {
        months: Number(renewMonths),
      });
      setMessage({
        type: "success",
        text: `Renewed. Access now runs to ${formatDate(r.data.subscriptionEndsAt ?? "")}.`,
      });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Could not renew" });
    } finally {
      setSaving(false);
    }
  }

  async function savePaystack(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.put(`/platform/schools/${id}/paystack`, { secretKey: paystackKey.trim() });
      setPaystackKey("");
      setMessage({
        type: "success",
        text: paystackKey.trim()
          ? "Payment key saved. This school now receives fees into its own Paystack account."
          : "Payment key removed. Online payment is switched off for this school.",
      });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Could not save the key" });
    } finally {
      setSaving(false);
    }
  }

  if (!school) {
    return <p className="text-muted-foreground">{message ? message.text : "Loading…"}</p>;
  }

  const suspended = school.subscriptionStatus === "SUSPENDED" || school.subscriptionStatus === "CANCELLED";
  const expired = school.subscriptionEndsAt !== null && new Date(school.subscriptionEndsAt).getTime() < Date.now();

  return (
    <div>
      <Link href="/platform" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All schools
      </Link>

      <PageHeader title={school.name} description={`${school.email} · joined ${formatDate(school.createdAt)}`} />

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      {(suspended || expired) && (
        <Alert variant="destructive" className="mb-4">
          {suspended
            ? "This school is suspended — nobody there can sign in. Their data is untouched and returns the moment you reactivate them."
            : "This subscription has expired. Staff and parents are locked out until it is renewed."}
        </Alert>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Mini label="Pupils" value={String(school.pupils)} />
        <Mini label="Staff accounts" value={String(school.accounts)} />
        <Mini label="Fees collected" value={naira(school.feesCollected)} />
        <Mini
          label="Online payment"
          value={school.onlinePaymentConfigured ? "Configured" : "Not set up"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveSubscription} className="space-y-3">
              <div>
                <Label>Status</Label>
                <Select value={sub.subscriptionStatus} onChange={(e) => setSub({ ...sub, subscriptionStatus: e.target.value })}>
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAST_DUE">Past due — still has access</option>
                  <option value="SUSPENDED">Suspended — locked out</option>
                  <option value="CANCELLED">Cancelled — locked out</option>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Plan</Label>
                  <Input value={sub.plan} onChange={(e) => setSub({ ...sub, plan: e.target.value })} />
                </div>
                <div>
                  <Label>Price per cycle (₦)</Label>
                  <Input type="number" min="0" value={sub.planAmount} onChange={(e) => setSub({ ...sub, planAmount: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Private note</Label>
                <Input
                  value={sub.platformNotes}
                  onChange={(e) => setSub({ ...sub, platformNotes: e.target.value })}
                  placeholder="Only you see this — e.g. why they were suspended"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </form>

            <div className="mt-5 border-t pt-4">
              <Label>Extend access</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                {school.subscriptionEndsAt
                  ? `Currently runs to ${formatDate(school.subscriptionEndsAt)}. Renewing early adds to that date rather than replacing it.`
                  : "No end date set — this school currently has open-ended access."}
              </p>
              <div className="flex gap-2">
                <Select value={renewMonths} onChange={(e) => setRenewMonths(e.target.value)} className="w-40">
                  <option value="1">1 month</option>
                  <option value="3">1 term (3 months)</option>
                  <option value="12">1 year</option>
                </Select>
                <Button variant="outline" onClick={renew} disabled={saving}>Renew</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Online fee payment</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                Fees go straight into this school&apos;s own Paystack account — the money never
                passes through you. Paste the secret key from <em>their</em> Paystack dashboard.
                Leave it blank and press save to switch online payment off.
              </p>
              <form onSubmit={savePaystack} className="space-y-3">
                <div>
                  <Label>Paystack secret key</Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    value={paystackKey}
                    onChange={(e) => setPaystackKey(e.target.value)}
                    placeholder={school.onlinePaymentConfigured ? "•••••••• (a key is saved)" : "sk_live_…"}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Stored securely and never shown again — not even here. To change it, paste a new one.
                  </p>
                </div>
                <Button type="submit" variant="outline" disabled={saving}>Save key</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Their admin accounts</CardTitle></CardHeader>
            <CardContent>
              {school.admins.length === 0 && (
                <p className="text-sm text-muted-foreground">No admin accounts — nobody can sign in to this school.</p>
              )}
              <ul className="space-y-2">
                {school.admins.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{a.firstName} {a.lastName}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                    <div className="text-right">
                      {!a.isActive && <Badge variant="destructive">disabled</Badge>}
                      <p className="text-xs text-muted-foreground">
                        {a.lastLoginAt ? `last in ${formatDate(a.lastLoginAt)}` : "never signed in"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
