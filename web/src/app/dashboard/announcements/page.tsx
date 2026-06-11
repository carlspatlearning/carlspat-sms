"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string;
  createdBy: { firstName: string; lastName: string; role: string };
}

export default function AnnouncementsPage() {
  const user = getUser();
  const isAdmin = user && ["SUPER_ADMIN", "ADMIN"].includes(user.role);
  const [items, setItems] = useState<Announcement[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [form, setForm] = useState({ title: "", body: "", audience: "ALL", notifyByEmail: false, notifyBySms: false });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get<ApiResponse<Announcement[]>>("/announcements").then((r) => setItems(r.data)).catch(() => null);
  }, []);
  useEffect(load, [load]);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/announcements", form);
      setDialogOpen(false);
      setForm({ title: "", body: "", audience: "ALL", notifyByEmail: false, notifyBySms: false });
      setMessage({ type: "success", text: "Announcement published." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to publish" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    try {
      await api.delete(`/announcements/${id}`);
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to delete" });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Announcements" description="School news and event notifications">
        {isAdmin && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New Announcement
          </Button>
        )}
      </PageHeader>

      {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}

      <div className="space-y-3">
        {items.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{a.title}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(a.publishedAt)} · {a.createdBy.firstName} {a.createdBy.lastName}
                      <Badge variant="secondary" className="ml-2">{a.audience}</Badge>
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => remove(a.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-muted-foreground">No announcements yet.</p>}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Publish announcement">
        <form onSubmit={publish} className="space-y-4">
          <div>
            <Label htmlFor="atitle">Title</Label>
            <Input id="atitle" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="abody">Message</Label>
            <Textarea id="abody" required rows={5} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="aaud">Audience</Label>
            <Select id="aaud" value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}>
              <option value="ALL">Everyone</option>
              <option value="TEACHERS">Teachers</option>
              <option value="PARENTS">Parents</option>
              <option value="STUDENTS">Students</option>
              <option value="STAFF">All staff</option>
            </Select>
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.notifyByEmail} onChange={(e) => setForm((f) => ({ ...f, notifyByEmail: e.target.checked }))} />
              Also send email
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.notifyBySms} onChange={(e) => setForm((f) => ({ ...f, notifyBySms: e.target.checked }))} />
              Also send SMS
            </label>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Publish
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
