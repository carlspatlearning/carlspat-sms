# Product Requirements Document (PRD): School Management System Video Explainer

**Version:** 2.1 — verified build, repositioned for a proprietor audience
**Supersedes:** v2.0 (verified, addressed to one school's community) · v1.0 (unverified draft)
**Verified against:** `carlspat-sms` @ `9590887` (main), 13 August 2026
**Companion document:** [VIDEO_PRD_VERIFICATION.md](VIDEO_PRD_VERIFICATION.md) — evidence and file citations for every claim below

> **What changed in v2.0.** Version 1.0 was written without access to the application. It carried
> 15 unresolved assumptions, 28 unconfirmed features, and described three screens and two user roles
> that do not exist. All 43 open items have now been resolved against the source code. Fabricated
> elements have been removed, verified capabilities the draft omitted have been added — including the
> feature that should lead the video — and the storyboard, script and screen inventory have been
> rebuilt around the real interface. Sections 26 and 27 have changed purpose: they are now records of
> verified fact rather than lists of open questions.
>
> **What changed in v2.1.** Decision D1a closed: the film now sells the system to proprietors at
> other schools rather than explaining it to one school's parents. The narration moves to the second
> person, a new Scene 22 shows the system being rebranded to the buyer's own school, and the product
> name is deliberately never spoken. Verification also surfaced a constraint that was irrelevant to
> the old positioning and is central to the new one: **the system runs one school per installation**
> (§8.14), so no multi-school claim may appear anywhere in the film.

---

## 1. Product Overview

**Product:** **[PRODUCT NAME]** — ⚠️ open, see decision D1b (§31). The product cannot be sold to
other schools under the name of one of them.
**Vendor:** Carlspat Private School
**Audience:** **School proprietors and owners evaluating the system for their own school**
(decision D1a, closed 13 August 2026)
**Deployment model:** One installation per school. The system is **not** multi-tenant — see §8.14.
**Vendor contact (the CTA):** 📞 08067281676 · ✉️ carlspatprivateschool@outlook.com
**Website:** None — no public site exists. The call to action is contact-only (decision D2, closed 13 August 2026)
**Version:** 2.1
**Video type:** Professional SaaS product explainer, aimed at a business buyer
**Primary language:** British English
**Currency on screen:** Nigerian Naira (₦)
**Reference installation on screen:** A neutral fictional school built for the shoot — **not**
Carlspat's live data (§28, Risk 10). It runs **Crèche through SSS 3** — sixteen classes spanning
nursery, primary, junior and senior secondary — so a proprietor of any of the three sees their own
structure. **The hero journey runs through JSS 2**, putting a genuine secondary report card into the
film's strongest shot, while primary and nursery classes stay visible in every class list.

The system is an integrated School Management System covering administration, academics, finance,
communication and resource management in one web application. It is built as a Next.js portal over
an Express/PostgreSQL API, with six role-based views onto one shared database.

The explainer must not present the platform as a collection of disconnected modules. It should
demonstrate a coherent information ecosystem in which student records, classes, teachers,
assessments, results, fees, expenditure, resources, comments and stakeholder access are connected —
and it now has a concrete, filmable proof of that connection: **report cards are released to parents
automatically once the term's fees are settled.** That single rule is the product's clearest
demonstration that the academic and financial sides are one system rather than two.

**Central proposition:**

> "One platform. One connected school. Smarter school management."

This remains a proposed positioning line. An alternative that reflects the verified differentiator:

> "Where the register, the report card and the receipt finally meet."

---

## 2. Product Vision

The video demonstrates a transition from fragmented, paper-based or manually coordinated processes
towards a centralised digital environment.

Five strategic ideas:

1. **Centralisation** — school information is managed from one platform.
2. **Efficiency** — repetitive administrative processes are simplified. Demonstrable: one action
   generates an entire class's report cards.
3. **Visibility** — decision-makers see enrolment, attendance, academic performance and the term's
   income against expenditure on one dashboard.
4. **Collaboration** — administrators, teachers, students and parents interact with shared
   information according to server-enforced permissions.
5. **Integrity** — records are traceable and verifiable. Report cards carry a signed QR code;
   confirmed online payments cannot be edited; every significant action is written to an audit log.

*Integrity replaces v1.0's "Accessibility" as a strategic pillar. Accessibility is covered under
role-based access in §6, whereas verifiable records are a distinct and evidenced strength of this
build.*

The video must avoid presenting digitalisation as an automatic guarantee of improved school
performance. Benefits are framed as capabilities and operational advantages, never as unsupported
quantitative claims.

---

## 3. Video Objectives

The video must:

- Introduce the system to a proprietor deciding whether to buy it.
- Establish the problems created by fragmented school administration, in terms the viewer recognises
  as their own.
- Demonstrate the integrated platform and its dashboard.
- Demonstrate student, parent, teacher and class management.
- Demonstrate attendance marking.
- Demonstrate assessment entry and result computation.
- **Give the greatest demonstration depth to report-card generation**, including bulk generation for
  a whole class and QR verification of an issued report.
- **Demonstrate the fee-linked release of report cards** — the strongest evidence of integration.
- Demonstrate fee configuration, payment recording, receipts and the debtors view.
- Demonstrate expenditure recording and the income-versus-expenditure summary.
- Demonstrate resource upload and access.
- Demonstrate report comments at both teacher and head-teacher level.
- Demonstrate announcements and internal messages.
- Show realistic user journeys across the six real roles, and make clear which seat the proprietor
  themselves would occupy.
- Explain role-based access accurately.
- **Demonstrate that the system is configured to the buyer's own school** — name, logo, classes,
  subjects and grading scale — and that they run their own installation with their own data.
- End with an evidence-based call to action, with the telephone number as the primary route.

The video must **not** depict: multi-school management of any kind, a notification centre,
analytical charts, a proprietor or principal account type, a mobile app, assignment submission, a
timetable, or any module listed as unimplemented in §27. It must not claim the system improves fee
collection.

---

## 4. Target Audience

### Primary audience

**School proprietors and owners.** Operational visibility, financial control, academic monitoring,
accountability, administrative efficiency. In the system they work through a Super Admin or Admin
account — there is no separate proprietor role.

**Head teachers.** Academic performance, staff activity, student records, reporting, and the
head-teacher comment on every report card. They work through an Admin or Super Admin account.

**School administrators.** Admissions, student records, classes, subjects, documentation,
announcements, user accounts, school settings.

**Accountants and bursars.** Fee structures, payment recording, receipts, waivers, outstanding
balances, expenditure and the financial summary.

### Secondary audience

**Teachers.** Class lists, attendance, assessments, results, report comments, resources.

**Parents and guardians.** Each linked child's fee status, academic performance, report card,
comments and resources.

**Students.** Class, subjects, resources and results.

### Who the film actually speaks to

**Decision D1a, closed 13 August 2026: the film addresses proprietors and owners at other schools.**
It is a sales asset, not an onboarding video for one school's community.

This changes how the roles above are used. The **proprietor is the viewer** — the person deciding
whether to buy. Everyone else appears on screen as someone the buyer employs or serves:

| Group | Role in the film |
|---|---|
| **Proprietors and owners** | **The audience.** Addressed directly in the second person throughout |
| Head teachers, administrators, bursars | Shown as the staff the buyer would equip. Their screens are evidence the system fits a real school |
| Teachers | Shown doing the work the buyer wants made easier |
| Parents and students | **Depicted beneficiaries, never addressed.** They demonstrate what the school can offer families |

Three consequences run through the script:

1. **Second person.** "Your school", "your teachers", "your bursar" — not "the school".
2. **The branding objection must be answered.** Every screen carries another school's name. Scene 22
   resolves this by showing the system rebranded to the buyer's own school (§8.14).
3. **The proprietor's own seat must be shown.** They will ask what they would log in as. The answer
   is Super Admin or Admin — there is no proprietor role — and Scene 21 must caption that clearly.

---

## 5. User Personas

Each persona is mapped to the account type they would actually hold.

**Persona A — Proprietor / Owner** → logs in as **Super Admin** or **Admin**
Goal: understand overall school performance.
Sees: enrolment totals, attendance rate, fee collection rate, outstanding fees, income versus
expenditure and net balance, average performance by class.
Message: *"Get a clearer view of what is happening across your school."*

**Persona B — Head Teacher** → logs in as **Admin** or **Super Admin**
Goal: oversee academics and sign off reports.
Sees: results across classes, both comment levels, report cards, school settings including the
grading scale.
Message: *"Review results and add your comments before reports go out."*

**Persona C — Administrator** → **Admin**
Goal: run day-to-day operations.
Sees: student registration, parent linking, class and subject setup, user accounts, announcements,
promotion at end of session.
Message: *"Manage essential school information from one organised workspace."*

**Persona D — Teacher** → **Teacher**
Goal: manage academic responsibilities.
Sees: assigned classes and subjects, attendance register, score entry, teacher comments, resources.
Cannot write the head-teacher comment — the API rejects it.
Message: *"Spend less time organising records and more time supporting learning."*

**Persona E — Accountant / Bursar** → **Accountant**
Goal: maintain accurate financial records.
Sees: fee categories and structures, payment recording, PDF receipts, waivers and discounts,
debtors, expenditure. Has no access to results, comments or report cards.
Message: *"Track school income and expenditure with greater visibility."*

**Persona F — Parent** → **Parent**
Goal: monitor each child.
Sees: every linked child with class and outstanding balance, fee details, payment history, results,
the report card once fees are settled, announcements, messages, resources.
Message: *"Keep parents connected to important information about their children."*

**Persona G — Student** → **Student**
Goal: access academic information.
Sees: own class, subjects, results, resources, announcements, fee status.
Message: *"Give students convenient access to relevant academic information."*

---

## 6. User Roles and Permissions

**The system implements exactly six roles.** There is no proprietor role and no principal or
head-teacher role. The head teacher exists as a name on the school record and as a comment field on
the report card, not as an account type. No login screen, sidebar or role-switch animation may show
a seventh role.

| Role | Core access | Major actions |
|---|---|---|
| **Super Admin** | Entire system | Manage users, roles, school settings, sessions, terms, grading scale, assessment structure |
| **Admin** | Operational and academic management | Register students, link parents, manage teachers, classes, subjects, attendance, results, comments, fees, expenditure, announcements, promotion |
| **Accountant** | Financial modules only | Fee categories and structures, record payments, issue receipts, apply waivers, manage expenditure, view debtors |
| **Teacher** | Assigned academic areas | Mark attendance, enter scores, write teacher comments, upload resources, view assigned classes and students |
| **Parent** | Linked children only | View fees, payment history, results, report cards (fee-gated), announcements, messages, resources |
| **Student** | Own record only | View class, subjects, results, report card (fee-gated), announcements, messages, resources |

### Verified module access matrix

| Module | Super Admin | Admin | Teacher | Accountant | Parent | Student |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Students | ✅ | ✅ | ✅ | ✅ | — | — |
| Parents | ✅ | ✅ | ✅ | ✅ | — | — |
| Teachers | ✅ | ✅ | — | — | — | — |
| Classes | ✅ | ✅ | ✅ | — | — | — |
| Subjects | ✅ | ✅ | — | — | — | — |
| Attendance | ✅ | ✅ | ✅ | — | — | — |
| Results | ✅ | ✅ | ✅ | — | — | — |
| Report Comments | ✅ | ✅ | ✅ | — | — | — |
| Report Cards | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Fees | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Payments | ✅ | ✅ | — | ✅ | ✅ | — |
| Expenditures | ✅ | ✅ | — | ✅ | — | — |
| Resources | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Announcements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Messages | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| User Accounts | ✅ | ✅ | — | — | — | — |
| School Settings | ✅ | ✅ | — | — | — | — |

Two enforcement details worth a moment of screen time, because they show permissions are real
rather than cosmetic:

- Teachers are refused the head-teacher comment by the API, not merely by a hidden field.
- Financial figures are omitted from the dashboard response entirely for non-finance roles; they
  never reach the browser.

---

## 7. Problems Being Solved

The opening sequence establishes common operational problems without implying every school
experiences all of them.

- Paper-based records and multiple spreadsheets.
- Difficulty locating a student's information quickly.
- Repeated manual data entry across registers, mark sheets and fee books.
- Manual compilation of continuous assessment and examination scores.
- Hand-written report cards prepared one at a time, each term, for every child.
- Manual class ranking and averaging.
- Limited visibility of who has paid and who has not.
- Fee collection chased separately from academic record-keeping.
- Expenditure recorded informally, hard to reconcile against income.
- Difficulty distributing lesson notes and past questions to a whole class.
- Delayed communication with parents.
- Report cards that can be altered or forged after issue.
- Difficulty obtaining a consolidated view of the school.

Narrative transition: **"Information is scattered." → "Bring the information together."**

---

## 8. Product Features

Everything in this section is implemented and verified. Configuration-dependent items are marked.

### 8.1 Dashboard

Role-aware. The staff dashboard presents:

- Total active students, teachers, parents, classes — as animated stat cards.
- Attendance rate over the last 30 days.
- Fee collection: expected, collected, discounts, outstanding, collection rate (finance roles only).
- Financial summary for the current term: total income, total expenditure, net balance — as three
  coloured panels, with the balance panel changing colour when negative.
- Average academic performance by class, as simple proportional bars.
- Links through to the debtors report and expenditures.

The parent dashboard lists each linked child with photograph, class, admission number and
outstanding balance. The student dashboard shows own class, admission number and fee status.

> **Production constraint.** No charting library is installed. The interface uses stat cards,
> coloured summary panels and proportional bars. Do not animate line graphs, pie charts or donut
> charts — they do not exist in the product.

### 8.2 Student Management

Registration → profile → class allocation → parent linking → academic record → fee record →
resources → comments → end-of-session promotion.

Student profile holds: passport photograph, full name, admission number, gender, class, academic
session, linked parent or guardian, contact details, status (Active, Graduated, Transferred,
Suspended, Withdrawn), academic records, attendance, fee status and documents.

**Promotion.** At the end of a session, students are promoted, repeated or graduated, and the
movement is recorded against the student with the session name.

### 8.3 Parent Management

Parent profile with identity, contact details and linked children. From one screen a parent sees
each child's class, fee balance, academic performance, report card, comments and resources.
A parent may have several children linked; the dashboard iterates over all of them.

### 8.4 Teacher and Staff Management

Staff profile with staff number, qualification and specialisation. Teachers are assigned as form
teacher of a class and as subject teacher for specific class-subject pairs. The teacher's own
workspace shows only their assigned classes and subjects.

### 8.5 Class Management

Academic session and terms → class creation with level and capacity → form teacher assignment →
subject assignment with a teacher per subject → student allocation → class performance → class-wide
report generation.

Seeded structure: Crèche, Nursery 1, Nursery 2, Kindergarten, Primary 1–6.

### 8.6 Academic and Result Management

Visual sequence: **Student → Class → Subject → Assessment → Result computation → Comments → Report Card → Parent access**

The system computes, from entered scores:

- Per-subject totals across each configured assessment type.
- Percentage, grade and remark per subject, resolved from the school's grading scale.
- Overall total, average, grade and remark.
- **Class position** by dense ranking — tied students share a position — with class size.
- **Cumulative columns** in second and third term reports, carrying forward each earlier term's
  subject totals plus a session average.
- **A promotion recommendation** stamped on the report: average of 50% or above → PROMOTED,
  below → REPEAT.

**Verified default configuration** (fully editable by an administrator, so confirm before filming):

| Assessment | Max score |
|---|---|
| CA 1 | 20 |
| CA 2 | 20 |
| Exam | 60 |
| **Total** | **100** |

| Score | Grade | Remark |
|---|---|---|
| 70–100 | A | Excellent |
| 60–69 | B | Very Good |
| 50–59 | C | Good |
| 45–49 | D | Fair |
| 40–44 | E | Pass |
| 0–39 | F | Fail |

There is **no formal approval or publishing workflow** — no "submit for approval" button, no
locked/published state on results. Reports are prepared by staff and released to parents by the fee
rule in §8.7. Do not animate an approval step.

### 8.7 Report Card Generation — the central demonstration

The report card is a real A4 PDF generated server-side, carrying the school logo, motto, address and
contact line; the student's passport photograph, name, admission number, gender and class; the
session and term; the full subject table with each assessment column, totals, percentages, grades
and remarks; cumulative columns from earlier terms where applicable; overall average, grade and
position in class; the attendance summary for the term; the teacher's comment; the head teacher's
comment; the promotion stamp; and a QR code.

Demonstration sequence:

1. Teacher enters CA and exam scores for a class and subject.
2. Teacher writes the class comment.
3. Head teacher — working as Admin — adds the head-teacher comment.
4. Staff member selects session, term and student.
5. Report card is generated and previewed.
6. PDF downloads, named by admission number and term.
7. Printing via the browser's print dialogue on the generated PDF.
8. **Bulk generation:** one action produces a single merged PDF containing every active student in
   the class, skipping those with no results recorded.
9. **QR verification:** the QR code on the printed report opens a public page confirming student,
   admission number, class and term — and reports an invalid signature if the document has been
   tampered with.
10. Parent opens the report in their portal — subject to §8.8.

The visual transition should show individual score entries becoming a finished report card, then a
single report becoming a stack of forty.

### 8.8 Fee-Linked Report Card Release

> Parents and students can only view, download or print a report card when the term's fees are
> **fully paid**. With a balance outstanding, the portal shows: *"Access to report card is restricted
> until school fees have been fully paid."* Staff always bypass the lock, so the school can prepare
> and review reports at any time.

The portal checks the lock state before offering the download, so the parent sees a clear
explanation and their outstanding balance rather than a failed download.

**This deserves its own beat in the video.** It is the most concrete proof that the modules form one
system. Frame it as fee-settlement policy enforced automatically and consistently — not as
withholding a child's results. Recommended line:

> *"Because fees and academic records live in the same system, report cards are released
> automatically as soon as a term's fees are settled — no separate checks, no manual list."*

### 8.9 Fee Management

- Fee categories: Tuition, PTA, Examination, Development Levy, Transport and others as configured.
- Fee structures set per class per term. The figure filmed is whatever the demo instance is
  configured with — see the shooting document §3, where JSS 2 is set at **₦86,000 per term**.
  *(For reference, the repository's own seed configures Primary 5 at ₦55,000 — Tuition ₦45,000 +
  PTA ₦2,000 + Examination ₦3,000 + Development Levy ₦5,000. That is Carlspat's starting data, not
  the demo dataset built for the shoot.)*
  Transport is an optional category, not billed by default.
- Per-student fee items for charges outside the standard class structure.
- Waivers and discounts — scholarships, staff children — deducted from the expected total.
- Payment recording with method: cash, bank transfer, card, online, POS or cheque.
- Sequentially numbered **PDF receipts**, emailed to the payer where email is configured.
- Payment history, outstanding balance, payment status.
- Debtors report and fee summaries.
- Parent fee view with each child's balance.

**Online payment.** Two gateways are implemented — **Paystack** and **Flutterwave** — with
initialisation endpoints for parent-initiated payments and signature-verified webhooks for
confirmation. Both are live only when the school's API keys are configured. A payment confirmed by a
gateway **cannot be edited**; a correcting entry must be recorded instead.

The video must still distinguish clearly between *recording* a payment received offline and
*processing* an online payment. Both exist; they are different workflows.

### 8.10 Expenditure Management

New expenditure with category, description, amount, date and term. Expense history with filters,
expenditure reporting, and a dashboard summary that sets the term's expenditure against income to
produce a net balance.

### 8.11 Resources and Documents

Upload with title, description and type — Assignment, Lesson Note, Past Question, Scheme of Work or
Other. A resource may be assigned to a specific class or made available school-wide. Files are
stored via Cloudinary where configured. Resources are visible to staff, parents and students.

> **Constraint.** `Assignment` is a *resource type* — a file a teacher distributes. There is no
> student submission, no upload-by-student, no marking flow. Narrate this as resource sharing and
> never as assignment management.

### 8.12 Comments and Remarks

Two comment levels are stored against a student's term report: the **teacher comment** and the
**head-teacher comment**. Both appear on the generated report card. Teachers may write the first;
the API refuses them the second.

### 8.13 Communication

- **Announcements** targeted at an audience: everyone, teachers, parents, students or staff.
- **Internal messages** between users, available to all six roles.
- **Email delivery** via SendGrid — announcement broadcasts and payment receipts.
- **SMS delivery** via Twilio — announcement broadcasts.

Email and SMS are live only when credentials are configured; without them the system logs the
message and continues working.

> **There is no notification centre, no bell icon and no push notification.** Version 1.0's Scene 17
> depicted an interface that does not exist. Communication is demonstrated through the Announcements
> and Messages screens.

### 8.14 Deployment Model — one school per installation

**The system manages one school per installation.** Every route resolves the school with
`prisma.school.findFirst()` across twenty call sites, and core aggregate queries — `student.count`,
`teacher.count`, `classRoom.findMany` — carry no school filter at all. The `School` model and
`schoolId` columns exist throughout the schema, but nothing enforces tenant isolation today.

**Prohibited on screen:** any school switcher, group console, "all your schools" view, or claim of
multi-school management. A proprietor who owns three schools would run three installations.

**Permitted, and worth stating:** each school gets its own installation with its own database. For a
buyer, this is a genuine advantage rather than an apology — their data is not pooled with other
schools', and the whole system carries their branding.

**This is also how the branding objection is answered.** School name, motto, address, phone, email
and logo are editable from Admin → School Settings, as are academic sessions, classes, subjects, the
grading scale and the assessment structure. Filming that screen — the identity changing, and the new
identity appearing on a regenerated report card — converts the film's biggest liability into its
closing argument. It is Scene 22.

### 8.15 Verification, Audit and Access Control

- QR-code verification of any issued report card, via a public page, using an HMAC signature.
- Audit log recording who did what and when.
- JWT authentication with refresh-token rotation and token-version invalidation.
- Password hashing with bcrypt.
- Server-side authorisation on every route.

Narrate this as **controlled access and verifiable records**. Do not make claims about encryption
standards, certification, compliance or uptime (§25).

---

## 9. Feature-to-Benefit Matrix

| Feature | Problem addressed | Primary user | Demonstrated benefit |
|---|---|---|---|
| Dashboard | Fragmented information | Owner / Admin | Enrolment, attendance, fees and performance in one view |
| Student management | Disorganised records | Admin | Structured student information |
| Parent management | Limited parent visibility | Admin / Parent | One view of every linked child |
| Teacher management | Fragmented staff information | Admin | Clear class and subject assignment |
| Class management | Manual class allocation | Admin / Teacher | Structured class records |
| Attendance | Paper registers | Teacher | Termly summary that feeds the report card |
| Result management | Manual calculation and ranking | Teacher / Admin | Automatic totals, grades, averages and class position |
| **Report cards** | Hand-written, one child at a time | Teacher / Admin / Parent | A whole class generated in one action |
| **QR verification** | Altered or forged reports | School / Parent | Any report can be checked against the system |
| **Fee-linked release** | Chasing fees separately from academics | Bursar / Admin | Reports release automatically once fees are settled |
| Fee management | Difficult payment tracking | Bursar / Admin | Balances, receipts and a debtors view |
| Online payment | Cash handling and bank queues | Parent / Bursar | Card and transfer payment, confirmed automatically |
| Expenditure | Scattered expense records | Bursar / Owner | Income against expenditure, with net balance |
| Resources | Difficult material distribution | Teacher / Student | Lesson notes and past questions in one place |
| Comments | Disconnected remarks | Teacher / Head Teacher | Comments printed on the report card |
| Announcements & messages | Delayed information | School / Parent | Targeted announcements, by email and SMS where configured |
| Audit log | Unclear accountability | Owner / Admin | A record of who changed what |

---

## 10. Core User Journeys

**Administrator:** Login → Dashboard → Register student → Link parent → Assign class → Configure fee structure → Record payment → Upload resource → Review expenditure → Generate class report cards.

**Teacher:** Login → Teacher dashboard → Select assigned class → Mark attendance → Select subject → Enter CA 1, CA 2 and Exam scores → Write report comment → Upload a lesson note.

**Head teacher (as Admin):** Login → Results → Review a class → Add head-teacher comments → Generate the class's report cards as one PDF.

**Accountant:** Login → Dashboard financial summary → Fees → Record a payment → Issue the PDF receipt → Apply a waiver → Record an expenditure → Review the debtors report.

**Parent:** Login → Parent dashboard showing each child and balance → Select a child → View fee status → Pay online → View results → Open the report card → Read comments → Access resources.

**Student:** Login → Student dashboard → View class and subjects → Access resources → View results.

**Proprietor (as Admin/Super Admin):** Login → Dashboard → Enrolment and attendance → Fee collection rate and outstanding → Income against expenditure → Average performance by class.

---

## 11. Video Narrative

Target length: **5 minutes 00 seconds.**

| Time | Section | Content |
|---|---|---|
| 0:00–0:20 | The Challenge | Paper registers, mark sheets, hand-written report cards, fee books |
| 0:20–0:35 | The Solution | The login and first dashboard view |
| 0:35–0:55 | Dashboard | Stat cards, financial summary panels, performance bars |
| 0:55–1:18 | Students & Parents | Registration, profile, parent linking, one parent's view of two children |
| 1:18–1:40 | Teachers, Classes & Attendance | Class setup, subject assignment, marking the register |
| 1:40–2:52 | **Results & Report Cards** | Score entry → computed result → comments → generated PDF → whole class in one action → QR verification |
| 2:52–3:07 | **Fee-Linked Release** | Parent sees the restriction, payment settles, the report unlocks |
| 3:07–3:31 | Fees | Fee structure, record a payment, numbered receipt, debtors view |
| 3:31–3:41 | Expenditure | Record an expense; income against expenditure on the dashboard |
| 3:41–3:51 | Resources | Upload a lesson note, assign to a class, student opens it |
| 3:51–4:01 | Communication | Announcement to a chosen audience; message thread |
| 4:01–4:16 | Roles | The six real dashboards, with the proprietor's own seat captioned |
| 4:16–4:28 | **It Becomes Your School** | Settings rebrand; the report card regenerates under the new identity |
| 4:28–4:50 | Benefits & Close | Persona benefits; the interface resolves to the product mark |
| 4:50–5:00 | Call to Action | Contact details, telephone primary |

Results and report cards carry 72 seconds — 24% of the runtime — with a further 15 seconds on the
fee-linked release and 12 on the rebranding scene. Together those three carry a third of the film.
That weighting is deliberate for a buying audience — *it does the hardest job in the school, it links
money to academics, and it becomes yours* — and should survive any later trim.

---

## 12. Scene-by-Scene Storyboard

| # | Dur. | Module | Visual / UI | Action | Voice-over | On-screen text |
|---|---|---|---|---|---|---|
| 1 | 10s | Problem | Paper registers, mark sheets, fee book | Files and papers accumulate | "Running a school involves far more than teaching." | School management is complex. |
| 2 | 10s | Problem | Hand-written report cards, a spreadsheet | Hand copies scores card by card | "Records, results, fees and communication quickly become difficult to coordinate — and every term, the same work starts again." | Records. Results. Fees. |
| 3 | 15s | Introduction | Login screen → dashboard | Interface opens | "There is another way to run it. A complete school management system — one platform for your whole school." | **[PRODUCT NAME]** |
| 4 | 20s | Dashboard | Staff dashboard | Stat cards count up; financial panels and class bars appear | "From one dashboard, you see what is actually happening across your school — enrolment, attendance, fees collected, money spent, and how each class is performing." | One connected platform. |
| 5 | 13s | Students | Student list → registration form | Complete and save a new student | "Every student begins with a structured digital profile." | Student Management |
| 6 | 10s | Parents | Parent profile | Link a guardian to two children | "Parents and guardians are linked to their children, so a parent with more than one child in your school sees them all together." | Connected Parent Records |
| 7 | 11s | Classes | Class screen | Assign form teacher and subjects | "Classes, subjects and teachers are organised in a single structure, and each teacher works only with the classes assigned to them." | Classes & Academic Structure |
| 8 | 11s | Attendance | Attendance register | Mark present, absent, late | "Attendance is marked digitally, and the term's record carries through to the report card automatically." | Attendance |
| 9 | 16s | Results | Score entry grid | Enter CA 1, CA 2 and Exam for a class | "Your teachers record continuous assessment and examination scores for their own subjects." | Assessment & Results |
| 10 | 10s | Results | Computed result view | Totals, grades, average and position resolve | "The system calculates subject totals, grades, the overall average and each student's position in class — using your school's own grading scale." | Calculated Automatically |
| 11 | 8s | Comments | Comment screen | Type a teacher comment; head-teacher comment appears | "Teacher and head-teacher comments are added to the record." | Comments & Remarks |
| 12 | 18s | Report Card | Generated PDF preview | Scores flow into the finished A4 report card; scroll through it | "Then the report card is generated: scores, attendance, comments and your grading scale brought together into a finished document." | Report Card Generation |
| 13 | 10s | Report Card | Bulk generation | One action; a stack of report cards fans out | "For an entire class, that is one action rather than forty." | An Entire Class, One Action |
| 14 | 10s | Verification | Printed report → QR scan → verification page | Phone scans the code; details confirm | "Every report card carries a code that verifies it against your records." | Verified Report Cards |
| 15 | 15s | **Fee release** | Parent portal, restricted state → paid state | Restriction message; payment settles; report unlocks | "Because fees and academic records sit in the same system, report cards are released automatically once a term's fees are settled — so fees and reports stop being two separate conversations." | Released When Fees Are Settled |
| 16 | 16s | Fees | Fee structure → record payment → receipt | Set the term's fees; record a payment; the numbered receipt downloads | "Fee structures are set per class and per term. Payments are recorded and receipted — including card and transfer payments where a gateway is connected." | Fee Management |
| 17 | 8s | Fees | Debtors report | Outstanding balances list | "Outstanding balances are visible at a glance." | Outstanding at a Glance |
| 18 | 10s | Expenditure | Expense form → dashboard | Record an expense; income and expenditure resolve into a net balance | "Expenditure is recorded by category and set against the term's income, so you can see your position rather than estimate it." | Expenditure Management |
| 19 | 10s | Resources | Resource upload → student view | Upload a lesson note to a class; a student opens it | "Lesson notes, schemes of work and past questions are uploaded once and shared with the right class." | Resources & Documents |
| 20 | 10s | Communication | Announcements → Messages | Compose an announcement to parents; a message thread | "Announcements reach a chosen audience, by email and SMS where those are configured." | Announcements & Messages |
| 21 | 15s | Roles | Six dashboards | Cycle the six real role views; caption the Super Admin view as the proprietor's seat | "Each of the six roles sees only what belongs to it — enforced by the system, not just hidden from view." | Six Roles. Controlled Access. |
| 22 | 12s | **Rebrand** | School settings → regenerated report card | School name and logo change live; classes, subjects and grading scale highlight; the report card reappears under the new identity | "And it becomes your school's system. Your name, your logo, your classes, your subjects, your grading scale — set from your own dashboard, on your own installation, with your own data." | Configured For Your School |
| 23 | 10s | Benefits | Personas connect to modules | Lines link owner, admin, teacher, bursar, parent, student | "For you, your administrators, your teachers and your bursar, the aim is the same: organised information, and far fewer manual steps." | Built Around Your School |
| 24 | 12s | Close | Logo, dashboard fade | Interface resolves to the product mark | "Bring your school's records, results and finances together." | Manage. Connect. Simplify. |
| 25 | 10s | CTA | Contact screen | Contact details animate in; telephone largest | "To see it running in your school, call 08067281676, or email carlspatprivateschool@outlook.com." | 📞 08067281676 · ✉️ carlspatprivateschool@outlook.com |

**Total: 5 minutes 00 seconds.**

Removed from v1.0: the notification-centre scene (no such interface) and the analytics-charts scene
(no charting library). Added: attendance, bulk generation, QR verification, fee-linked release, the
debtors view and — following decision D1a — **Scene 22, the rebranding beat**, which answers the
first objection a proprietor will raise about watching another school's data.

**The product name is spoken nowhere in the film.** It appears only on the Scene 3 and Scene 25
cards. This is deliberate: it keeps decision D1b off the critical path, so a late or changed name
costs two re-rendered title cards rather than a re-recorded voice-over.

Scene-level timecodes, shot detail, demo data and the booth-ready script are in the
[shooting document](VIDEO_SHOOTING_DOCUMENT.md), which is authoritative for production. If the two
documents ever disagree on timing, the shooting document is correct.

---

## 13. UI Demonstration Requirements

Every screen must be captured from the running application or an approved design based on it. The
following screens exist and can be filmed directly:

| # | Screen | Route |
|---|---|---|
| 1 | Login | `/login` |
| 2 | Staff dashboard | `/dashboard` |
| 3 | Parent / student dashboard | `/dashboard` (role-dependent) |
| 4 | Student list | `/dashboard/students` |
| 5 | Student registration | `/dashboard/students/new` |
| 6 | Student profile | `/dashboard/students/[id]` |
| 7 | Student promotion | `/dashboard/students/promote` |
| 8 | Parent management | `/dashboard/parents` |
| 9 | Teacher / staff management | `/dashboard/teachers` |
| 10 | Class management | `/dashboard/classes` |
| 11 | Subject configuration | `/dashboard/subjects` |
| 12 | Attendance register | `/dashboard/attendance` |
| 13 | Result entry | `/dashboard/results` |
| 14 | Report comments | `/dashboard/comments` |
| 15 | Report cards | `/dashboard/report-cards` |
| 16 | Generated report card PDF | server-rendered A4 PDF |
| 17 | Public report verification | `/verify-report` |
| 18 | Fees — categories, structures, waivers, debtors | `/dashboard/fees` |
| 19 | Payments and receipts | `/dashboard/payments` |
| 20 | Expenditures | `/dashboard/expenditures` |
| 21 | Resources | `/dashboard/resources` |
| 22 | Announcements | `/dashboard/announcements` |
| 23 | Messages | `/dashboard/messages` |
| 24 | User accounts | `/dashboard/users` |
| 25 | School settings — sessions, terms, grading, assessments | `/dashboard/settings` |
| 26 | Profile | `/dashboard/profile` |

The cursor should move deliberately rather than rapidly. Important fields receive focus through
subtle zooming or highlighting. **No fictitious buttons, screens or data may be shown.** The
interface supports a dark theme; a brief light-to-dark transition is authentic and worth two seconds.

---

## 14. Voice-Over Script

**Specification.** Approximately 600 words · 5 minutes 00 seconds at a measured pace · British
English · second person throughout, addressed to a school proprietor.

**Register.** One business owner speaking to another: credible, unhurried, never a hard sell. The
film carries several passages of silent interface action, so the read should not hurry to fill time.

**The canonical script lives in the [shooting document](VIDEO_SHOOTING_DOCUMENT.md), §6.** It is
maintained there as a single copy, in booth-ready form with pronunciation notes, pause marks and
scene cues. A duplicate here would drift out of step — that has already happened once with the scene
timings — so this section states the constraints and the shooting document holds the words.

### Binding constraints on the read

1. **The product name is never spoken.** The narration says "a complete school management system"
   and "one platform for your whole school". The name appears only as on-screen typography in Scenes
   3 and 25. This keeps decision D1b (§31) off the critical path: a late or changed name costs two
   re-rendered cards, not a re-record. Named alternates for both lines are held in the shooting
   document and are recorded only after sign-off.
2. **Second person throughout.** "Your school", "your teachers", "your bursar". The viewer is the
   buyer, not a parent.
3. **No claim that the system improves fee collection.** Scene 15 describes the mechanism — the
   check is automatic and consistent — and stops there. No rate, percentage or promptness claim.
4. **No multi-school language.** "Your own installation, with your own data" is accurate; "manage
   all your schools in one place" is false (§8.14).
5. **Conditionals must survive the mix.** "Where a payment gateway is connected" and "where those
   are configured" are load-bearing — those integrations require the school's own credentials.
6. **The telephone number is read digit by digit**, unhurried, over a five-second hold.

Any wording change must come back to the PRD owner before recording. The script has been checked
line by line against what the software actually does, and small edits can turn an accurate sentence
into a false claim.

---

## 15. On-Screen Text

- One Connected Platform
- School Management, Simplified
- Student Management
- Connected Parent Records
- Classes & Academic Structure
- Attendance
- Assessment & Results
- Calculated Automatically
- Report Card Generation
- An Entire Class, One Action
- Verified Report Cards
- Released When Fees Are Settled
- Fee Management
- Outstanding at a Glance
- Expenditure Management
- Resources & Documents
- Comments & Remarks
- Announcements & Messages
- Six Roles. Controlled Access.
- Built Around Your School
- Manage. Connect. Simplify.
- Carlspat Private School
- 📞 08067281676 · ✉️ carlspatprivateschool@outlook.com

Removed from v1.0: "Automated Report Card" (implies more automation than exists — a person still
enters scores and comments), "Reports & Analytics" (no analytics module), "Role-Based Access"
(replaced with the more specific and verifiable six-role line).

---

## 16. Motion Graphics Requirements

Modern SaaS visual language. The interface remains the visual hero.

Recommended: UI card animation · number counters on the real stat cards · proportional bar growth
for class performance · deliberate cursor movement with subtle trails · dashboard zooms ·
screen-to-screen transitions · highlight rings on active fields · progressive disclosure ·
data-flow animation from score entries into the report card · icon morphing · soft interface
shadows · layered panels · micro-interactions · modal animations.

**Removed from v1.0: "chart drawing."** No charting library is installed and the dashboard contains
no line, pie or donut charts. Substitute counters and bar growth.

Avoid excessive 3D.

---

## 17. Animation and Transition Requirements

Transitions should communicate relationships between modules:

- **Student → Parent:** animate the link between a child's record and the guardian's.
- **Class → Attendance → Results:** move from roster to register to mark sheet along the same list.
- **Results → Report Card:** the signature transition. Individual score cells lift out of the entry
  grid and settle into the report card's subject table.
- **One report → whole class:** a single card multiplies into a fanned stack.
- **Report card → QR → verification page:** the printed document connects to the live record.
- **Outstanding balance → paid → report unlocked:** the clearest visual argument in the video; give
  it room.
- **Payments → Dashboard:** individual transactions aggregate into the collection figure.
- **Expenditure → Financial summary:** individual expenses resolve into the net balance panel.

Transitions of 0.3–0.8 seconds, with longer ones reserved for the three major narrative shifts
(problem → platform, results → report card, restricted → released).

---

## 18. Audio Requirements

**Voice-over:** British English, professional, clear, measured, neutral corporate tone, suited to
school decision-makers. The Nigerian phone number should be read digit by digit.

**Music:** modern corporate or e-learning character; low enough to preserve intelligibility;
gradual build into the product reveal; pulled back under the results and report-card explanation;
positive resolution at the call to action.

**Sound effects:** soft clicks, UI confirmation tones, a gentle document-generation sound at report
card creation, subtle whoosh transitions. Avoid gaming-style effects.

---

## 19. Branding Requirements

| Element | Value | Status |
|---|---|---|
| School name | Carlspat Private School | ✅ Confirmed |
| Motto | Emphasis on All-Round Development | ✅ Confirmed |
| Primary colour | Navy `#1e3a5f` | ✅ Confirmed — report card header and UI primary |
| Secondary colour | Gold `#b8860b` | ✅ Confirmed — motto line and accents |
| Tertiary | Grey `#555555` | ✅ Confirmed — document body text |
| Typography | Helvetica family in generated documents; the portal uses a system sans stack | ⚠️ No custom brand typeface exists |
| Logo | Placeholder mark in the repository | ⚠️ Production asset required (decision D3) |

Navy and gold are the school's document identity, taken from the report card renderer. The video's
palette should follow them. The logo appears at the opening, the report-card reveal and the close —
and nowhere else.

---

## 20. Technical Production Specifications

**Master:** 3840 × 2160 where source assets permit · 25 or 30 fps · high-quality H.264 MP4 or
ProRes master · 48 kHz audio · separate subtitle file plus burned-in captions for social versions.

**Website / YouTube:** 16:9, 1920 × 1080 minimum, 3840 × 2160 preferred.

**Instagram / Facebook:** 16:9 landscape, 1:1 square, 4:5 vertical.

**TikTok / Reels:** 9:16, 1080 × 1920 minimum, with enlarged text and UI crops suited to a phone.

**WhatsApp:** 16:9 or 9:16 depending on distribution, H.264 MP4, plus a compressed version
alongside the master — WhatsApp is likely the primary parent-facing channel for this school.

---

## 21. Accessibility Requirements

Accurate subtitles · high-contrast text · readable type sizes · no information conveyed by colour
alone (relevant to the dashboard's coloured financial panels, which must be labelled in narration
too) · clear narration · sufficient reading time on screen · important information reinforced in
both narration and visuals · captions synchronised to speech.

---

## 22. Social-Media Adaptations

**Full explainer — 4:30.** The complete narrative.

**Promotional cut — 75 seconds.** Problem → Dashboard → Report card → Fee-linked release →
**Rebranding** → CTA.

This is the cut that will do most of the selling — a proprietor watches the short version first. It
**must** include the rebranding beat; without it, a stranger's school name is the last thing the
viewer remembers.

**Social teaser — 25 seconds.** Hand-written report cards → score entry → generated report card →
whole class in one action → CTA.

**Feature clips:**

| Clip | Length |
|---|---|
| Report card generation, including bulk | 45–60s |
| Report cards released when fees are settled | 30–45s |
| Verified report cards (QR) | 20–30s |
| Fee management and receipts | 30–45s |
| Student and parent management | 30–45s |
| Result entry and calculation | 30–45s |
| Attendance | 20–30s |
| Expenditure and financial summary | 20–40s |
| Resource sharing | 20–40s |
| Dashboard overview | 20–40s |

Each clip must stand alone.

---

## 23. Call to Action

Final scene:

> **[PRODUCT NAME]**
> "Bring your school's records, results and finances together."
> 📞 08067281676
> ✉️ carlspatprivateschool@outlook.com
> [logo]

**Button:** "Contact Us". Not "Get Started" — there is no website to get started on.

Do **not** use "Book a Demo" — no booking process exists.

The telephone number is the primary call to action. It should be the largest element on the card
after the school name, held on screen long enough to be written down or photographed, and read
digit by digit in the narration.

✅ Decision D2 closed — no website. This scene is unblocked and final.

---

## 24. Functional Requirements — Verified Status

| Ref | Requirement | Status |
|---|---|---|
| FR-01 | Login and authentication | ✅ JWT with refresh rotation, bcrypt hashing |
| FR-02 | Role-based access | ✅ Six roles, enforced server-side |
| FR-03 | Dashboard | ✅ Role-aware; cards and bars, no charts |
| FR-04 | Student registration and profiles | ✅ |
| FR-05 | Parent records and child linking | ✅ |
| FR-06 | Teacher and staff records | ✅ |
| FR-07 | Class and subject management | ✅ |
| FR-08 | Academic and result management | ✅ Incl. grading, averages, dense-rank position |
| FR-09 | Report-card generation | ✅ A4 PDF, single and whole-class |
| FR-10 | Fee management | ✅ Structures, waivers, per-student items, debtors |
| FR-11 | Expenditure management | ✅ |
| FR-12 | Resource and document management | ✅ Cloudinary-backed |
| FR-13 | Comments and remarks | ✅ Two levels, teacher-restricted |
| FR-14 | Reports and summaries | ✅ Dashboard summaries and debtors report — no analytics module |
| FR-15 | Communication | ✅ Announcements, messages, email, SMS |
| FR-16 | Digital parent access | ✅ Fee-gated |
| FR-17 | Download and print | ✅ PDF download; printing via browser dialogue |
| FR-18 | Attendance | ✅ **New in v2.0** |
| FR-19 | Online payment | ✅ **New in v2.0** — Paystack and Flutterwave, keys required |
| FR-20 | Report verification | ✅ **New in v2.0** — QR with HMAC signature |
| FR-21 | Fee-linked report release | ✅ **New in v2.0** |
| FR-22 | Student promotion | ✅ **New in v2.0** |
| FR-23 | Audit logging | ✅ **New in v2.0** |

---

## 25. Non-Functional Requirements

The video should communicate: professional usability · consistent interface design · clear
information hierarchy · enforced access control · organised data · responsive design across phone,
tablet and desktop · reliable navigation · accessible presentation.

**Claims now permitted** (verified): payment gateway integration, subject to configuration · email
and SMS delivery, subject to configuration · responsive web access on mobile devices · verifiable
report cards · server-enforced role permissions · audit logging.

**Claims still prohibited** (unverified — do not narrate, caption or imply):

- **Multi-school management** — no school switcher, group console or "all your schools" view exists
- **Any claim that the system improves fee collection** — no rate, percentage, promptness or
  recovered-revenue claim has been verified. The verified statement is about workflow only.
- Specific uptime figures
- Cybersecurity certification
- Encryption technology or standards
- Regulatory compliance
- Automatic or cloud backup
- Artificial intelligence
- A native mobile application
- Any statistic about time saved, cost reduced or performance improved
- Named references to other schools as existing customers

---

## 26. Verified Facts

*This section replaces v1.0's "Assumptions". All fifteen items are resolved; none required cutting.*

| # | Item | Verdict |
|---|---|---|
| 1 | Dashboard | ✅ Implemented, role-aware |
| 2 | Student management | ✅ Implemented, incl. promotion |
| 3 | Parent management | ✅ Implemented — fully built, not planned |
| 4 | Teacher and staff management | ✅ Implemented |
| 5 | Class management | ✅ Implemented, with subject-teacher assignment |
| 6 | Result management | ✅ Implemented, with automatic computation |
| 7 | Report-card generation | ✅ Implemented — real A4 PDF, single and bulk |
| 8 | Fee recording | ✅ Implemented, plus two online gateways |
| 9 | Expenditure management | ✅ Implemented — built, not in development |
| 10 | Resource upload | ✅ Implemented |
| 11 | Comments in academic workflow | ✅ Implemented at two levels |
| 12 | Communication | ✅ Announcements, messages, email, SMS |
| 13 | User permissions | ✅ Enforced server-side on every route |
| 14 | Digital parent report access | ✅ Implemented — fee-gated |
| 15 | PDF report generation | ✅ Implemented, with QR verification |

---

## 27. Verified Feature Status

*This section replaces v1.0's "Features Requiring Confirmation".*

### Implemented — safe to show

Online payment gateway (Paystack, Flutterwave) · automated SMS (Twilio) · email (SendGrid) ·
attendance · class position and ranking · automatic grading · configurable grading scale and
assessment structure · report-card PDF generation · report-card printing (browser dialogue) ·
bulk class report cards · QR report verification · parent portal · student portal · fee waivers and
discounts · PDF payment receipts · student promotion · audit log · responsive web UI · light and
dark themes · PDF export.

### Not implemented — must not appear

Timetable · examination scheduling · biometric attendance · assignment submission and marking ·
live classes · library management · transport management (exists only as a *fee category*) ·
payroll · inventory · hostel management · AI features · application-level cloud backup ·
native mobile application · CSV or Excel export · push notifications · notification centre ·
WhatsApp integration · formal result approval or publishing workflow.

### Configuration-dependent — narrate conditionally

Online payment (requires gateway keys) · email delivery (requires SendGrid key) · SMS delivery
(requires Twilio credentials) · file storage (requires Cloudinary credentials). Where these are not
configured the system logs and continues; it does not fail. Use "where a gateway is connected" or
"where these are configured" rather than stating them unconditionally.

---

## 28. Risks and Production Considerations

**Risk 1 — Fabricated UI.** *Mitigation:* every screen filmed from the running application. §13
lists the twenty-six real screens. Three elements from v1.0 have already been removed on these
grounds: the notification centre, analytics charts, and proprietor/principal roles.

**Risk 2 — Feature mismatch.** *Mitigation:* resolved by this verification. Re-verify if the build
changes before the shoot.

**Risk 3 — Excessive feature density.** A 4½-minute video cannot cover everything. *Mitigation:*
the main film carries the principal workflow; §22's feature clips carry the detail.

**Risk 4 — Unclear financial claims.** *Mitigation:* recording an offline payment and processing an
online payment are shown as distinct workflows, and online payment is narrated as
configuration-dependent.

**Risk 5 — Overstated automation.** The system computes and compiles; it does not decide. A teacher
still enters every score and writes every comment. *Mitigation:* "the system calculates and
compiles", never "the system marks" or "the system writes".

**Risk 6 — Small UI on mobile.** *Mitigation:* separate mobile compositions, not crops. The report
card table is the tightest element and needs its own vertical treatment.

**Risk 7 — Unsupported security claims.** *Mitigation:* "controlled access" and "verifiable
records". No encryption, certification or compliance language (§25).

**Risk 8 — Overly promotional narration.** *Mitigation:* demonstrable workflows over adjectives.

**Risk 9 — Tone of the fee-linked release.** Fee-gated report cards can read as punitive toward a
child. *Mitigation:* frame as automatic, consistent policy enforcement that saves the office manual
checking. Never show a distressed parent or child, and never dwell on the restriction state — the
beat resolves into release.

**Risk 10 — Exposure of real or seeded data.** ⚠️ **New and important.** The repository's README
publishes working demo credentials. Filming the login screen with those credentials visible would
publish them further; filming production data would expose real children's names, photographs and
their families' fee arrears. *Mitigation:* build a dedicated demo dataset with fictional students
and photographs, use non-published credentials, and never film a typed password. See decision D4.

**Risk 11 — Single-school branding in a multi-school pitch. ✅ Resolved by design.** Every screen
carries one school's name, motto and address, and the audience is now proprietors at other schools —
so this was the film's biggest liability. It is resolved two ways: the demo runs under a neutral
fictional school rather than Carlspat's live data, and **Scene 22 shows the system being rebranded**,
turning the objection into a demonstration. See §8.14.

**Risk 12 — Implying multi-school capability. ⚠️ New and serious.** A proprietor audience invites
the pitch "manage all your schools in one place". **The system cannot do this.** It resolves the
school with `findFirst()` at twenty call sites and does not scope core queries by school at all. Any
frame or phrase implying a group view would be a false claim to a buyer. *Mitigation:* the
prohibition is stated in §25, in the shooting document's Scene 22 constraint, and on its printed
prohibitions page. Single-tenancy is narrated as an advantage — own installation, own data — which
is both true and more persuasive.

**Risk 13 — Overreaching on the fee lock.** For a buying audience the temptation is to claim the
fee-linked release improves collection. Nothing supports that. *Mitigation:* the narration describes
the mechanism, never an outcome, and §25 prohibits the quantified claim outright.

**Risk 14 — Demonstrated school type does not match the viewer's. ✅ Resolved.** Carlspat runs Crèche
to Primary 6, so a film built on its structure would tell every secondary proprietor the product is
not for them. *Resolution:* the demo school now runs Crèche through SSS 3, and the hero journey moved
into JSS 2 so the report card in Scene 12 is a secondary one. Scenes 5, 7, 8, 9 and 22 carry framing
notes requiring JSS and SSS to be held on screen rather than scrolled past.

---

## 29. Acceptance Criteria

The video is accepted when:

- The dashboard, student, parent, teacher, class, attendance, result, report-card, fee, expenditure,
  resource, comment and communication modules are each demonstrated.
- Report-card generation receives the greatest demonstration depth, including bulk generation.
- The fee-linked release is demonstrated as a distinct beat.
- QR verification is demonstrated.
- At least one complete academic workflow is shown end to end.
- At least one complete financial workflow is shown end to end.
- **The rebranding scene is present**, showing the system configured to the buyer's own school.
- **No frame or phrase implies multi-school management.**
- **No claim is made about fee collection improving.**
- The narration is in the second person throughout, and the product name is spoken nowhere.
- All six roles — and only those six — are represented, with the proprietor's own seat identified.
- Voice-over corresponds exactly to the UI action on screen.
- On-screen text corresponds to the narration.
- No unimplemented functionality is presented as existing.
- No charts, notification centre, or seventh role appear anywhere.
- No unsupported statistics, certifications or security claims are made.
- No real student data or working credentials appear in any frame.
- All placeholders are resolved and all §31 decisions closed.
- Subtitles are supplied and synchronised.
- Social adaptations and feature clips are delivered.
- Branding is consistent and the contact details are verified correct.
- UI animations never obscure the information being described.
- Production assets are organised and archived.

---

## 30. Final Production Checklist

**Resolved by verification**

- [x] Confirm school name — Carlspat Private School
- [x] Confirm brand colours — navy `#1e3a5f`, gold `#b8860b`
- [x] Confirm contact information — 08067281676 · carlspatprivateschool@outlook.com
- [x] Verify dashboard UI — cards and bars, no charts
- [x] Verify student, parent, teacher, class modules
- [x] Verify attendance module
- [x] Verify result module and grading configuration
- [x] Verify report-card workflow, PDF generation and printing
- [x] Verify bulk generation and QR verification
- [x] Verify parent digital access and the fee lock
- [x] Verify fee workflow, receipts, waivers and debtors
- [x] Verify online payment integration — Paystack, Flutterwave
- [x] Verify expenditure workflow
- [x] Verify resource upload and access
- [x] Verify comments — two levels
- [x] Verify communication — announcements, messages, email, SMS
- [x] Verify role permissions — six roles

**Outstanding**

- [x] **D1a** — ~~Positioning~~ — closed 13 Aug 2026: addresses proprietors at other schools
- [ ] **D1b** — **Confirm the product name** (blocks two title cards; does not block the voice-over)
- [x] **D2** — ~~Website~~ — closed 13 Aug 2026: no website; contact-only CTA on 08067281676
- [ ] **D3** — Supply the production logo asset
- [x] **D4** — ~~Prepare the fictional demo dataset~~ — scripted 13 Aug 2026 as
      `server/prisma/seed.demo.ts`. Crestview Public School, Crèche to SSS 3, hero in JSS 2.
      Run `npm run seed:demo -- --reset` against a dedicated demo database.
- [x] ~~Decide whether to add a JSS/SSS class set~~ — added 13 Aug 2026; hero moved to JSS 2
- [ ] Confirm the live grading scale and assessment weights match the seeded defaults
- [ ] Capture approved UI screens across all twenty-six routes
- [ ] Approve this storyboard
- [ ] Approve and record the voice-over
- [ ] Build UI animation and motion graphics
- [ ] Add music, sound effects and subtitles
- [ ] Technical accuracy review against this document
- [ ] Branding review
- [ ] Produce master 16:9
- [ ] Produce social versions, promotional cut and feature clips
- [ ] Final quality assurance
- [ ] Verify the CTA details are correct and reachable
- [ ] Export final deliverables

---

## 31. Open Decisions

Four decisions block production. Everything else is verified and ready.

**D1a — Positioning. ✅ CLOSED, 13 August 2026.** The film addresses **school proprietors at other
schools**, as a sales asset. Consequences, all now folded in: the narration is in the second person
throughout; parents and students appear as depicted beneficiaries rather than the addressed
audience; the demo runs under a neutral fictional school; and a new Scene 22 shows the system being
rebranded to the buyer's own school.

**D1b — Product name. ⚠️ OPEN.** The system has no brand distinct from Carlspat Private School, and
a competing proprietor will not buy a system named after another school. A neutral product name is
required.

*This does not block the voice-over.* The script is deliberately written so the product name is
**never spoken** — the narration says "a complete school management system" and "one platform for
your whole school". The name appears only as typography on two cards, Scene 3 and Scene 25. If the
name is settled late or changed after the first cut, two title cards are re-rendered and nothing is
re-recorded. Named alternates for both lines are held in the shooting document, to be recorded only
once a name is signed off. **Do not delay the shoot for the name.**

**D2 — Website. ✅ CLOSED, 13 August 2026.** No website exists. The call to action is contact-only:
telephone **08067281676** as the primary route, email carlspatprivateschool@outlook.com as the
secondary. The button reads "Contact the School". Scenes 23–24 are unblocked.

*Consequence to note:* with no website, the video itself becomes the school's shop window. It will
be distributed hand to hand — WhatsApp, Facebook, played on a phone or laptop in the school office
during an admissions conversation. That raises the priority of the WhatsApp-compressed and 9:16
mobile deliverables in §20, and it makes the contact card the only conversion point in the whole
film. It has to be legible on a phone held at arm's length.

**D3 — Logo asset.** The repository contains a placeholder mark only. A production logo file is
required for the opening, the report-card reveal and the close.

**D4 — Demo dataset. ✅ CLOSED, 13 August 2026.** Built as `server/prisma/seed.demo.ts` and verified
against a live database. Creates Crestview Public School — 16 classes from Crèche to SSS 3, 412
students, 26 teachers, 288 parents, the JSS 2 hero cohort with scores, comments, attendance, fees,
payments and expenditure. Deterministic, so a reshoot matches the first take, and anchored to the
run date so the dashboard's 30-day attendance rate is never empty.

The school is named **Crestview Public School** because the application hardcodes a "CPS" prefix for
admission numbers and receipts (`src/utils/ids.ts`); matching initials keep numbers generated live on
camera consistent with the seeded records, with no code change.

Still outstanding for the shoot: passport photographs (licensed stock or model-released). The seed
leaves `passportUrl` empty.

---

## Production Master Principle

The explainer tells one story:

**School information enters the system → authorised users manage it → academic and financial
activity is processed → information becomes verifiable reports and clear summaries → teachers,
parents, students and school leadership each access what belongs to them.**

The master visual sequence:

**Dashboard → Student → Class → Attendance → Results → Report Card → Verification → Fees Settled →
Report Released → Fees → Expenditure → Resources → Roles → CTA**

Report-card generation receives the greatest depth because it is where the modules visibly converge:
scores, attendance, grading configuration and comments becoming one document — and the fee-linked
release is where that convergence becomes an operational advantage rather than a claim.

**Accuracy over visual complexity.** A simple animation of the real application is always preferable
to an impressive animation of functionality the product does not have.
