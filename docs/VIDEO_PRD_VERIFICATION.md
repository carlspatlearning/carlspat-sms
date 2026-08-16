# Video Explainer PRD — Feature Verification & Resolution

**Companion to:** School Management System Video Explainer PRD v1.0
**Verified against:** `carlspat-sms` @ `9590887` (main), 13 August 2026
**Purpose:** Resolves every placeholder, assumption (§26) and confirmation item (§27) in the
PRD against the actual implemented application, so animation can begin without the risk of
depicting functionality that does not exist (§28, Risk 1 & 2).

Every verdict below cites the file that proves it.

---

## 1. Placeholder Resolution (PRD §30, items 1–6)

| Placeholder | Resolved value | Source | Status |
|---|---|---|---|
| `[SCHOOL NAME]` | **Carlspat Private School** | `server/prisma/schema.prisma:85` | ✅ Confirmed |
| `[SYSTEM NAME]` | **Carlspat School Management System** *(working name)* | `README.md:1` | ⚠️ Needs owner sign-off — see note below |
| Motto | *Emphasis on All-Round Development* | `server/prisma/schema.prisma:86` | ✅ Confirmed |
| Address | Surulere, Old Keye Water Factory, Opposite Luku Panel Beater, Ora Road, Ido Ekiti, Ekiti State, Nigeria | `server/prisma/schema.prisma:87` | ✅ Confirmed |
| `[CONTACT INFORMATION]` | 📞 08067281676 · ✉️ carlspatprivateschool@outlook.com | `server/prisma/schema.prisma:88-89` | ✅ Confirmed |
| `[WEBSITE]` | None — no public site exists | Confirmed by the school, 13 Aug 2026 | ✅ **Resolved** — CTA is contact-only |
| `[LOGO]` | `web/public/logo.svg` (placeholder mark); production logo is uploaded through Admin → School Settings | `web/public/logo.svg`, `schema.prisma:90` | ⚠️ Real logo asset required |
| `[BRAND COLOUR]` | **Navy `#1e3a5f`** | `server/src/services/pdfService.ts:50` | ✅ Confirmed |
| `[SECONDARY COLOUR]` | **Gold `#b8860b`** | `server/src/services/pdfService.ts:51` | ✅ Confirmed |
| `[ACCENT COLOUR]` | Grey `#555555` (document body); UI primary is `hsl(213 52% 25%)`, the same navy | `pdfService.ts:52`, `web/src/app/globals.css:11` | ✅ Confirmed |
| `[BRAND FONT]` | Helvetica family in generated PDFs; the web UI uses the Next.js default sans stack | `pdfService.ts` (`Helvetica`, `Helvetica-Bold`, `Helvetica-Oblique`) | ⚠️ No custom brand typeface exists |
| Currency | Nigerian Naira (₦), `NGN` | `schema.prisma:93`, `web/src/lib/utils.ts:8` | ✅ Confirmed |

**Note on `[SYSTEM NAME]`.** The codebase has no product brand distinct from the school. It is
named descriptively — "Carlspat Private School — School Management System". Before recording the
voice-over, the proprietor must decide whether the video markets *the school's own portal* (in which
case use "the Carlspat School Portal" or similar) or *a product sold to other schools* (which needs a
real product name, since the entire database is currently seeded and branded for one school).
This decision changes the CTA, the audience framing and the closing scene.

**Note on `[WEBSITE]`. ✅ Resolved 13 August 2026 — there is no website.** No public site is
referenced anywhere in the repository or its documentation, and the school has confirmed none
exists. The domain `carlspat.sch.ng` appears only in seeded demo login addresses
(`README.md:59-64`) and must not be shown on screen as though it were a live address. The call to
action is contact-only: telephone **08067281676**, email carlspatprivateschool@outlook.com.

---

## 2. Correction: the role model in PRD §6 does not match the system

This is the most significant discrepancy and it affects §4, §5, §6, §10, §12 (Scene 19) and §14.

The system implements **exactly six roles** (`schema.prisma:15-22`):

`SUPER_ADMIN` · `ADMIN` · `TEACHER` · `PARENT` · `STUDENT` · `ACCOUNTANT`

**There is no `PROPRIETOR` role and no `PRINCIPAL` / `HEAD_TEACHER` role.** The PRD's Persona A
(Proprietor) and its "Principal/Head Teacher" role row describe users who, in the real system,
would log in as `SUPER_ADMIN` or `ADMIN`. The head teacher exists only as a *name field* on the
school record and a *comment field* on the report card (`schema.prisma:92`, `schema.prisma:378`) —
not as an account type.

**Production impact:** Scene 19 ("Role switch" across multiple dashboards) must show the six real
dashboards, not a Proprietor dashboard. The voice-over line for Persona A should be re-attributed
to the administrator/owner logging in as an Admin. Do not animate a login screen or sidebar
containing a "Proprietor" or "Principal" role — that would be fabricated UI (Risk 1).

### Verified role-to-module access matrix

Taken directly from the navigation definition (`web/src/components/sidebar.tsx:21-38`) and
enforced server-side by `authorize(...)` in each route.

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

Two finer-grained rules worth showing on screen:
- Teachers **cannot** write the head-teacher comment; the API rejects it for `TEACHER`
  (`server/src/routes/results.ts:223`).
- Finance figures are stripped from the dashboard response entirely for non-finance roles —
  they are not merely hidden in the UI (`server/src/routes/dashboard.ts:37-40`).

---

## 3. Resolution of PRD §26 — Production Assumptions

| # | Assumption | Verdict | Evidence |
|---|---|---|---|
| 1 | Platform contains a dashboard | ✅ **Confirmed** | `server/src/routes/dashboard.ts`, `web/src/app/dashboard/page.tsx` |
| 2 | Student management exists | ✅ **Confirmed** | `routes/students.ts` (291 lines), `dashboard/students/` incl. new / edit / `[id]` / promote |
| 3 | Parent management exists | ✅ **Confirmed** — fully built, not planned | `routes/parents.ts`, `dashboard/parents/page.tsx` (372 lines) |
| 4 | Teacher/staff management exists | ✅ **Confirmed** | `routes/teachers.ts` (267 lines), `dashboard/teachers/page.tsx` (501 lines) |
| 5 | Class management exists | ✅ **Confirmed** | `routes/classes.ts`, `ClassRoom` + `ClassSubject` models |
| 6 | Result management exists | ✅ **Confirmed** | `routes/results.ts`, `services/resultService.ts` |
| 7 | Report-card generation exists | ✅ **Confirmed** — real A4 PDF generation | `services/pdfService.ts` (342 lines), `routes/reportCards.ts` |
| 8 | Fee recording exists | ✅ **Confirmed** | `routes/fees.ts` (312 lines), `routes/payments.ts` (394 lines) |
| 9 | Expenditure management exists | ✅ **Confirmed** — built, not "being developed" | `routes/expenses.ts`, `dashboard/expenditures/page.tsx` (334 lines) |
| 10 | Resource upload exists | ✅ **Confirmed** | `routes/resources.ts`, `Resource` model, `services/storage.ts` |
| 11 | Comments available in academic workflows | ✅ **Confirmed** | `TermReport.teacherComment` / `.headTeacherComment`, `dashboard/comments/page.tsx` |
| 12 | Communication functionality | ✅ **Confirmed** — announcements, internal messages, email + SMS | `routes/announcements.ts`, `routes/messages.ts`, `services/notify.ts` |
| 13 | User permissions | ✅ **Confirmed** — enforced server-side | `middleware/auth.ts`, `authorize()` on every route |
| 14 | Digital parent report-card access | ✅ **Confirmed — but fee-gated.** See §5 below | `routes/reportCards.ts:21-24` |
| 15 | PDF report generation | ✅ **Confirmed** — PDFKit, A4, with QR verification | `services/pdfService.ts:55` |

**All fifteen assumptions resolve in favour of the product.** Nothing in §26 needs to be cut.

---

## 4. Resolution of PRD §27 — Features Requiring Confirmation

### ✅ Implemented — safe to show

| Feature | Evidence | Notes for production |
|---|---|---|
| **Online payment gateway** | `routes/payments.ts:259-350` | **Two** gateways: Paystack and Flutterwave, with signed webhooks (`:48-90`). Live only when API keys are configured (`config/env.ts:32-36`). |
| **Automated SMS** | `services/notify.ts:34` | Twilio REST API. Used for announcement broadcasts. |
| **Email integration** | `services/notify.ts:9` | SendGrid. Used for announcements and payment receipts. |
| **Attendance** | `routes/attendance.ts`, `dashboard/attendance/page.tsx` | Present / Absent / Late; feeds a 30-day attendance rate on the dashboard and a per-term summary on the report card. |
| **Position / ranking** | `services/resultService.ts:184-207` | Dense ranking — tied students share a position. |
| **Automatic grading** | `services/resultService.ts:107`, `utils/grading.ts` | Grade + remark resolved from the configured scale. |
| **Configurable grading systems** | `GradeScale` model, `dashboard/settings/page.tsx` | Admin-editable bands. Assessment types and max scores are configurable too (`AssessmentType`). |
| **Report-card PDF generation** | `services/pdfService.ts:55` | A4, school logo, student passport photo, QR code. |
| **Report-card printing** | `dashboard/report-cards/page.tsx:209` | Via the browser print dialog on the generated PDF — *not* a dedicated in-app print engine. Narrate accordingly. |
| **Parent portal** | `routes/dashboard.ts:125-144` | Parent dashboard lists each linked child with class and outstanding balance. |
| **Student portal** | `routes/dashboard.ts:146-166` | Own class, results, resources, fee status. |
| **Data export** | `reportCards.ts:110`, `payments.ts:215` | **PDF only** — report cards (single + whole class) and payment receipts. There is **no** CSV or Excel export. |
| **API integrations** | `config/env.ts` | Cloudinary (file storage), Paystack, Flutterwave, SendGrid, Twilio. |

### ❌ Not implemented — must NOT appear in the video

Timetable · Examination scheduling · Biometric attendance · Assignment submission & grading ·
Live classes · Library management · Transport management · Payroll · Inventory ·
Hostel/boarding management · AI features · Cloud backup (application-level) · Native mobile app

Two of these need care because they are *near-misses*:

- **Assignment management.** `ResourceType.ASSIGNMENT` exists (`schema.prisma:68`), so a teacher can
  *distribute* an assignment file. There is no submission, no upload-by-student, no marking flow.
  Narrate this as resource sharing, never as "assignment management".
- **Transport.** The word appears once, as an example of a *fee category*
  (`dashboard/fees/page.tsx`) — a line item on an invoice, not a transport module.

### ⚠️ Qualified

- **Push notifications** — not implemented. Delivery is email, SMS and in-app announcements/messages.
  There is no notification centre, no bell icon, no push. **PRD Scene 17 ("Notification centre",
  "Notification appears") depicts UI that does not exist and must be re-storyboarded** as the
  Announcements screen or the Messages screen.
- **WhatsApp integration** — not implemented. Twilio is configured for SMS only
  (`services/notify.ts:40`).
- **Mobile application** — no native app. The web UI *is* responsive (Tailwind `sm:`/`lg:`
  breakpoints throughout) and has a light/dark theme (`components/theme-toggle.tsx`). Safe line:
  "works on phones, tablets and desktops." Unsafe line: "download our app."

---

## 5. Verified features the PRD omits — and one of them should lead the video

The PRD was written without sight of the code, so it misses several implemented capabilities.
Three are strong enough to change the edit.

### 5.1 The Report Card Fee Lock — the single most distinctive feature

> Parents and students can only view, download or print a report card when the term's fees are
> **fully paid**. With any balance outstanding the API returns HTTP 402 and the portal shows:
> *"Access to report card is restricted until school fees have been fully paid."*
> Staff always bypass the lock so the school can prepare and review reports.

Source: `routes/reportCards.ts:16-24`, `services/feeService.ts`, `dashboard/report-cards/page.tsx:199`.

This is a genuine commercial argument — it links the academic and financial modules into one
enforcement mechanism, which is precisely the "connected school" thesis of §1. **Recommendation:
give it its own beat between the Report Card section (1:50–2:30) and the Fees section (2:30–2:55).**
It is the clearest demonstration in the product that the modules are not merely co-located.

Handle the tone carefully: frame it as *fee-settlement policy enforced automatically*, not as
withholding a child's results. Suggested line: *"Because fees and academic records live in the same
system, the school can set report cards to release automatically once a term's fees are settled."*

### 5.2 QR-verified, tamper-evident report cards

Every generated report card carries a QR code containing an HMAC-SHA256 signature. Scanning it
opens a public verification page confirming the student, admission number, class and term —
and flags an invalid signature.

Source: `pdfService.ts:32-38`, `reportCards.ts:177-202`, `web/src/app/verify-report/`.

This is highly filmable (phone scans printed report → verification page appears) and speaks
directly to result forgery, a real concern for Nigerian secondary schools. **Recommendation: add
to Scene 11, replacing part of the generic "zoom into sections" action.**

### 5.3 Bulk report-card generation for a whole class

One click produces a single merged PDF containing every active student's report card in a class
(`reportCards.ts:136-175`, via `pdf-merger-js`). Students without recorded results are skipped
silently. This is the strongest possible visual for the "replaces manual compilation" claim in §14
— one action, forty report cards.

### Also implemented, not mentioned in the PRD

| Feature | Evidence | Video value |
|---|---|---|
| **Student promotion workflow** | `Promotion` model, `dashboard/students/promote/` | Promoted / Repeated / Graduated, end-of-session |
| **Automatic promotion recommendation** | `resultService.ts:160-163` | Average ≥ 50% → PROMOTED, below → REPEAT, stamped on the report card |
| **Cumulative / multi-term reporting** | `resultService.ts:71-114` | 2nd and 3rd term reports carry forward earlier term totals and a session average |
| **Fee waivers & discounts** | `routes/fees.ts:203-241`, `FeeWaiver` model | Scholarships, staff-child discounts |
| **Per-student fee items** | `StudentFeeItem` model, migration `0003` | Charges beyond the standard class structure |
| **Numbered PDF payment receipts** | `payments.ts:215-254`, `utils/ids.ts` | Sequential receipt numbers |
| **Gateway payments are immutable** | `payments.ts:196-199` | Confirmed online payments cannot be edited — a correcting entry is required. A real audit-integrity point. |
| **Audit log** | `AuditLog` model, `middleware/audit.ts` | Who did what, when |
| **Debtors report** | `dashboard/page.tsx:105` | "View debtors report →" |
| **Income vs expenditure net balance** | `dashboard.ts:77` | Current-term income, expenditure and net balance in one card |
| **Dark mode** | `components/theme-toggle.tsx` | Worth two seconds of screen time |

---

## 5.4 ⚠️ The system is single-tenant — one deployment per school

*Added 13 August 2026, after the decision to address proprietors at other schools. This was not
relevant while the video targeted one school's own parents; it is now central.*

**The application manages one school per installation.** It cannot manage several schools from one
place, and it has no school-switcher, no group console and no tenant isolation.

Evidence:

- Every route resolves the school with `prisma.school.findFirst()` — **twenty call sites** across
  `settings.ts`, `students.ts`, `fees.ts`, `classes.ts`, `teachers.ts`, `parents.ts`, `expenses.ts`,
  `resources.ts`, `announcements.ts`, `payments.ts`, `reportCards.ts` and `subjects.ts`. Whichever
  school row comes back first is used, regardless of who is logged in.
- Core aggregate queries carry no school filter at all — `prisma.student.count({ where: { status:
  "ACTIVE" } })` and `prisma.teacher.count()` in `dashboard.ts:19-20`, `classRoom.findMany` in
  `classes.ts:17`.
- The authenticated session carries `sub` and `role` (`middleware/auth.ts`); tenant identity is not
  part of the authorisation path.

The `School` model and the `schoolId` columns exist throughout the schema, so the groundwork is
there — but nothing enforces isolation today. Loading a second school into the same database would
produce cross-contaminated dashboards and reports.

### What this means for the video

**Prohibited:** any claim, caption or animation implying multi-school management — a school
switcher, a group or proprietor console spanning schools, "manage all your schools in one place",
or a customer list of schools inside the product.

**Permitted, and worth saying plainly:** each school gets its **own installation with its own
database**. For a proprietor evaluating the system, single-tenancy is a genuine advantage, not an
apology — their data sits in their own instance, not pooled with other schools', and the whole
system carries their branding.

### It also solves the branding problem

Every screen currently shows "Carlspat Private School". A prospective buyer watching another
school's name throughout is the obvious objection to this film.

The school name, motto, address, phone, email and logo are all editable from Admin → School Settings
(`routes/settings.ts`, and stated in `README.md`), as are academic sessions, classes, subjects, the
grading scale and the assessment structure. **Filming that settings screen — the school name and
logo changing, and the new identity appearing on a generated report card — turns the objection into
a demonstration.** It is honest, it is verified, and it answers the buyer's question directly.

This is now a scene in the shooting document.

### One further note on fit ✅ Resolved 13 August 2026

Carlspat is a crèche-to-Primary-6 school, so a demo built on its structure would show only Nursery
and Primary classes — telling every secondary-school proprietor that the product is not for them.
Class names, subjects, assessment types and grading bands are all configurable, so the product fits;
the demo simply did not show it.

**Resolved by extending the demo dataset to sixteen classes, Crèche through SSS 3, and moving the
hero journey into JSS 2.** The report card in the film's strongest shot is now a secondary one — nine
subjects, class position, promotion decision — while primary and nursery classes stay visible in every
class list. No code change was required: classes are created through the UI, so this is demo data,
not a product change.

---

## 6. Corrections required to §11, §12 and §14 before recording

| PRD element | Problem | Required change |
|---|---|---|
| §6 role table | Proprietor and Principal roles do not exist | Use the six real roles (§2 above) |
| Scene 17 — Notification centre | No such screen exists | Re-storyboard as Announcements or Messages |
| Scene 18 — "Charts", "Dashboard zoom" | **No charting library is installed.** The dashboard uses stat cards, coloured summary panels and simple proportional bars for class performance (`dashboard/page.tsx`) | Animate the real stat cards and performance bars. Do not draw line or pie charts — that is fabricated UI (Risk 1) |
| §16 "Chart drawing" motion technique | Same as above | Replace with number counters on the real stat cards |
| Scene 21 — Security / "lock animation" | Justified: JWT with refresh-token rotation and `tokenVersion` invalidation, bcrypt password hashing, server-side `authorize()`, audit log, HMAC-signed report cards | Keep the scene, but keep §25's language limits — "controlled access", no encryption or compliance claims |
| §14 Fees paragraph — "Where online payment integration is available…" | Hedged unnecessarily; two gateways are implemented | State it plainly: card and bank transfer through Paystack or Flutterwave, once the school's keys are configured |
| §14 Communication paragraph — "The exact communication features depend on the configuration" | Now resolved | Name them: announcements to selected audiences, internal messages, email and SMS delivery |
| §12 Scene 10 (35s) — "Generate Report Card" | Under-serves the strongest asset | Extend using bulk class generation (§5.3) and the QR verification (§5.2) |
| §22 Feature clips | Missing the differentiator | Add a 30–45s clip: "Report cards released when fees are settled" |
| §8.12 `[CONFIRM COMMUNICATION FEATURE]` | Resolved | Remove the placeholder |

### Claims that remain prohibited (§25)

Verification supports **no** claim about uptime, cybersecurity certification, encryption standards,
regulatory compliance, automatic backup or AI. Nothing found in the codebase changes this.
Payment gateway integration and mobile-responsive access are now *permitted* claims; a native
mobile app is still not.

---

## 7. Revised narrative timings (§11)

> ⚠️ **Superseded — kept as a record of the first pass.** These timings were the initial correction
> for feature accuracy only. They have since been retimed twice: once to fix an arithmetic error
> (the scene durations did not sum to the stated total), and again when the film was repositioned for
> a proprietor audience and a rebranding scene was added. **The current runtime is 5:00 across 25
> scenes.** For live timings use the [shooting document](VIDEO_SHOOTING_DOCUMENT.md) §7, which is
> authoritative. Do not schedule or budget from the table below.

Adjusted to reflect what exists, keeping the 4′30″ target. Changes marked ▶.

| Time | Section | Change |
|---|---|---|
| 0:00–0:20 | The Challenge | unchanged |
| 0:20–0:40 | The Solution | unchanged |
| 0:40–1:00 | Dashboard | ▶ stat cards, financial summary, class performance bars — no invented charts |
| 1:00–1:25 | Students & Parents | unchanged |
| 1:25–1:50 | Teachers & Classes | ▶ include attendance marking (confirmed implemented) |
| 1:50–2:35 | Results & Report Cards | ▶ +5s; ends with bulk class generation and the QR scan |
| 2:35–2:50 | **Fee-linked release** | ▶ **new** — the fee lock (§5.1) |
| 2:50–3:10 | Fees | ▶ shortened; record a payment, issue a numbered receipt, show the debtors view |
| 3:10–3:25 | Expenditure | ▶ shortened |
| 3:25–3:40 | Resources | unchanged |
| 3:40–3:55 | Comments & Communication | ▶ merged; announcements + messages, no notification centre |
| 3:55–4:15 | Benefits & Roles | ▶ six real roles |
| 4:15–4:30 | CTA | ✅ resolved — contact-only, telephone primary |

---

## 8. Outstanding decisions before production starts

Four items block the shoot. Everything else is verified.

1. **Product identity** — is this the school's own portal, or a product sold to other schools?
   Determines `[SYSTEM NAME]`, the audience framing and the CTA.
2. ~~**Website URL**~~ — ✅ closed 13 Aug 2026: no website. CTA is telephone 08067281676, email secondary.
3. **Production logo file** — `web/public/logo.svg` is a placeholder mark.
4. **Which demo data appears on screen** — the seeded accounts and their passwords are published in
   `README.md:57-64`. Real student names, photographs and fee balances must not be filmed. Prepare a
   dedicated demo dataset with fictional students, and never film the seeded passwords or the login
   form with credentials typed in.

---

## 9. Updated §30 checklist status

| Checklist item | Status |
|---|---|
| Confirm [SYSTEM NAME] | ⚠️ Decision required |
| Confirm [SCHOOL NAME] | ✅ Carlspat Private School |
| Confirm logo | ⚠️ Production asset required |
| Confirm brand colours | ✅ Navy `#1e3a5f` / Gold `#b8860b` |
| Confirm website | ✅ Resolved — none exists; contact-only CTA |
| Confirm contact information | ✅ 08067281676 · carlspatprivateschool@outlook.com |
| Verify dashboard UI | ✅ (no charts — cards and bars) |
| Verify student module | ✅ |
| Verify parent module | ✅ |
| Verify teacher/staff module | ✅ |
| Verify class module | ✅ |
| Verify result module | ✅ |
| Verify grading configuration | ✅ Admin-editable scales and assessment types |
| Verify report-card workflow | ✅ |
| Verify report-card PDF generation | ✅ PDFKit A4 + QR |
| Verify report-card printing | ✅ Browser print dialog on the PDF |
| Verify parent digital access | ✅ Fee-gated |
| Verify fee-management workflow | ✅ |
| Verify online payment integration | ✅ Paystack + Flutterwave (keys required) |
| Verify expenditure workflow | ✅ |
| Verify resource upload | ✅ Cloudinary-backed |
| Verify resource access | ✅ |
| Verify comments | ✅ Two-tier, teacher-restricted |
| Verify notifications | ⚠️ Email/SMS/announcements — no notification centre |
| Verify communication | ✅ Announcements + internal messages |
| Verify role permissions | ✅ Six roles, enforced server-side |

Remaining checklist items are production tasks and are unaffected by this verification.
