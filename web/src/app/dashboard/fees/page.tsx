"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatNaira } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface Term { id: string; name: string; isCurrent?: boolean; session: { name: string } }
interface ClassRoom { id: string; name: string }
interface Category { id: string; name: string }
interface Structure {
  id: string; amount: string;
  category: Category;
  classRoom: { id: string; name: string };
  term: { id: string; name: string; session: { name: string } };
}
interface Debtor {
  student: {
    id: string; firstName: string; lastName: string; admissionNo: string;
    classRoom: { name: string } | null;
    parent: { user: { firstName: string; lastName: string; phone: string | null } } | null;
  };
  expected: number; paid: number; waived: number; outstanding: number;
}
interface ChildBalance {
  id: string; name: string; admissionNo: string; className: string;
  outstanding: number; fullyPaid: boolean;
}

export default function FeesPage() {
  const user = getUser();
  const isManager = user && ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"].includes(user.role);

  return isManager ? <StaffFees /> : <FamilyFees />;
}

// ── Staff view: fee structures + debtors ─────────────────────────────────────

function StaffFees() {
  const [term, setTerm] = useState<Term | null>(null);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [debtors, setDebtors] = useState<{ debtors: Debtor[]; totalOutstanding: number } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [form, setForm] = useState({ classRoomId: "", categoryId: "", amount: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get<ApiResponse<Term>>("/settings/current-term").then((r) => setTerm(r.data)).catch(() => null);
    api.get<ApiResponse<ClassRoom[]>>("/classes").then((r) => setClasses(r.data)).catch(() => null);
    api.get<ApiResponse<Category[]>>("/fees/categories").then((r) => setCategories(r.data)).catch(() => null);
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!term) return;
    api.get<ApiResponse<Structure[]>>(`/fees/structures?termId=${term.id}`).then((r) => setStructures(r.data)).catch(() => null);
    api.get<ApiResponse<{ debtors: Debtor[]; totalOutstanding: number }>>(`/fees/debtors?termId=${term.id}`)
      .then((r) => setDebtors(r.data))
      .catch(() => null);
  }, [term]);

  async function addStructure(e: React.FormEvent) {
    e.preventDefault();
    if (!term) return;
    setSaving(true);
    try {
      await api.post("/fees/structures", {
        termId: term.id,
        classRoomId: form.classRoomId,
        categoryId: form.categoryId,
        amount: Number(form.amount),
      });
      setDialogOpen(false);
      setForm({ classRoomId: "", categoryId: "", amount: "" });
      setMessage({ type: "success", text: "Fee structure saved" });
      const r = await api.get<ApiResponse<Structure[]>>(`/fees/structures?termId=${term.id}`);
      setStructures(r.data);
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Fee Management" description={term ? `${term.name}, ${term.session.name} session` : undefined}>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Set Fee
        </Button>
      </PageHeader>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Fee Structure (current term)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Class</TH><TH>Category</TH><TH className="text-right">Amount</TH></TR></THead>
              <TBody>
                {structures.map((s) => (
                  <TR key={s.id}>
                    <TD>{s.classRoom.name}</TD>
                    <TD>{s.category.name}</TD>
                    <TD className="text-right">{formatNaira(Number(s.amount))}</TD>
                  </TR>
                ))}
                {structures.length === 0 && (
                  <TR><TD colSpan={3} className="py-6 text-center text-muted-foreground">No fees configured for this term yet.</TD></TR>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Debtors {debtors && <span className="text-sm font-normal text-muted-foreground">— total outstanding {formatNaira(debtors.totalOutstanding)}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Student</TH><TH className="hidden sm:table-cell">Parent Contact</TH><TH className="text-right">Outstanding</TH></TR></THead>
              <TBody>
                {debtors?.debtors.map((d) => (
                  <TR key={d.student.id}>
                    <TD>
                      <span className="font-medium">{d.student.firstName} {d.student.lastName}</span>
                      <span className="block text-xs text-muted-foreground">{d.student.classRoom?.name} · {d.student.admissionNo}</span>
                    </TD>
                    <TD className="hidden text-xs sm:table-cell">
                      {d.student.parent
                        ? `${d.student.parent.user.firstName} ${d.student.parent.user.lastName} ${d.student.parent.user.phone ?? ""}`
                        : "—"}
                    </TD>
                    <TD className="text-right font-semibold text-destructive">{formatNaira(d.outstanding)}</TD>
                  </TR>
                ))}
                {debtors && debtors.debtors.length === 0 && (
                  <TR><TD colSpan={3} className="py-6 text-center text-muted-foreground">No outstanding fees. 🎉</TD></TR>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Set fee for a class">
        <form onSubmit={addStructure} className="space-y-4">
          <div>
            <Label htmlFor="fclass">Class</Label>
            <Select id="fclass" required value={form.classRoomId} onChange={(e) => setForm((f) => ({ ...f, classRoomId: e.target.value }))}>
              <option value="">— Select class —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="fcat">Fee category</Label>
            <Select id="fcat" required value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <option value="">— Select category —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="famount">Amount (₦)</Label>
            <Input id="famount" type="number" min="1" step="0.01" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save fee
          </Button>
        </form>
      </Dialog>
    </div>
  );
}

// ── Parent/student view: balances + online payment ──────────────────────────

function FamilyFees() {
  const user = getUser();
  const [term, setTerm] = useState<Term | null>(null);
  const [children, setChildren] = useState<ChildBalance[]>([]);
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ApiResponse<{ currentTerm: Term | null; children?: ChildBalance[]; student?: ChildBalance & { className: string } }>>("/dashboard/me")
      .then((r) => {
        setTerm(r.data.currentTerm);
        if (r.data.children) setChildren(r.data.children);
        else if (r.data.student) {
          setChildren([{ ...r.data.student, name: "My fees" } as ChildBalance]);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  async function payOnline(studentId: string, amount: number) {
    if (!term) return;
    setPaying(studentId);
    setError(null);
    try {
      const res = await api.post<ApiResponse<{ authorizationUrl: string }>>("/payments/paystack/init", {
        studentId,
        termId: term.id,
        amount,
      });
      window.location.href = res.data.authorizationUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start online payment");
      setPaying(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="School Fees" description={term ? `${term.name}` : undefined} />
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

      <div className="space-y-4">
        {children.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.className} · {c.admissionNo}</p>
                {c.fullyPaid ? (
                  <p className="mt-1 text-sm font-medium text-green-600">✓ Fees fully paid for this term</p>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-destructive">Outstanding: {formatNaira(c.outstanding)}</p>
                )}
              </div>
              {!c.fullyPaid && user?.role === "PARENT" && (
                <Button onClick={() => payOnline(c.id, c.outstanding)} disabled={paying === c.id}>
                  {paying === c.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  Pay {formatNaira(c.outstanding)} online
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {children.length === 0 && !error && <p className="text-muted-foreground">Loading…</p>}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Online payments are processed securely by Paystack. You can also pay by bank transfer or cash at the
        bursar&apos;s office — receipts are issued immediately.
      </p>
    </div>
  );
}
