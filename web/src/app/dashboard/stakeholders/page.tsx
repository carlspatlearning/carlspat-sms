"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, School } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { formatDate, formatNaira } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface Partner {
  id: string; name: string; representativeName: string; status: "APPROVED" | "INACTIVE"; createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; isActive: boolean };
  _count: { registrations: number };
}
interface Candidate {
  id: string; firstName: string; lastName: string; exam: string; amountPaid: string | number; amountDue:string|number; services:string[];
  gender?:string|null;dateOfBirth?:string|null;passportUrl?:string|null;applicationData:Record<string,any>;
  status: "PENDING" | "APPROVED" | "REJECTED"; decisionNote: string | null; createdAt: string;
  stakeholderSchool: { name: string }; session: { name: string };
}
interface Price { id:string; name:string; exam:string|null; amount:string|number; isActive:boolean }

const blankForm = { name: "", representativeName: "", email: "", phone: "", password: "" };
const statusVariant = (status: string) => status === "APPROVED" ? "success" : status === "REJECTED" || status === "INACTIVE" ? "destructive" : "warning";
const examLabel = (exam: string) => exam === "COMMON_ENTRANCE" ? "Common Entrance" : exam.replaceAll("_", " & ");
const paymentLabel = (paid:number|string,due:number|string) => Number(due)<=0 ? "Not priced" : Number(paid)<=0 ? "Unpaid" : Number(paid)>=Number(due) ? "Paid" : "Part-paid";

export default function StakeholdersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [tab, setTab] = useState<"partners" | "registrations" | "prices">("partners");
  const [priceExam,setPriceExam]=useState("WAEC"),[priceAmount,setPriceAmount]=useState(""),[serviceName,setServiceName]=useState(""),[serviceAmount,setServiceAmount]=useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [candidateDraft,setCandidateDraft]=useState<any>(null);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "destructive"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, pr] = await Promise.all([
        api.get<ApiResponse<Partner[]>>("/stakeholders"),
        api.get<ApiResponse<Candidate[]>>("/stakeholders/registrations"),
        api.get<ApiResponse<Price[]>>("/stakeholders/service-prices"),
      ]);
      setPartners(p.data);
      setCandidates(r.data);
      setPrices(pr.data);
    } catch (e) {
      setMessage({ type: "destructive", text: e instanceof Error ? e.message : "Could not load stakeholder records." });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function createPartner(e: FormEvent) {
    e.preventDefault(); setSaving(true); setMessage(null);
    try {
      await api.post("/stakeholders", { ...form, phone: form.phone || undefined });
      setDialogOpen(false); setForm(blankForm);
      setMessage({ type: "success", text: "Stakeholder school and login created. Share the login details with its representative." });
      await load();
    } catch (e) {
      setMessage({ type: "destructive", text: e instanceof Error ? e.message : "Could not create stakeholder account." });
    } finally { setSaving(false); }
  }

  async function review(item: Candidate, status: "APPROVED" | "REJECTED") {
    const decisionNote = window.prompt(status === "APPROVED" ? "Optional approval note:" : "Reason for rejection (optional):");
    if (decisionNote === null) return;
    try {
      await api.patch(`/stakeholders/registrations/${item.id}/review`, { status, decisionNote: decisionNote || undefined });
      setMessage({ type: "success", text: `Registration ${status.toLowerCase()}.` });
      await load();
    } catch (e) {
      setMessage({ type: "destructive", text: e instanceof Error ? e.message : "Could not update registration." });
    }
  }

  async function togglePartner(partner: Partner) {
    const status = partner.status === "APPROVED" ? "INACTIVE" : "APPROVED";
    try {
      await api.patch(`/stakeholders/${partner.id}/status`, { status });
      setMessage({ type: "success", text: `Stakeholder account ${status.toLowerCase()}.` });
      await load();
    } catch (e) {
      setMessage({ type: "destructive", text: e instanceof Error ? e.message : "Could not update stakeholder account." });
    }
  }

  async function saveExamPrice(e:FormEvent){e.preventDefault();setSaving(true);try{const existing=prices.find(p=>p.exam===priceExam);if(existing)await api.patch(`/stakeholders/service-prices/${existing.id}`,{amount:Number(priceAmount),isActive:true});else await api.post("/stakeholders/service-prices",{kind:"EXAM",exam:priceExam,amount:Number(priceAmount)});setPriceAmount("");setMessage({type:"success",text:"Exam price saved."});await load()}catch(e){setMessage({type:"destructive",text:e instanceof Error?e.message:"Could not save exam price."})}finally{setSaving(false)}}
  async function addService(e:FormEvent){e.preventDefault();setSaving(true);try{await api.post("/stakeholders/service-prices",{kind:"SERVICE",name:serviceName,amount:Number(serviceAmount)});setServiceName("");setServiceAmount("");setMessage({type:"success",text:"Additional service price added."});await load()}catch(e){setMessage({type:"destructive",text:e instanceof Error?e.message:"Could not add service."})}finally{setSaving(false)}}
  async function updatePrice(price:Price){const name=price.exam?price.name:window.prompt("Service name:",price.name);if(name===null)return;const amount=window.prompt("Price amount (₦):",String(price.amount));if(amount===null)return;if(!Number.isFinite(Number(amount))||Number(amount)<0){setMessage({type:"destructive",text:"Enter a valid non-negative price."});return}try{await api.patch(`/stakeholders/service-prices/${price.id}`,{name,amount:Number(amount)});await load()}catch(e){setMessage({type:"destructive",text:e instanceof Error?e.message:"Could not update price."})}}
  async function togglePrice(price:Price){try{await api.patch(`/stakeholders/service-prices/${price.id}`,{isActive:!price.isActive});await load()}catch(e){setMessage({type:"destructive",text:e instanceof Error?e.message:"Could not change price availability."})}}
  async function updatePayment(item:Candidate){const due=window.prompt("Total amount due (₦):",String(item.amountDue));if(due===null)return;const paid=window.prompt("Amount received by the host school (₦):",String(item.amountPaid));if(paid===null)return;if(!Number.isFinite(Number(due))||!Number.isFinite(Number(paid))||Number(due)<0||Number(paid)<0){setMessage({type:"destructive",text:"Enter valid non-negative payment amounts."});return}try{await api.patch(`/stakeholders/registrations/${item.id}/payment`,{amountDue:Number(due),amountPaid:Number(paid)});setMessage({type:"success",text:"Payment status updated."});await load()}catch(e){setMessage({type:"destructive",text:e instanceof Error?e.message:"Could not update payment."})}}
  function editCandidate(item:Candidate){setCandidateDraft({id:item.id,firstName:item.firstName,lastName:item.lastName,gender:item.gender||"",dateOfBirth:item.dateOfBirth?.slice(0,10)||"",exam:item.exam,passportUrl:item.passportUrl||"",applicationData:{otherNames:"",nationalId:"",nationality:"",stateOfOrigin:"",phone:"",email:"",address:"",city:"",residentialState:"",subjects:[],...(item.applicationData||{})}})}
  function setCandidateData(key:string,value:any){setCandidateDraft((d:any)=>({...d,applicationData:{...d.applicationData,[key]:value}}))}
  async function saveCandidate(e:FormEvent){e.preventDefault();if(!candidateDraft)return;setSaving(true);try{const {id,...body}=candidateDraft;await api.patch(`/stakeholders/registrations/${id}`,{...body,gender:body.gender||undefined,dateOfBirth:body.dateOfBirth||undefined});setCandidateDraft(null);setMessage({type:"success",text:"Candidate application record updated."});await load()}catch(e){setMessage({type:"destructive",text:e instanceof Error?e.message:"Could not update candidate record."})}finally{setSaving(false)}}

  return <div className="mx-auto max-w-6xl">
    <PageHeader title="Stakeholder Schools" description="Create partner logins, configure exam and service prices, review candidate applications, and track payments.">
      <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4"/> Refresh</Button>
      <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4"/> Add Stakeholder School</Button>
    </PageHeader>
    {message && <Alert variant={message.type} className="mb-4">{message.text}</Alert>}
    <div className="mb-4 flex gap-1 rounded-lg border bg-card p-1">
      {(["partners", "registrations", "prices"] as const).map((key) => <button key={key} onClick={() => setTab(key)} className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>{key === "partners" ? `Partner schools (${partners.length})` : key === "registrations" ? `Student registrations (${candidates.length})` : "Exam & service prices"}</button>)}
    </div>

    {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin"/></div> : tab === "partners" ? (
      <Table><THead><TR><TH>Partner School</TH><TH>Representative</TH><TH>Login</TH><TH>Students</TH><TH>Status</TH><TH></TH></TR></THead><TBody>
        {partners.map((p) => <TR key={p.id}><TD><span className="font-medium">{p.name}</span><span className="block text-xs text-muted-foreground">Added {formatDate(p.createdAt)}</span></TD><TD>{p.representativeName}</TD><TD>{p.user.email}</TD><TD>{p._count.registrations}</TD><TD><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TD><TD className="text-right"><Button variant="outline" size="sm" onClick={() => void togglePartner(p)}>{p.status === "APPROVED" ? "Deactivate" : "Reactivate"}</Button></TD></TR>)}
        {!partners.length && <TR><TD colSpan={6} className="py-12 text-center text-muted-foreground"><School className="mx-auto mb-2 h-6 w-6"/>No stakeholder schools yet.</TD></TR>}
      </TBody></Table>
    ) : tab === "registrations" ? (
      <Table><THead><TR><TH>Candidate</TH><TH>Stakeholder school</TH><TH>Exam / services</TH><TH>Session</TH><TH>Amount due</TH><TH>Amount paid</TH><TH>Payment status</TH><TH>Submitted</TH><TH>Registration status</TH><TH>Actions</TH></TR></THead><TBody>
        {candidates.map((item) => <TR key={item.id}><TD className="font-medium">{item.firstName} {item.applicationData?.otherNames} {item.lastName}</TD><TD>{item.stakeholderSchool.name}</TD><TD>{examLabel(item.exam)}{item.services?.length>0&&<span className="block text-xs text-muted-foreground">{item.services.join(", ")}</span>}</TD><TD>{item.session.name}</TD><TD>{formatNaira(Number(item.amountDue))}</TD><TD>{formatNaira(Number(item.amountPaid))}</TD><TD><Badge variant={paymentLabel(item.amountPaid,item.amountDue)==="Paid"?"success":paymentLabel(item.amountPaid,item.amountDue)==="Unpaid"?"warning":"outline"}>{paymentLabel(item.amountPaid,item.amountDue)}</Badge></TD><TD>{formatDate(item.createdAt)}</TD><TD><Badge variant={statusVariant(item.status)}>{item.status}</Badge>{item.decisionNote && <span className="block max-w-40 truncate text-xs text-muted-foreground" title={item.decisionNote}>{item.decisionNote}</span>}</TD><TD><div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={()=>editCandidate(item)}>View / update record</Button><Button size="sm" variant="outline" onClick={()=>void updatePayment(item)}>Update payment</Button>{item.status === "PENDING" && <><Button size="sm" onClick={() => void review(item, "APPROVED")}>Approve</Button><Button size="sm" variant="outline" onClick={() => void review(item, "REJECTED")}>Reject</Button></>}</div></TD></TR>)}
        {!candidates.length && <TR><TD colSpan={10} className="py-12 text-center text-muted-foreground">No student registrations received.</TD></TR>}
      </TBody></Table>
    ) : (
      <div className="space-y-5">
        <section className="rounded-lg border bg-card p-4"><h2 className="mb-3 text-lg font-semibold">Set examination prices</h2><form onSubmit={saveExamPrice} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><div><Label htmlFor="exam-price-type">Examination</Label><select id="exam-price-type" className="h-10 w-full rounded-md border bg-background px-3" value={priceExam} onChange={e=>setPriceExam(e.target.value)}>{["WAEC","NECO","JAMB","BECE","CASS","COMMON_ENTRANCE","WAEC_NECO","WAEC_NECO_JAMB"].map(x=><option key={x} value={x}>{examLabel(x)}</option>)}</select></div><div><Label htmlFor="exam-price-amount">Price (₦)</Label><Input id="exam-price-amount" type="number" min="0" step="0.01" required value={priceAmount} placeholder={String(prices.find(p=>p.exam===priceExam)?.amount??"")} onChange={e=>setPriceAmount(e.target.value)}/></div><Button type="submit" disabled={saving} className="self-end">Save exam price</Button></form></section>
        <section className="rounded-lg border bg-card p-4"><h2 className="mb-3 text-lg font-semibold">Add another service</h2><form onSubmit={addService} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><div><Label htmlFor="extra-service-name">Service name</Label><Input id="extra-service-name" required value={serviceName} onChange={e=>setServiceName(e.target.value)} placeholder="Registration processing"/></div><div><Label htmlFor="extra-service-amount">Price (₦)</Label><Input id="extra-service-amount" type="number" min="0" step="0.01" required value={serviceAmount} onChange={e=>setServiceAmount(e.target.value)}/></div><Button type="submit" disabled={saving} className="self-end">Add service</Button></form></section>
        <Table><THead><TR><TH>Exam or service</TH><TH>Price</TH><TH>Availability</TH><TH>Actions</TH></TR></THead><TBody>{prices.map(p=><TR key={p.id}><TD>{p.exam?examLabel(p.exam):p.name}</TD><TD>{formatNaira(Number(p.amount))}</TD><TD>{p.isActive?"Available":"Inactive"}</TD><TD><div className="flex gap-1"><Button size="sm" variant="outline" onClick={()=>void updatePrice(p)}>Edit</Button><Button size="sm" variant="outline" onClick={()=>void togglePrice(p)}>{p.isActive?"Deactivate":"Reactivate"}</Button></div></TD></TR>)}{!prices.length&&<TR><TD colSpan={4} className="py-8 text-center text-muted-foreground">No prices configured.</TD></TR>}</TBody></Table>
      </div>
    )}

    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add stakeholder school">
      <form onSubmit={createPartner} className="space-y-4">
        <p className="text-sm text-muted-foreground">Create the representative’s login for your online school workspace. Share the email and password with them so they can submit candidates and check review decisions.</p>
        <div><Label htmlFor="partner-school">Stakeholder school name</Label><Input id="partner-school" required minLength={2} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}/></div>
        <div><Label htmlFor="partner-representative">Representative full name</Label><Input id="partner-representative" required value={form.representativeName} onChange={(e) => setForm((f) => ({ ...f, representativeName: e.target.value }))}/></div>
        <div><Label htmlFor="partner-email">Login email</Label><Input id="partner-email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}/></div>
        <div><Label htmlFor="partner-phone">Phone</Label><Input id="partner-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}/></div>
        <div><Label htmlFor="partner-password">Temporary password</Label><Input id="partner-password" type="password" required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}/></div>
        <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin"/>} Create stakeholder login</Button>
      </form>
    </Dialog>
    <Dialog open={Boolean(candidateDraft)} onClose={() => setCandidateDraft(null)} title="Review and update candidate record">
      {candidateDraft&&<form onSubmit={saveCandidate} className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
        <p className="text-sm text-muted-foreground">This record stays linked to its stakeholder school and can be corrected after approval.</p>
        {candidateDraft.passportUrl&&<img src={candidateDraft.passportUrl} alt="Candidate passport photograph" className="h-24 w-20 rounded border object-cover"/>}
        <div className="grid grid-cols-2 gap-3"><div><Label>First name</Label><Input required value={candidateDraft.firstName} onChange={e=>setCandidateDraft((d:any)=>({...d,firstName:e.target.value}))}/></div><div><Label>Surname</Label><Input required value={candidateDraft.lastName} onChange={e=>setCandidateDraft((d:any)=>({...d,lastName:e.target.value}))}/></div><div><Label>Other name(s)</Label><Input value={candidateDraft.applicationData.otherNames||""} onChange={e=>setCandidateData("otherNames",e.target.value)}/></div><div><Label>Examination</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={candidateDraft.exam} onChange={e=>setCandidateDraft((d:any)=>({...d,exam:e.target.value}))}>{["WAEC","NECO","JAMB","BECE","CASS","COMMON_ENTRANCE","WAEC_NECO","WAEC_NECO_JAMB"].map(x=><option key={x} value={x}>{examLabel(x)}</option>)}</select></div><div><Label>Gender</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={candidateDraft.gender} onChange={e=>setCandidateDraft((d:any)=>({...d,gender:e.target.value}))}><option value="">Not provided</option><option value="FEMALE">Female</option><option value="MALE">Male</option></select></div><div><Label>Date of birth</Label><Input type="date" value={candidateDraft.dateOfBirth} onChange={e=>setCandidateDraft((d:any)=>({...d,dateOfBirth:e.target.value}))}/></div><div><Label>NIN</Label><Input value={candidateDraft.applicationData.nationalId||""} onChange={e=>setCandidateData("nationalId",e.target.value)}/></div><div><Label>Nationality</Label><Input value={candidateDraft.applicationData.nationality||""} onChange={e=>setCandidateData("nationality",e.target.value)}/></div><div><Label>State of origin</Label><Input value={candidateDraft.applicationData.stateOfOrigin||""} onChange={e=>setCandidateData("stateOfOrigin",e.target.value)}/></div><div><Label>Telephone</Label><Input value={candidateDraft.applicationData.phone||""} onChange={e=>setCandidateData("phone",e.target.value)}/></div><div><Label>Email</Label><Input type="email" value={candidateDraft.applicationData.email||""} onChange={e=>setCandidateData("email",e.target.value)}/></div><div><Label>City</Label><Input value={candidateDraft.applicationData.city||""} onChange={e=>setCandidateData("city",e.target.value)}/></div><div className="col-span-2"><Label>Residential address</Label><Input value={candidateDraft.applicationData.address||""} onChange={e=>setCandidateData("address",e.target.value)}/></div><div><Label>Residential state</Label><Input value={candidateDraft.applicationData.residentialState||""} onChange={e=>setCandidateData("residentialState",e.target.value)}/></div></div>
        <section className="space-y-2 rounded border p-3"><Label>Examination subjects and CASS scores</Label>{(candidateDraft.applicationData.subjects||[]).map((row:any,index:number)=><div key={index} className="grid grid-cols-2 gap-2 border-t pt-2 md:grid-cols-5"><Input aria-label="Subject" placeholder="Subject" value={row.subject||""} onChange={e=>setCandidateData("subjects",candidateDraft.applicationData.subjects.map((x:any,i:number)=>i===index?{...x,subject:e.target.value}:x))}/><Input aria-label="CASS 1" placeholder="CASS 1" value={row.cass1||""} onChange={e=>setCandidateData("subjects",candidateDraft.applicationData.subjects.map((x:any,i:number)=>i===index?{...x,cass1:e.target.value}:x))}/><Input aria-label="CASS 2" placeholder="CASS 2" value={row.cass2||""} onChange={e=>setCandidateData("subjects",candidateDraft.applicationData.subjects.map((x:any,i:number)=>i===index?{...x,cass2:e.target.value}:x))}/><Input aria-label="CASS 3" placeholder="CASS 3" value={row.cass3||""} onChange={e=>setCandidateData("subjects",candidateDraft.applicationData.subjects.map((x:any,i:number)=>i===index?{...x,cass3:e.target.value}:x))}/><Input aria-label="Signature" placeholder="Signature / name" value={row.signature||""} onChange={e=>setCandidateData("subjects",candidateDraft.applicationData.subjects.map((x:any,i:number)=>i===index?{...x,signature:e.target.value}:x))}/></div>)}</section>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setCandidateDraft(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving&&<Loader2 className="h-4 w-4 animate-spin"/>} Save candidate record</Button></div>
      </form>}
    </Dialog>
  </div>;
}
