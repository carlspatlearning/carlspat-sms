"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { formatDate, formatNaira } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface Session { id: string; name: string; isCurrent: boolean }
interface Candidate {
  id: string; firstName: string; lastName: string; exam: string; amountPaid: string | number; amountDue: string | number; services: string[];
  applicationData: Record<string,any>; passportUrl?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED"; decisionNote: string | null; createdAt: string;
  session: { name: string };
}
interface ServicePrice { id:string; name:string; exam:string|null; amount:string|number; isActive:boolean }
interface Context { stakeholder: { id: string; name: string; representativeName: string; school: { name: string } }; sessions: Session[]; servicePrices:ServicePrice[] }
const initial = { firstName: "", lastName: "", gender: "", dateOfBirth: "", exam: "WAEC", sessionId: "", servicePriceIds: [] as string[], applicationData:{otherNames:"",nationalId:"",nationality:"Nigerian",stateOfOrigin:"",phone:"",email:"",address:"",city:"",residentialState:"",subjects:[{subject:"Mathematics",cass1:"",cass2:"",cass3:"",signature:""},{subject:"English Language",cass1:"",cass2:"",cass3:"",signature:""}] as {subject:string;cass1:string;cass2:string;cass3:string;signature:string}[]} };
const examLabel = (exam: string) => exam === "COMMON_ENTRANCE" ? "Common Entrance" : exam.replaceAll("_", " & ");
const statusVariant = (status: string) => status === "APPROVED" ? "success" : status === "REJECTED" ? "destructive" : "warning";
const paymentLabel = (paid:number|string,due:number|string) => Number(due)<=0 ? "Not priced" : Number(paid)<=0 ? "Unpaid" : Number(paid)>=Number(due) ? "Paid" : "Part-paid";

export default function StakeholderRegistrationsPage() {
  const [context, setContext] = useState<Context | null>(null);
  const [items, setItems] = useState<Candidate[]>([]);
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [passportFile,setPassportFile]=useState<File|null>(null);

  const load = useCallback(async () => {
    try {
      const [ctx, rows] = await Promise.all([
        api.get<ApiResponse<Context>>("/stakeholders/me/context"),
        api.get<ApiResponse<Candidate[]>>("/stakeholders/me/registrations"),
      ]);
      setContext(ctx.data); setItems(rows.data); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load registrations.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(null); setNotice(null);
    try {
      let passportUrl:string|undefined;
      if(passportFile){const upload=await api.upload<ApiResponse<{url:string}>>("/uploads/passport",passportFile);passportUrl=upload.data.url;}
      await api.post("/stakeholders/me/registrations", {
        firstName: form.firstName, lastName: form.lastName,
        gender: form.gender || undefined, dateOfBirth: form.dateOfBirth || undefined,
        exam: form.exam, sessionId: form.sessionId, servicePriceIds: form.servicePriceIds,passportUrl,applicationData:form.applicationData,
      });
      setOpen(false); setForm(initial);setPassportFile(null); setNotice("Student application submitted to the host school for review."); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit this student.");
    } finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-6xl">
    <PageHeader title="Student Exam Registrations" description={context ? `${context.stakeholder.name} · Host school: ${context.stakeholder.school.name}` : "Submit candidates and track the host school's review."}>
      <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4"/> Refresh status</Button>
      <Button onClick={() => setOpen(true)} disabled={!context?.sessions.length}><Plus className="h-4 w-4"/> Register Student</Button>
    </PageHeader>
    {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
    {notice && <Alert variant="success" className="mb-4">{notice}</Alert>}
    {!loading && context?.sessions.length === 0 && <Alert variant="warning" className="mb-4">The host school has not set up an academic session yet. Contact them before submitting candidates.</Alert>}
    {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin"/></div> : (
      <Table><THead><TR><TH>Student</TH><TH>Examination</TH><TH>Additional services</TH><TH>Session</TH><TH>Amount due</TH><TH>Paid</TH><TH>Payment status</TH><TH>Submitted</TH><TH>Registration status</TH></TR></THead><TBody>
        {items.map((item) => <TR key={item.id}><TD className="font-medium">{item.firstName} {item.lastName}</TD><TD>{examLabel(item.exam)}</TD><TD>{item.services?.join(", ") || "—"}</TD><TD>{item.session.name}</TD><TD>{formatNaira(Number(item.amountDue))}</TD><TD>{formatNaira(Number(item.amountPaid))}</TD><TD><Badge variant={paymentLabel(item.amountPaid,item.amountDue)==="Paid"?"success":paymentLabel(item.amountPaid,item.amountDue)==="Unpaid"?"warning":"outline"}>{paymentLabel(item.amountPaid,item.amountDue)}</Badge></TD><TD>{formatDate(item.createdAt)}</TD><TD><Badge variant={statusVariant(item.status)}>{item.status}</Badge>{item.decisionNote && <span className="block max-w-64 text-xs text-muted-foreground">{item.decisionNote}</span>}</TD></TR>)}
        {!items.length && <TR><TD colSpan={9} className="py-12 text-center text-muted-foreground">No student registrations yet. Choose Register Student to submit the first candidate.</TD></TR>}
      </TBody></Table>
    )}
    <p className="mt-3 text-xs text-muted-foreground">Registration statuses refresh automatically every 30 seconds while this page is open.</p>

    <Dialog open={open} onClose={() => setOpen(false)} title="Register a student for an examination">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="candidate-first">First name</Label><Input id="candidate-first" required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}/></div>
          <div><Label htmlFor="candidate-last">Last name</Label><Input id="candidate-last" required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}/></div>
        </div>
        <div><Label htmlFor="candidate-other">Other name(s)</Label><Input id="candidate-other" value={form.applicationData.otherNames} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,otherNames:e.target.value}}))}/></div>
        <div><Label htmlFor="candidate-exam">Examination</Label><Select id="candidate-exam" value={form.exam} onChange={(e) => setForm((f) => ({ ...f, exam: e.target.value }))}><option value="WAEC">WAEC</option><option value="NECO">NECO</option><option value="JAMB">JAMB</option><option value="BECE">BECE</option><option value="CASS">CASS</option><option value="COMMON_ENTRANCE">Common Entrance</option><option value="WAEC_NECO">WAEC & NECO</option><option value="WAEC_NECO_JAMB">WAEC, NECO & JAMB</option></Select></div>
        <div><Label htmlFor="candidate-session">Academic session</Label><Select id="candidate-session" required value={form.sessionId} onChange={(e) => setForm((f) => ({ ...f, sessionId: e.target.value }))}><option value="">Select a session</option>{context?.sessions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>)}</Select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="candidate-gender">Gender</Label><Select id="candidate-gender" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}><option value="">Choose</option><option value="FEMALE">Female</option><option value="MALE">Male</option></Select></div>
          <div><Label htmlFor="candidate-dob">Date of birth</Label><Input id="candidate-dob" type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="candidate-nin">NIN</Label><Input id="candidate-nin" value={form.applicationData.nationalId} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,nationalId:e.target.value}}))}/></div>
          <div><Label htmlFor="candidate-nationality">Nationality</Label><Input id="candidate-nationality" value={form.applicationData.nationality} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,nationality:e.target.value}}))}/></div>
          <div><Label htmlFor="candidate-origin">State of origin</Label><Input id="candidate-origin" value={form.applicationData.stateOfOrigin} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,stateOfOrigin:e.target.value}}))}/></div>
          <div><Label htmlFor="candidate-phone">Telephone</Label><Input id="candidate-phone" value={form.applicationData.phone} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,phone:e.target.value}}))}/></div>
          <div><Label htmlFor="candidate-email">Email</Label><Input id="candidate-email" type="email" value={form.applicationData.email} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,email:e.target.value}}))}/></div>
          <div><Label htmlFor="candidate-photo">Candidate photograph</Label><Input id="candidate-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPassportFile(e.target.files?.[0]||null)}/></div>
          <div className="col-span-2"><Label htmlFor="candidate-address">Residential address</Label><Input id="candidate-address" value={form.applicationData.address} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,address:e.target.value}}))}/></div>
          <div><Label htmlFor="candidate-city">City</Label><Input id="candidate-city" value={form.applicationData.city} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,city:e.target.value}}))}/></div>
          <div><Label htmlFor="candidate-state">Residential state</Label><Input id="candidate-state" value={form.applicationData.residentialState} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,residentialState:e.target.value}}))}/></div>
        </div>
        <section className="space-y-2 rounded-md border p-3"><div className="flex items-center justify-between"><Label>Examination subjects and CASS scores</Label><Button type="button" variant="outline" size="sm" onClick={()=>setForm(f=>({...f,applicationData:{...f.applicationData,subjects:[...f.applicationData.subjects,{subject:"",cass1:"",cass2:"",cass3:"",signature:""}]}}))}>Add subject</Button></div>{form.applicationData.subjects.map((row,index)=><div key={index} className="grid grid-cols-2 gap-2 border-t pt-2 md:grid-cols-5"><Input aria-label={`Subject ${index+1}`} placeholder="Subject" value={row.subject} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,subjects:f.applicationData.subjects.map((x,i)=>i===index?{...x,subject:e.target.value}:x)}}))}/><Input aria-label="CASS 1" placeholder="CASS 1" value={row.cass1} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,subjects:f.applicationData.subjects.map((x,i)=>i===index?{...x,cass1:e.target.value}:x)}}))}/><Input aria-label="CASS 2" placeholder="CASS 2" value={row.cass2} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,subjects:f.applicationData.subjects.map((x,i)=>i===index?{...x,cass2:e.target.value}:x)}}))}/><Input aria-label="CASS 3" placeholder="CASS 3" value={row.cass3} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,subjects:f.applicationData.subjects.map((x,i)=>i===index?{...x,cass3:e.target.value}:x)}}))}/><Input aria-label="Student signature" placeholder="Signature / name" value={row.signature} onChange={e=>setForm(f=>({...f,applicationData:{...f.applicationData,subjects:f.applicationData.subjects.map((x,i)=>i===index?{...x,signature:e.target.value}:x)}}))}/></div>)}</section>
        <div className="space-y-2"><Label>Additional services</Label>{context?.servicePrices.filter((price)=>!price.exam).length ? context.servicePrices.filter((price)=>!price.exam).map((price)=><label key={price.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.servicePriceIds.includes(price.id)} onChange={(e)=>setForm((f)=>({...f,servicePriceIds:e.target.checked?[...f.servicePriceIds,price.id]:f.servicePriceIds.filter((id)=>id!==price.id)}))}/>{price.name} · {formatNaira(Number(price.amount))}</label>) : <p className="text-xs text-muted-foreground">No additional services are offered.</p>}</div>
        <p className="text-xs text-muted-foreground">The host school sets exam prices, confirms payments, and updates your payment status here.</p>
        <Button type="submit" className="w-full" disabled={saving || !context?.sessions.length}>{saving && <Loader2 className="h-4 w-4 animate-spin"/>} Submit for host-school review</Button>
      </form>
    </Dialog>
  </div>;
}
