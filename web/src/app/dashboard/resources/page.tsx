"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { getUser, getAccessToken } from "@/lib/auth";
import { api, ApiResponse, API_URL } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string;
  classRoomId: string | null;
  uploadedById: string;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string };
  classRoom: { id: string; name: string } | null;
}

interface ClassRoom {
  id: string;
  name: string;
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  ASSIGNMENT: "Assignment",
  LESSON_NOTE: "Lesson Note",
  PAST_QUESTION: "Past Question",
  SCHEME_OF_WORK: "Scheme of Work",
  OTHER: "Other",
};

const TYPE_BADGE_VARIANT: Record<string, "default" | "secondary" | "success" | "warning"> = {
  ASSIGNMENT: "default",
  LESSON_NOTE: "success",
  PAST_QUESTION: "secondary",
  SCHEME_OF_WORK: "warning",
  OTHER: "secondary",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResourcesPage() {
  const user = getUser();
  const canUpload = user && ["SUPER_ADMIN", "ADMIN", "TEACHER"].includes(user.role);
  const canDelete = canUpload;
  const isParentOrStudent = user && ["PARENT", "STUDENT"].includes(user.role);

  const [resources, setResources] = useState<Resource[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [filterClass, setFilterClass] = useState("");
  const [filterType, setFilterType] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", type: "ASSIGNMENT", classRoomId: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filterClass) params.set("classId", filterClass);
    if (filterType) params.set("type", filterType);
    api
      .get<ApiResponse<Resource[]>>(`/resources?${params}`)
      .then((r) => setResources(r.data))
      .catch(() => null);
  }, [filterClass, filterType]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isParentOrStudent) {
      api.get<ApiResponse<ClassRoom[]>>("/classes").then((r) => setClasses(r.data)).catch(() => null);
    }
  }, [isParentOrStudent]);

  async function uploadResource(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setMessage({ type: "destructive", text: "Please select a file to upload" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", form.title);
      formData.append("type", form.type);
      if (form.description) formData.append("description", form.description);
      if (form.classRoomId) formData.append("classRoomId", form.classRoomId);

      const token = getAccessToken();
      const res = await fetch(`${API_URL}/resources`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Upload failed (${res.status})`);
      }

      setDialogOpen(false);
      setForm({ title: "", description: "", type: "ASSIGNMENT", classRoomId: "" });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage({ type: "success", text: "Resource uploaded successfully." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function deleteResource(r: Resource) {
    if (!confirm(`Delete "${r.title}"?`)) return;
    try {
      await api.delete(`/resources/${r.id}`);
      setMessage({ type: "success", text: "Resource deleted." });
      load();
    } catch (err) {
      setMessage({ type: "destructive", text: err instanceof Error ? err.message : "Failed to delete" });
    }
  }

  function downloadResource(r: Resource) {
    const a = document.createElement("a");
    a.href = r.fileUrl;
    a.download = r.fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  return (
    <div>
      <PageHeader title="Resources" description="Assignments, lesson notes and other learning materials">
        {canUpload && (
          <Button onClick={() => setDialogOpen(true)}>
            <UploadCloud className="h-4 w-4" /> Upload Resource
          </Button>
        )}
      </PageHeader>

      {message && (
        <Alert variant={message.type} className="mb-4">
          {message.text}
        </Alert>
      )}

      {/* Filters — only for staff who can filter by class */}
      {!isParentOrStudent && (
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="w-48">
            <Select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All types</option>
              {Object.entries(RESOURCE_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">No resources yet</p>
          {canUpload && (
            <p className="mt-1 text-xs text-muted-foreground">
              Upload assignments or lesson notes for parents to download.
            </p>
          )}
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Title</TH>
              <TH>Type</TH>
              <TH className="hidden md:table-cell">Class</TH>
              <TH className="hidden lg:table-cell">Uploaded by</TH>
              <TH className="hidden lg:table-cell">Date</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {resources.map((r) => (
              <TR key={r.id}>
                <TD>
                  <span className="font-medium">{r.title}</span>
                  {r.description && (
                    <span className="block text-xs text-muted-foreground">{r.description}</span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {r.fileName}{r.fileSize ? ` · ${formatBytes(r.fileSize)}` : ""}
                  </span>
                </TD>
                <TD>
                  <Badge variant={TYPE_BADGE_VARIANT[r.type] ?? "secondary"}>
                    {RESOURCE_TYPE_LABELS[r.type] ?? r.type}
                  </Badge>
                </TD>
                <TD className="hidden text-sm md:table-cell">
                  {r.classRoom ? r.classRoom.name : <span className="text-muted-foreground">All classes</span>}
                </TD>
                <TD className="hidden text-sm lg:table-cell">
                  {r.uploadedBy.firstName} {r.uploadedBy.lastName}
                </TD>
                <TD className="hidden text-xs lg:table-cell">{formatDate(r.createdAt)}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => downloadResource(r)}>
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                    {canDelete && (user?.role !== "TEACHER" || r.uploadedById === user?.id) && (
                      <Button variant="outline" size="sm" onClick={() => deleteResource(r)} aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Upload Resource">
        <form onSubmit={uploadResource} className="space-y-4">
          <div>
            <Label htmlFor="rtitle">Title</Label>
            <Input
              id="rtitle"
              required
              placeholder="e.g. Week 3 Assignment — Mathematics"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rtype">Type</Label>
              <Select
                id="rtype"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {Object.entries(RESOURCE_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rclass">Class (optional)</Label>
              <Select
                id="rclass"
                value={form.classRoomId}
                onChange={(e) => setForm((f) => ({ ...f, classRoomId: e.target.value }))}
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="rdesc">Description (optional)</Label>
            <Input
              id="rdesc"
              placeholder="Brief description of the resource"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="rfile">File (PDF or Word document, max 10 MB)</Label>
            <input
              ref={fileInputRef}
              id="rfile"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              required
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-medium"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            {selectedFile && (
              <p className="mt-1 text-xs text-muted-foreground">
                Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload Resource"}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
