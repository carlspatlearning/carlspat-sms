"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
interface Category { id: string; name: string; description?: string }
interface Structure {
  id: string; amount: string;
  category: Category;
  classRoom: { id: string; name: string };
  term: { id: string; name: string; session: { name: string } };
}
interface StudentOpt { id: string; firstName: string; lastName: string; admissionNo: string }
interface Waiver {
  id: string; amount: string; reason: string;
  student: { firstName: string; lastName: string; admissionNo: string };
  term: { name: string; session: { name: string } };
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
  const [discountDialog, setDiscountDialog] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [editStructure, setEditStructure] = useState<Structure | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [form, setForm] = useState({ classRoomId: "", categoryId: "", amount: "" });
  const [discountForm, setDiscountForm] = useState({ studentId: "", amount: "", reason: "" });
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
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
      .then((r) => setDebtors(r.data)).catch(() => null);
    api.get<ApiResponse<Waiver[]>>(`/fees/waivers?termId=${term.id}`).then((r) => setWaivers(r.data)).catch(() => null);
  }, [term]);

  useEffect(() => {
    api.get<ApiResponse<{ items: StudentOpt[] }>>("/students?pageSize=200").then((r) => setStudents(r.data.items)).catch(() => null);
  }, []);

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

  async function saveEditStructure(e: React.FormEvent) {
    e.preventDefault();
    if (!editStructure || !term) return;
    setSaving(true);
    try {
      await api.post("/fees/structures", {
        termId: term.id,
        classRoomId: editStructure.classRoom.id,
        categoryId: editStructure.category.id,
        amount: Number(editAmount),
      });
      setEditStructure(null);
      setMessage({ type: "success", text: "Fee updated." });
      const r = await api.get<ApiResponse<Structure[]>>(`/fees/structures?termId=${term.id}`);
      setStructures(r.data);
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteStructure(id: string) {
    if (!confirm("Remove this fee? Students will no longer be charged for it.")) return;
    try {
      await api.delete(`/fees/structures/${id}`);
      setMessage({ type: "success", text: "Fee removed." });
      if (term) {
        const r = await api.get<ApiResponse<Structure[]>>(`/fees/structures?termId=${term.id}`);
        setStructures(r.data);
      }
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    }
  }

  async function addDiscount(e: React.FormEvent) {
    e.preventDefault();
    if (!term) return;
    setSaving(true);
    try {
      await api.post("/fees/waivers", {
        studentId: discountForm.studentId,
        termId: term.id,
        amount: Number(discountForm.amount),
        reason: discountForm.reason,
      });
      setDiscountDialog(false);
      setDiscountForm({ studentId: "", amount: "", reason: "" });
      setMessage({ type: "success", text: "Discount applied to student's fees." });
      const r = await api.get<ApiResponse<Waiver[]>>(`/fees/waivers?termId=${term.id}`);
      setWaivers(r.data);
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function removeDiscount(id: string) {
    if (!confirm("Remove this discount?")) return;
    try {
      await api.delete(`/fees/waivers/${id}`);
      setMessage({ type: "success", text: "Discount removed." });
      if (term) {
        const r = await api.get<ApiResponse<Waiver[]>>(`/fees/waivers?termId=${term.id}`);
        setWaivers(r.data);
      }
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    }
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editCategory) {
        await api.put(`/fees/categories/${editCategory.id}`, categoryForm);
        setMessage({ type: "success", text: "Category updated." });
      } else {
        await api.post("/fees/categories", categoryForm);
        setMessage({ type: "success", text: "Category added." });
      }
      setCategoryDialog(false);
      setEditCategory(null);
      setCategoryForm({ name: "", description: "" });
      const r = await api.get<ApiResponse<Category[]>>("/fees/categories");
      setCategories(r.data);
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(cat: Category) {
    if (!confirm(`Delete category "${cat.name}"? Any fee structures using it will also be removed.`)) return;
    try {
      await api.delete(`/fees/categories/${cat.id}`);
      setMessage({ type: "success", text: "Category deleted." });
      const r = await api.get<ApiResponse<Category[]>>("/fees/categories");
      setCategories(r.data);
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    }
  }

  return (
    <div>
      <PageHeader title="Fee Management" description={term ? `${term.name}, ${term.session.name} session` : undefined}>
        <Button variant="outline" onClick={() => setDiscountDialog(true)}>
          <Plus className="h-4 w-4" /> Add Discount
        </Button>
        <Button variant="outline" onClick={() => { setEditCategory(null); setCategoryForm({ name: "", description: "" }); setCategoryDialog(true); }}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
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
              <THead><TR><TH>Class</TH><TH>Category</TH><TH className="text-right">Amount</TH><TH></TH></TR></THead>
              <TBody>
                {structures.map((s) => (
                  <TR key={s.id}>
                    <TD>{s.classRoom.name}</TD>
                    <TD>{s.category.name}</TD>
                    <TD className="text-right">{formatNaira(Number(s.amount))}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => { setEditStructure(s); setEditAmount(String(Number(s.amount))); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteStructure(s.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
                {structures.length === 0 && (
                  <TR><TD colSpan={4} className="py-6 text-center text-muted-foreground">No fees configured for this term yet.</TD></TR>
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

      {/* Fee categories */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Fee Categories</CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setEditCategory(null); setCategoryForm({ name: "", description: "" }); setCategoryDialog(true); }}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No categories yet. Add one above.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-sm">
                  <span className="font-medium">{cat.name}</span>
                  <button onClick={() => { setEditCategory(cat); setCategoryForm({ name: cat.name, description: cat.description ?? "" }); setCategoryDialog(true); }}
                    className="ml-1 rounded p-0.5 hover:bg-muted" title="Edit">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => deleteCategory(cat)}
                    className="rounded p-0.5 hover:bg-muted" title="Delete">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discounts / waivers */}
      {waivers.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Discounts Applied (current term)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Student</TH><TH>Reason</TH><TH className="text-right">Amount</TH><TH></TH></TR></THead>
              <TBody>
                {waivers.map((w) => (
                  <TR key={w.id}>
                    <TD>
                      <span className="font-medium">{w.student.firstName} {w.student.lastName}</span>
                      <span className="block text-xs text-muted-foreground">{w.student.admissionNo}</span>
                    </TD>
                    <TD className="text-sm">{w.reason}</TD>
                    <TD className="text-right font-semibold text-green-600">-{formatNaira(Number(w.amount))}</TD>
                    <TD>
                      <Button variant="ghost" size="icon" onClick={() => removeDiscount(w.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)}
        title={editCategory ? `Edit category — ${editCategory.name}` : "Add fee category"}>
        <form onSubmit={saveCategory} className="space-y-4">
          <div>
            <Label htmlFor="catname">Category name</Label>
            <Input id="catname" required placeholder="e.g. Tuition, PTA Levy, Uniform" value={categoryForm.name}
              onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="catdesc">Description (optional)</Label>
            <Input id="catdesc" placeholder="Short note about this fee type" value={categoryForm.description}
              onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editCategory ? "Save changes" : "Add category"}
          </Button>
        </form>
      </Dialog>

      <Dialog open={discountDialog} onClose={() => setDiscountDialog(false)} title="Add student discount">
        <form onSubmit={addDiscount} className="space-y-4">
          <p className="text-xs text-muted-foreground">A discount reduces the student&apos;s fee balance for the current term.</p>
          <div>
            <Label htmlFor="dstudent">Student</Label>
            <Select id="dstudent" required value={discountForm.studentId}
              onChange={(e) => setDiscountForm((f) => ({ ...f, studentId: e.target.value }))}>
              <option value="">— Select student —</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="damt">Discount amount (₦)</Label>
            <Input id="damt" type="number" min="1" step="0.01" required value={discountForm.amount}
              onChange={(e) => setDiscountForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="dreason">Reason</Label>
            <Input id="dreason" required placeholder="e.g. Staff child, scholarship, bursary" value={discountForm.reason}
              onChange={(e) => setDiscountForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Apply discount
          </Button>
        </form>
      </Dialog>

      <Dialog open={Boolean(editStructure)} onClose={() => setEditStructure(null)}
        title={editStructure ? `Edit fee — ${editStructure.classRoom.name} / ${editStructure.category.name}` : "Edit fee"}>
        <form onSubmit={saveEditStructure} className="space-y-4">
          <div>
            <Label htmlFor="eamt">Amount (₦)</Label>
            <Input id="eamt" type="number" min="1" step="0.01" required value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </Button>
        </form>
      </Dialog>

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
