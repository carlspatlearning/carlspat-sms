"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";

interface ClassRoom { id: string; name: string }
interface ParentRow { id: string; user: { firstName: string; lastName: string; email: string } }
interface Student {
  id: string;
  firstName: string; lastName: string; middleName: string | null;
  gender: string; dateOfBirth: string; address: string | null;
  status: string; passportUrl: string | null;
  classRoomId: string | null; parentId: string | null;
  bloodGroup: string | null; genotype: string | null;
  allergies: string | null; medicalNotes: string | null; previousSchool: string | null;
  admissionNo: string;
}

export default function EditStudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [admissionNo, setAdmissionNo] = useState("");

  const [form, setForm] = useState({
    firstName: "", lastName: "", middleName: "", gender: "MALE",
    dateOfBirth: "", address: "", classRoomId: "", parentId: "", status: "ACTIVE",
    bloodGroup: "", genotype: "", allergies: "", medicalNotes: "", previousSchool: "",
  });
  const [newParent, setNewParent] = useState({ firstName: "", lastName: "", phone: "", email: "", password: "" });
  const isNewParent = form.parentId === "__new__";

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    api.get<ApiResponse<ClassRoom[]>>("/classes").then((r) => setClasses(r.data)).catch(() => null);
    api.get<ApiResponse<{ items: ParentRow[] }>>("/parents?pageSize=100").then((r) => setParents(r.data.items)).catch(() => null);
    api
      .get<ApiResponse<Student>>(`/students/${id}`)
      .then((r) => {
        const s = r.data;
        setAdmissionNo(s.admissionNo);
        setForm({
          firstName: s.firstName,
          lastName: s.lastName,
          middleName: s.middleName ?? "",
          gender: s.gender,
          dateOfBirth: s.dateOfBirth.slice(0, 10),
          address: s.address ?? "",
          classRoomId: s.classRoomId ?? "",
          parentId: s.parentId ?? "",
          status: s.status,
          bloodGroup: s.bloodGroup ?? "",
          genotype: s.genotype ?? "",
          allergies: s.allergies ?? "",
          medicalNotes: s.medicalNotes ?? "",
          previousSchool: s.previousSchool ?? "",
        });
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let passportUrl: string | undefined;
      if (passportFile) {
        const up = await api.upload<ApiResponse<{ url: string }>>("/uploads/passport", passportFile);
        passportUrl = up.data.url;
      }
      // Create the parent account first when "new parent" was chosen
      let parentId: string | undefined = form.parentId || undefined;
      if (isNewParent) {
        const created = await api.post<ApiResponse<{ id: string }>>("/parents", {
          firstName: newParent.firstName,
          lastName: newParent.lastName,
          email: newParent.email,
          password: newParent.password,
          phone: newParent.phone || undefined,
        });
        parentId = created.data.id;
      }
      await api.put(`/students/${id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName || undefined,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        address: form.address || undefined,
        classRoomId: form.classRoomId || undefined,
        parentId,
        status: form.status,
        bloodGroup: form.bloodGroup || undefined,
        genotype: form.genotype || undefined,
        allergies: form.allergies || undefined,
        medicalNotes: form.medicalNotes || undefined,
        previousSchool: form.previousSchool || undefined,
        ...(passportUrl ? { passportUrl } : {}),
      });
      router.push(`/dashboard/students/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
      setSaving(false);
    }
  }

  if (!loaded && !error) return <p className="text-muted-foreground">Loading student…</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit Student" description={admissionNo} />
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

      {loaded && (
        <form onSubmit={onSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First name *</Label>
                <Input id="firstName" required value={form.firstName} onChange={set("firstName")} />
              </div>
              <div>
                <Label htmlFor="lastName">Last name *</Label>
                <Input id="lastName" required value={form.lastName} onChange={set("lastName")} />
              </div>
              <div>
                <Label htmlFor="middleName">Middle name</Label>
                <Input id="middleName" value={form.middleName} onChange={set("middleName")} />
              </div>
              <div>
                <Label htmlFor="gender">Gender *</Label>
                <Select id="gender" value={form.gender} onChange={set("gender")}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="dob">Date of birth *</Label>
                <Input id="dob" type="date" required value={form.dateOfBirth} onChange={set("dateOfBirth")} />
              </div>
              <div>
                <Label htmlFor="passport">Replace passport photograph</Label>
                <Input id="passport" type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPassportFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Home address</Label>
                <Input id="address" value={form.address} onChange={set("address")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>School Placement & Parent</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="class">Class</Label>
                <Select id="class" value={form.classRoomId} onChange={set("classRoomId")}>
                  <option value="">— No class —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" value={form.status} onChange={set("status")}>
                  {["ACTIVE", "GRADUATED", "TRANSFERRED", "SUSPENDED", "WITHDRAWN"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="parent">Parent / Guardian</Label>
                <Select id="parent" value={form.parentId} onChange={set("parentId")}>
                  <option value="">— No parent linked —</option>
                  <option value="__new__">＋ Register a new parent…</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.user.firstName} {p.user.lastName} ({p.user.email})
                    </option>
                  ))}
                </Select>
              </div>
              {isNewParent && (
                <div className="grid gap-4 rounded-lg border bg-secondary/40 p-4 sm:col-span-2 sm:grid-cols-2">
                  <p className="text-sm font-medium sm:col-span-2">
                    New parent / guardian — they will use the email and password below to log in to the parent portal.
                  </p>
                  <div>
                    <Label htmlFor="npfn">Parent first name *</Label>
                    <Input id="npfn" required value={newParent.firstName}
                      onChange={(e) => setNewParent((p) => ({ ...p, firstName: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="npln">Parent last name *</Label>
                    <Input id="npln" required value={newParent.lastName}
                      onChange={(e) => setNewParent((p) => ({ ...p, lastName: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="npph">Parent phone number *</Label>
                    <Input id="npph" required placeholder="080…" value={newParent.phone}
                      onChange={(e) => setNewParent((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="npem">Parent email (login) *</Label>
                    <Input id="npem" type="email" required value={newParent.email}
                      onChange={(e) => setNewParent((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="nppw">Temporary password *</Label>
                    <Input id="nppw" required minLength={8} value={newParent.password}
                      placeholder="At least 8 characters with a letter and a number"
                      onChange={(e) => setNewParent((p) => ({ ...p, password: e.target.value }))} />
                  </div>
                </div>
              )}
              <div className="sm:col-span-2">
                <Label htmlFor="previousSchool">Previous school (academic history)</Label>
                <Input id="previousSchool" value={form.previousSchool} onChange={set("previousSchool")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Medical Information</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="bloodGroup">Blood group</Label>
                <Select id="bloodGroup" value={form.bloodGroup} onChange={set("bloodGroup")}>
                  <option value="">—</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="genotype">Genotype</Label>
                <Select id="genotype" value={form.genotype} onChange={set("genotype")}>
                  <option value="">—</option>
                  {["AA", "AS", "SS", "AC", "SC"].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="allergies">Allergies</Label>
                <Input id="allergies" value={form.allergies} onChange={set("allergies")} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="medicalNotes">Other medical notes</Label>
                <Textarea id="medicalNotes" value={form.medicalNotes} onChange={set("medicalNotes")} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
