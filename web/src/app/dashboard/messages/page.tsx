"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, MailOpen, Plus } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { cn, formatDate, ROLE_LABELS } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";

interface Person { id: string; firstName: string; lastName: string; role: string }
interface Message {
  id: string;
  subject: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
  sender: Person;
  recipient: Person;
}

export default function MessagesPage() {
  const [box, setBox] = useState<"inbox" | "sent">("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Person[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ recipientId: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    api.get<ApiResponse<Message[]>>(`/messages?box=${box}`).then((r) => setMessages(r.data)).catch((e) => setError(e.message));
  }, [box]);
  useEffect(load, [load]);

  useEffect(() => {
    api.get<ApiResponse<Person[]>>("/messages/contacts").then((r) => setContacts(r.data)).catch(() => null);
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await api.post("/messages", { ...form, subject: form.subject || undefined });
      setDialogOpen(false);
      setForm({ recipientId: "", subject: "", body: "" });
      setBox("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function markRead(m: Message) {
    if (m.readAt || box !== "inbox") return;
    try {
      await api.patch(`/messages/${m.id}/read`);
      setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, readAt: new Date().toISOString() } : x)));
    } catch {
      /* non-critical */
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Messages" description="Direct messages between parents and school staff">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Compose
        </Button>
      </PageHeader>

      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

      <div className="mb-4 flex gap-1 rounded-lg border bg-card p-1">
        {(["inbox", "sent"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBox(b)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium capitalize",
              box === b ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {messages.map((m) => {
          const other = box === "inbox" ? m.sender : m.recipient;
          const unread = box === "inbox" && !m.readAt;
          return (
            <Card key={m.id} className={cn("cursor-pointer", unread && "border-primary/50")} onClick={() => markRead(m)}>
              <CardContent className="flex items-start gap-3 p-4">
                {unread ? <Mail className="mt-1 h-4 w-4 text-primary" /> : <MailOpen className="mt-1 h-4 w-4 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn("truncate text-sm", unread ? "font-bold" : "font-medium")}>
                      {box === "inbox" ? "From" : "To"}: {other.firstName} {other.lastName}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">({ROLE_LABELS[other.role]})</span>
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(m.createdAt)}</span>
                  </div>
                  {m.subject && <p className="text-sm font-medium">{m.subject}</p>}
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{m.body}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {messages.length === 0 && <p className="text-muted-foreground">No messages.</p>}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="New message">
        <form onSubmit={send} className="space-y-4">
          <div>
            <Label htmlFor="mto">To</Label>
            <Select id="mto" required value={form.recipientId} onChange={(e) => setForm((f) => ({ ...f, recipientId: e.target.value }))}>
              <option value="">— Select recipient —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({ROLE_LABELS[c.role]})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="msubject">Subject (optional)</Label>
            <Input id="msubject" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="mbody">Message</Label>
            <Textarea id="mbody" required rows={5} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={sending}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" />} Send
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
