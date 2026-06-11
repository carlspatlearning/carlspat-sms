"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function NewStudentPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [passportFile, setPassportFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", middleName: "", gender: "MALE",
    dateOfBirth: "", address: "", classRoomId: "", parentId: "",
    bloodGroup: "", genotype: "", allergies: "", medicalNotes: "", previousSchool: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    api.get<ApiResponse<ClassRoom[]>>("/classes").then((r) => setClasses(r.data)).catch(() => null);
    api
      .get<ApiResponse<{ items: ParentRow[] }>>("/parents?pageSize=100")
      .then((r) => setParents(r.data.items))
      .catch(() => null);
  }, []);

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
      const payload = {
        ...Object.fromEntries(Object.entries(form).filter(([, v]) => v !== "")),
        ...(passportUrl ? { passportUrl } : {}),
      };
      const res = await api.post<ApiResponse<{ id: string; admissionNo: string }>>("/students", payload);
      router.push(`/dashboard/students/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register student");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Register Student"
        description="The admission number is generated automatically (CPS/year/0001)."
      />
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

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
              <Label htmlFor="passport">Passport photograph</Label>
              <Input
                id="passport"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setPassportFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">Home address</Label>
              <Input id="address" value={form.address} onChange={set("address")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>School Placement</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="class">Class</Label>
              <Select id="class" value={form.classRoomId} onChange={set("classRoomId")}>
                <option value="">— Select class —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="parent">Parent / Guardian</Label>
              <Select id="parent" value={form.parentId} onChange={set("parentId")}>
                <option value="">— Select parent —</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.user.firstName} {p.user.lastName} ({p.user.email})
                  </option>
                ))}
              </Select>
            </div>
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
            {saving ? "Registering…" : "Register Student"}
          </Button>
        </div>
      </form>
    </div>
  );
}
