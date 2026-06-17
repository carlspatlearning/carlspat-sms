"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiResponse, Paginated } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Category { id: string; name: string; description?: string }
interface Term { id: string; name: string; session: { name: string } }
interface ExpenseRow {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: Category;
  term: Term | null;
  recordedBy: { firstName: string; lastName: string };
}

function fmt(n: number) {
  return "₦" + Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 });
}

export default function ExpendituresPage() {
  const [expenses, setExpenses] = useState<Paginated<ExpenseRow> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // filters
  const [filterTerm, setFilterTerm] = useState("");
  const [filterCat, setFilterCat] = useState("");

  // add/edit expense
  const [expDialog, setExpDialog] = useState(false);
  const [editExp, setEditExp] = useState<ExpenseRow | null>(null);
  const [expForm, setExpForm] = useState({ categoryId: "", termId: "", amount: "", description: "", date: "" });

  // category management
  const [catDialog, setCatDialog] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: "", description: "" });

  const loadExpenses = useCallback(() => {
    const p = new URLSearchParams({ pageSize: "50" });
    if (filterTerm) p.set("termId", filterTerm);
    if (filterCat) p.set("categoryId", filterCat);
    api.get<ApiResponse<Paginated<ExpenseRow>>>(`/expenses?${p}`)
      .then((r) => setExpenses(r.data)).catch(() => null);
  }, [filterTerm, filterCat]);

  useEffect(loadExpenses, [loadExpenses]);

  useEffect(() => {
    api.get<ApiResponse<Category[]>>("/expenses/categories").then((r) => setCategories(r.data)).catch(() => null);
    api.get<ApiResponse<{ items: Term[] }>>("/settings/terms?pageSize=50")
      .then((r) => setTerms(r.data.items ?? [])).catch(() => null);
  }, []);

  function openAddExp() {
    setEditExp(null);
    const today = new Date().toISOString().slice(0, 10);
    setExpForm({ categoryId: "", termId: "", amount: "", description: "", date: today });
    setExpDialog(true);
  }

  function openEditExp(e: ExpenseRow) {
    setEditExp(e);
    setExpForm({
      categoryId: e.category.id,
      termId: e.term?.id ?? "",
      amount: String(Number(e.amount)),
      description: e.description,
      date: e.date.slice(0, 10),
    });
    setExpDialog(true);
  }

  async function saveExp(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    const payload = {
      categoryId: expForm.categoryId,
      termId: expForm.termId || undefined,
      amount: parseFloat(expForm.amount),
      description: expForm.description,
      date: expForm.date,
    };
    try {
      if (editExp) {
        await api.put(`/expenses/${editExp.id}`, payload);
        setMessage({ type: "success", text: "Expense updated." });
      } else {
        await api.post("/expenses", payload);
        setMessage({ type: "success", text: "Expense recorded." });
      }
      setExpDialog(false);
      loadExpenses();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteExp(id: string) {
    if (!confirm("Delete this expense record?")) return;
    try {
      await api.delete(`/expenses/${id}`);
      setMessage({ type: "success", text: "Expense deleted." });
      loadExpenses();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    }
  }

  function openAddCat() {
    setEditCat(null);
    setCatForm({ name: "", description: "" });
    setCatDialog(true);
  }

  function openEditCat(c: Category) {
    setEditCat(c);
    setCatForm({ name: c.name, description: c.description ?? "" });
    setCatDialog(true);
  }

  async function saveCat(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      if (editCat) {
        await api.put(`/expenses/categories/${editCat.id}`, catForm);
        setMessage({ type: "success", text: "Category updated." });
      } else {
        await api.post("/expenses/categories", catForm);
        setMessage({ type: "success", text: "Category created." });
      }
      setCatDialog(false);
      api.get<ApiResponse<Category[]>>("/expenses/categories").then((r) => setCategories(r.data)).catch(() => null);
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCat(c: Category) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      await api.delete(`/expenses/categories/${c.id}`);
      setMessage({ type: "success", text: "Category deleted." });
      api.get<ApiResponse<Category[]>>("/expenses/categories").then((r) => setCategories(r.data)).catch(() => null);
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed" });
    }
  }

  const total = expenses?.items.reduce((s, e) => s + Number(e.amount), 0) ?? 0;

  return (
    <div>
      <PageHeader title="Expenditures" description="Record and track school expenses">
        <Button variant="outline" onClick={openAddCat}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
        <Button onClick={openAddExp}>
          <Plus className="h-4 w-4" /> Record Expense
        </Button>
      </PageHeader>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      {/* Categories list */}
      {categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-1 rounded-full border bg-secondary/50 px-3 py-1 text-sm">
              <span>{c.name}</span>
              <button onClick={() => openEditCat(c)} className="ml-1 text-muted-foreground hover:text-foreground">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={() => deleteCat(c)} className="text-destructive/60 hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-48">
          <Select value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)}>
            <option value="">All terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {t.session.name}</option>
            ))}
          </Select>
        </div>
        <div className="w-48">
          <Select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        {(expenses?.total ?? 0) > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-lg border bg-secondary/40 px-4 py-1.5 text-sm font-semibold">
            Total shown: <span className="text-primary">{fmt(total)}</span>
          </div>
        )}
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Date</TH>
            <TH>Category</TH>
            <TH>Description</TH>
            <TH className="hidden md:table-cell">Term</TH>
            <TH className="text-right">Amount</TH>
            <TH className="hidden sm:table-cell">Recorded by</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {expenses?.items.map((e) => (
            <TR key={e.id}>
              <TD className="text-xs">{formatDate(e.date)}</TD>
              <TD><Badge variant="secondary">{e.category.name}</Badge></TD>
              <TD>{e.description}</TD>
              <TD className="hidden text-xs md:table-cell">
                {e.term ? `${e.term.name} — ${e.term.session.name}` : "—"}
              </TD>
              <TD className="text-right font-medium">{fmt(e.amount)}</TD>
              <TD className="hidden text-xs sm:table-cell">
                {e.recordedBy.firstName} {e.recordedBy.lastName}
              </TD>
              <TD className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEditExp(e)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteExp(e.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
          {!expenses?.items.length && (
            <TR><TD colSpan={7} className="text-center text-muted-foreground py-8">No expenses recorded yet.</TD></TR>
          )}
        </TBody>
      </Table>

      {/* Add/Edit Expense dialog */}
      <Dialog open={expDialog} onClose={() => setExpDialog(false)} title={editExp ? "Edit expense" : "Record expense"}>
        <form onSubmit={saveExp} className="space-y-4">
          <div>
            <Label htmlFor="ecat">Category</Label>
            <Select id="ecat" required value={expForm.categoryId}
              onChange={(e) => setExpForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <option value="">— Select category —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="eamt">Amount (₦)</Label>
              <Input id="eamt" type="number" min="1" step="0.01" required value={expForm.amount}
                onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edate">Date</Label>
              <Input id="edate" type="date" required value={expForm.date}
                onChange={(e) => setExpForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="eterm">Term (optional)</Label>
            <Select id="eterm" value={expForm.termId}
              onChange={(e) => setExpForm((f) => ({ ...f, termId: e.target.value }))}>
              <option value="">— General (not term-specific) —</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.session.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="edesc">Description</Label>
            <Input id="edesc" required placeholder="e.g. Chalk and board markers" value={expForm.description}
              onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editExp ? "Save changes" : "Record expense"}
          </Button>
        </form>
      </Dialog>

      {/* Add/Edit Category dialog */}
      <Dialog open={catDialog} onClose={() => setCatDialog(false)} title={editCat ? "Edit category" : "Add expense category"}>
        <form onSubmit={saveCat} className="space-y-4">
          <div>
            <Label htmlFor="cname">Category name</Label>
            <Input id="cname" required placeholder="e.g. Stationery, Utilities, Salary" value={catForm.name}
              onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="cdesc">Description (optional)</Label>
            <Input id="cdesc" value={catForm.description}
              onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editCat ? "Save changes" : "Create category"}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
