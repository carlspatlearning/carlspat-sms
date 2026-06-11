"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Plus, Search } from "lucide-react";
import { api, ApiResponse, Paginated } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatNaira, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface PaymentRow {
  id: string;
  receiptNo: string;
  amount: string;
  method: string;
  status: string;
  paidAt: string;
  student: { id: string; firstName: string; lastName: string; admissionNo: string; classRoom: { name: string } | null };
  term: { name: string; session: { name: string } };
  recordedBy: { firstName: string; lastName: string } | null;
}
interface StudentOpt { id: string; firstName: string; lastName: string; admissionNo: string }
interface Term { id: string; name: string }

export default function PaymentsPage() {
  const user = getUser();
  const isManager = user && ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"].includes(user.role);

  const [data, setData] = useState<Paginated<PaymentRow> | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [term, setTerm] = useState<Term | null>(null);
  const [childIds, setChildIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [form, setForm] = useState({ studentId: "", amount: "", method: "CASH", reference: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      if (isManager) {
        const params = new URLSearchParams({ page: String(page), pageSize: "20" });
        if (q) params.set("q", q);
        const r = await api.get<ApiResponse<Paginated<PaymentRow>>>(`/payments?${params}`);
        setData(r.data);
      } else {
        // Parent: merge each child's payments
        const kids = await api.get<ApiResponse<{ id: string }[]>>("/parents/me/children");
        setChildIds(kids.data.map((k) => k.id));
        const all: PaymentRow[] = [];
        for (const k of kids.data) {
          const r = await api.get<ApiResponse<Paginated<PaymentRow>>>(`/payments?studentId=${k.id}&pageSize=50`);
          all.push(...r.data.items);
        }
        all.sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt));
        setData({ items: all, total: all.length, page: 1, pageSize: all.length || 1, totalPages: 1 });
      }
    } catch (e) {
      setMessage({ type: "destructive", text: e instanceof Error ? e.message : "Failed to load payments" });
    }
  }, [isManager, page, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    if (!isManager) return;
    api.get<ApiResponse<{ items: StudentOpt[] }>>("/students?pageSize=100").then((r) => setStudents(r.data.items)).catch(() => null);
    api.get<ApiResponse<Term>>("/settings/current-term").then((r) => setTerm(r.data)).catch(() => null);
  }, [isManager]);

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!term) return;
    setSaving(true);
    try {
      await api.post("/payments", {
        studentId: form.studentId,
        termId: term.id,
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      });
      setDialogOpen(false);
      setForm({ studentId: "", amount: "", method: "CASH", reference: "", notes: "" });
      setMessage({ type: "success", text: "Payment recorded — receipt generated." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to record payment" });
    } finally {
      setSaving(false);
    }
  }

  async function downloadReceipt(p: PaymentRow) {
    try {
      await api.download(`/payments/${p.id}/receipt`, `receipt-${p.receiptNo}.pdf`);
    } catch (e) {
      setMessage({ type: "destructive", text: e instanceof Error ? e.message : "Download failed" });
    }
  }

  return (
    <div>
      <PageHeader title="Payments" description="Fee payments and receipts">
        {isManager && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Record Payment
          </Button>
        )}
      </PageHeader>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      {isManager && (
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search receipt no, student…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      )}

      <Table>
        <THead>
          <TR>
            <TH>Receipt No</TH>
            <TH>Student</TH>
            <TH className="hidden md:table-cell">Term</TH>
            <TH className="hidden sm:table-cell">Method</TH>
            <TH className="hidden lg:table-cell">Date</TH>
            <TH className="text-right">Amount</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {data?.items.map((p) => (
            <TR key={p.id}>
              <TD className="font-mono text-xs">{p.receiptNo}</TD>
              <TD>
                <span className="font-medium">{p.student.firstName} {p.student.lastName}</span>
                <span className="block text-xs text-muted-foreground">{p.student.classRoom?.name}</span>
              </TD>
              <TD className="hidden text-xs md:table-cell">{p.term.name}, {p.term.session.name}</TD>
              <TD className="hidden sm:table-cell">
                <Badge variant={p.status === "SUCCESS" ? "success" : p.status === "PENDING" ? "warning" : "destructive"}>
                  {p.status === "SUCCESS" ? p.method.replace(/_/g, " ") : p.status}
                </Badge>
              </TD>
              <TD className="hidden text-xs lg:table-cell">{formatDate(p.paidAt)}</TD>
              <TD className="text-right font-semibold">{formatNaira(Number(p.amount))}</TD>
              <TD>
                {p.status === "SUCCESS" && (
                  <Button variant="ghost" size="icon" title="Download receipt" onClick={() => downloadReceipt(p)}>
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </TD>
            </TR>
          ))}
          {data && data.items.length === 0 && (
            <TR><TD colSpan={7} className="py-8 text-center text-muted-foreground">No payments found.</TD></TR>
          )}
        </TBody>
      </Table>

      {isManager && data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {data.page} of {data.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Record offline payment">
        <form onSubmit={recordPayment} className="space-y-4">
          <div>
            <Label htmlFor="pstudent">Student</Label>
            <Select id="pstudent" required value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}>
              <option value="">— Select student —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pamount">Amount (₦)</Label>
              <Input id="pamount" type="number" min="1" step="0.01" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="pmethod">Method</Label>
              <Select id="pmethod" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CARD">Card</option>
                <option value="POS">POS</option>
                <option value="CHEQUE">Cheque</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="pref">Reference (optional)</Label>
            <Input id="pref" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="Bank teller / transfer reference" />
          </div>
          <div>
            <Label htmlFor="pnotes">Notes (optional)</Label>
            <Input id="pnotes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Record &amp; issue receipt
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
