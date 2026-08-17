# School Management System — Explainer Video
# Shooting Document

**Version:** 2.1 — proprietor audience, full crèche-to-SSS demo school
**Supersedes:** v2.0 (proprietor audience, primary-only demo) · v1.0 (one school's own community)
**Runtime:** 5 minutes 00 seconds · 25 scenes
**Audience:** School proprietors and owners evaluating the system for **their own school**
**Language:** British English
**Format:** Screen-capture led, motion-graphics assisted
**Derived from:** [VIDEO_PRD.md](VIDEO_PRD.md) · verified against build `9590887`

---

## How to use this document

This is the shooting and edit reference. It is self-contained: an animator, editor or voice artist
can work from it without the PRD.

- **§1–§4** — everything to settle before capture begins.
- **§5** — the shot list. One block per scene: what is on screen, what happens, what is said.
- **§6** — the voice-over script as a clean continuous read for the recording booth.
- **§7** — timing summary for the edit.
- **§8** — the prohibitions. Print this page and pin it up.

Voice-over is quoted **verbatim**. Do not paraphrase in the booth; the wording has been checked
against what the software actually does, and small changes can turn an accurate line into a false
claim. Any wording change must come back to the PRD owner.

### What changed in v2.0

The film now sells the system to proprietors at other schools rather than explaining it to one
school's own parents. Three consequences run through everything below:

1. **The narration is in the second person.** "Your school", "your teachers", "your bursar". The
   viewer is a decision-maker, not a parent.
2. **A new Scene 22 answers the obvious objection** — *why am I looking at another school's name?*
   It shows the system being rebranded to the buyer's own school.
3. **The product name is spoken nowhere.** It appears on two cards only. See §1.

### What changed in v2.1

The demo school now runs **Crèche through SSS 3** — sixteen classes spanning nursery, primary,
junior and senior secondary — and **the hero journey moved from Primary 5 to JSS 2**.

The reason is audience reach. A secondary-school proprietor watching a film in which every class is
"Nursery 2" or "Primary 4" concludes the product is built for primary schools and stops watching.
Moving the hero into JSS 2 puts a genuine secondary report card — nine subjects, class position,
promotion decision — into Scene 12, the most persuasive shot in the film, while the full ladder stays
visible in every class list so primary and nursery proprietors are covered too.

Consequences, all folded in below: the dashboard figures are rebuilt for a 412-student school
(§3); JSS 2 fees replace Primary 5 fees, at ₦86,000 a term; the bulk-generation stack is thirty-two
cards rather than twenty-eight; and Scenes 5, 7, 8, 9 and 22 now carry explicit framing notes to keep
JSS and SSS on screen rather than scrolled past. **No voice-over line changed** — the read is
unaffected, because the script never names a class.

---

## 1. Blocking items

| Ref | Decision | Status | Affects |
|---|---|---|---|
| **D1a** | Positioning — who the film addresses | ✅ **Closed 13 Aug 2026** — proprietors at other schools | Whole script |
| **D1b** | **Product name** | ⚠️ **OPEN — blocks the name cards** | Scenes 3 and 25 |
| **D2** | Website | ✅ Closed — none exists; contact-only CTA on 08067281676 | Scenes 24–25 final |
| **D3** | Production logo | ⚠️ Open — repository holds a placeholder | Scenes 3, 12, 22, 24 |
| **D4** | Demo dataset | ✅ **Scripted** — `npm run seed:demo -- --reset`, see §3 | Every scene from 4 onward |

### D1b — the product needs a name, and it is not the school's name

The system has no brand distinct from Carlspat Private School. Selling it to other schools under a
competitor's name will not work: a proprietor is being asked to run their school on something called
*Carlspat*.

**This does not have to block voice-over recording.** The script in §6 is written so that the
product name is **never spoken**. The narration says "a complete school management system" and
"one platform for the whole school". The name appears only as on-screen typography in Scene 3 and
Scene 25.

That is deliberate risk management: if the name is settled late, or changed after the first cut,
**two title cards are re-rendered and nothing is re-recorded.** Keep it that way — do not let a name
creep into the read.

A named variant of both lines is provided in §6 as an alternate, to be recorded only once the name
is signed off and the owner wants it spoken.

---

## 2. Global style

**Tone.** This is a considered business purchase, not a consumer app. Calm, credible, unhurried.
The buyer is judging whether the software is real and whether it fits their school — so the software
must be on screen, working, doing recognisable school administration. Resist hype.

**Pacing.** Deliberate. The cursor travels, pauses briefly before a click, and the interface is
allowed to respond before the shot cuts. Never race the cursor to make the product look fast — the
software is the hero and it should look calm.

**Capture.** 3840 × 2160, 25 fps, desktop viewport at 1440 × 900 scaled up, browser chrome cropped
out entirely. Light theme throughout except Scene 21, which carries the one dark-theme moment.

**Palette.** Navy `#1e3a5f` primary · Gold `#b8860b` accent · Grey `#555555` body. These come from
the system's own report card renderer, so the video's graphics and the product's documents match on
screen.

**Typography.** Motion-graphic captions in a clean geometric sans, sentence case, navy on white or
white on navy. Captions sit lower-third left, clear of the interface's own navigation.

**Cursor.** Standard arrow with a soft 12px glow, no comet trail. Click produces a single subtle
ring pulse.

**Audio bed.** Modern corporate, warm rather than driving. Establish under Scene 1, build into
Scene 3, hold, pull back approximately 4 dB under Scenes 9–14 where the explanation is densest,
lift at Scene 15, lift again at Scene 22, resolve at Scene 24.

**Sound effects.** Soft key clicks during typing · single soft tone on save · a distinct low
document tone at Scene 12 as the report card resolves · a light rising tone at Scene 15 as the
report unlocks · gentle whooshes on major transitions only, not on every cut.

---

## 3. Demo dataset

**All data below is fictional. It is built by a script, not by hand.**

Do not film production data — it contains real children's names, photographs and their families'
fee arrears. Do not film the demo credentials published in the repository README, and never film a
password being typed. Passport photographs must be licensed stock or model-released.

### Loading it

Every figure in this section is produced by `server/prisma/seed.demo.ts`. Point `DATABASE_URL` at a
dedicated demo database and run:

```bash
npm run seed:demo -- --reset
```

The script wipes the target database first, so never point it at production. It prints a
reconciliation table on completion — **check those numbers against this section before filming.**
The dataset is deterministic: the same run produces the same students, scores and balances, so a
reshoot weeks later matches the first take.

The academic calendar is anchored to the day you run it — the current term always ends two weeks
out. This matters: the dashboard's attendance rate only counts the last thirty days, so a fixed
calendar would read 0% at any later shoot date.

### The school on screen

Because the system runs one school per installation, whatever school is configured appears
throughout. **Scene 22 depends on the demo school being one the buyer can imagine replacing with
their own**, so it has a plausible, clearly fictional identity rather than Carlspat's live data.

**Crestview Public School** — *Knowledge, Character, Service* — 14 Ajilosun Road, Ado Ekiti.

The name is not arbitrary. The application hardcodes a **"CPS"** prefix when it generates admission
numbers (`CPS/<year>/<seq>`) and receipts (`CPS-RCP-<year>-<seq>`) in `src/utils/ids.ts`. A demo
school whose initials are CPS keeps the numbers generated live on camera in Scenes 5 and 16
consistent with the seeded records — no code change, and "Carlspat" never appears on screen. Any
other demo name would put a mismatched prefix in frame the moment a student is registered.

### Class ladder — crèche to SSS 3

The demo school spans **nursery, primary and secondary**, so a proprietor of any of the three sees
their own structure on screen. Sixteen classes:

| Section | Classes |
|---|---|
| Early years | Crèche · Nursery 1 · Nursery 2 · Kindergarten |
| Primary | Primary 1 · Primary 2 · Primary 3 · Primary 4 · Primary 5 · Primary 6 |
| Junior secondary | **JSS 1 · JSS 2 · JSS 3** |
| Senior secondary | **SSS 1 · SSS 2 · SSS 3** |

This matters more than it looks. A secondary-school proprietor watching a film full of "Nursery 2"
and "Primary 4" concludes the product is for primary schools and stops watching. The full ladder
must be visible wherever a class list or dropdown opens — Scenes 5, 7, 8, 9 and 22.

**The hero journey runs through JSS 2**, so the report card in Scene 12 — the most persuasive shot
in the film — is a secondary report card with nine subjects, class position and a promotion
decision. Primary and nursery structure stays visible in every class list, so primary proprietors
are covered without the hero having to be a primary pupil.

### Session and class

Session **2025/2026** · **Third Term** (current) · Hero class **JSS 2** · 32 students
Form teacher **Mr Tunde Bakare** (CPS/STF/001, B.Ed, Mathematics)
Second teacher **Miss Chioma Okafor** (CPS/STF/002, B.Sc, English)

### Hero student

| Field | Value |
|---|---|
| Name | Adaeze Nwosu |
| Admission no. | CPS/2024/0118 |
| Class | **JSS 2** |
| Gender | Female |
| Parent | Mrs Ngozi Nwosu |
| Sibling | **Chidi Nwosu, Primary 2** |

The sibling is deliberately in the primary section. One parent profile then shows a child in JSS and
a child in Primary side by side — demonstrating the multi-child parent view *and* the school's full
span in a single frame (Scene 6).

### Hero result — JSS 2, Third Term, 2025/2026

Assessment structure: **CA 1 / 20 · CA 2 / 20 · Exam / 60 · Total 100**

**Rows appear in this order** — the system sorts subjects alphabetically, not by curriculum
importance. Storyboard Scene 12 against this order, not a syllabus order.

| # | Subject | CA 1 | CA 2 | Exam | Total | Grade | Remark |
|--:|---|--:|--:|--:|--:|:--:|---|
| 1 | Basic Science | 14 | 15 | 43 | 72 | A | Excellent |
| 2 | Basic Technology | 13 | 14 | 40 | 67 | B | Very Good |
| 3 | Business Studies | 14 | 13 | 41 | 68 | B | Very Good |
| 4 | Civic Education | 15 | 16 | 44 | 75 | A | Excellent |
| 5 | Computer Studies | 12 | 13 | 36 | 61 | B | Very Good |
| 6 | English Language | 16 | 15 | 47 | 78 | A | Excellent |
| 7 | Mathematics | 18 | 17 | 50 | 85 | A | Excellent |
| 8 | Social Studies | 13 | 14 | 38 | 65 | B | Very Good |
| 9 | Yoruba Language | 15 | 14 | 42 | 71 | A | Excellent |

**Total 642 / 900 · Average 71.3% · Grade A (Excellent) · Position 4th of 32 · PROMOTED**

Attendance: Present 58 · Late 3 · Absent 4 · Total 65 days

> Every line above was read off a generated report card, not designed on paper. Mathematics is the
> top row visually only in the sense of being the highest score — it sits seventh down the page.
> Scene 12's "scores fly into the table" animation should land 18 / 17 / 50 in **row 7**.

**Teacher's comment:** "Adaeze has worked steadily throughout the term and her mathematics has
improved noticeably. She should give more attention to Computer Studies."

**Head teacher's comment:** "A pleasing result. Keep it up."

> **Nine subjects is a deliberate ceiling.** A real JSS 2 timetable may carry thirteen or more, and
> the system prints every subject entered — but past nine the table stops being legible on a phone,
> and this report card has to survive WhatsApp compression and a 9:16 crop. Nine reads as a genuine
> secondary report while staying filmable. If the owner wants the fuller curriculum on screen,
> Scene 12's scroll must slow and the vertical version needs a two-pass treatment.

> Verify against the live system before filming: an administrator can change both the assessment
> weights and the grade bands from School Settings. If the configuration on the filmed instance
> differs from CA 20 / CA 20 / Exam 60 and the A–F bands, this table and the report card frames must
> be rebuilt to match. **Filming a grading scale that does not match the running system is a factual
> error on screen.**

### Fees — JSS 2, Third Term

Secondary fees run higher than primary, which is realistic and also makes the financial screens more
persuasive to a secondary proprietor.

| Category | Amount |
|---|--:|
| Tuition Fee | ₦68,000 |
| PTA Fee | ₦2,500 |
| Examination Fee | ₦4,000 |
| Development Levy | ₦6,000 |
| Laboratory Levy | ₦5,500 |
| **Term total** | **₦86,000** |

Transport Fee (₦12,000) exists as a category but is **not** billed by default — leave it unticked.
Worth a beat: it demonstrates optional per-student billing.

**Scene 15 sequence:** paid ₦66,000 → outstanding **₦20,000** → payment recorded ₦20,000 →
balance **₦0** → report card releases.

**Receipt numbering.** The seed creates 392 payments, `CPS-RCP-<year>-00001` through `-00392`; the
hero's ₦66,000 is `-00001`. A payment recorded on camera in Scene 16 continues the run at
**`-00393`**, because the application reads the highest existing number and increments. Method
**Bank Transfer**.

### Dashboard figures

**These are the values a seeded database actually produces** — read off a completed run, not
invented. The seed prints the same table on completion; they should match exactly.

| Metric | Value |
|---|--:|
| Active students | 412 |
| Teachers | 26 |
| Parents | 288 |
| **Classes** | **16** |
| Attendance rate | 94.2% |
| Fees expected | ₦24,442,000 |
| Fees collected | ₦19,650,000 |
| Discounts / waivers | ₦420,000 |
| **Outstanding** | **₦4,372,000** |
| Collection rate | 80.4% |
| Term income | ₦19,650,000 |
| Term expenditure | ₦13,780,000 |
| **Net balance** | **₦5,870,000** |

Checks: expected − waivers − collected = outstanding · collected ÷ expected = collection rate ·
income − expenditure = net balance. All three resolve.

### Class performance bars

Verified against a seeded database — this is what the dashboard renders:

| Class | | Class | |
|---|--:|---|--:|
| Crèche | 66.0% | Primary 6 | 64.9% |
| Nursery 1 | 67.2% | JSS 1 | 60.2% |
| Nursery 2 | 68.4% | **JSS 2** | **61.4%** |
| Kindergarten | 69.2% | JSS 3 | 62.8% |
| Primary 1 | 65.9% | SSS 1 | 59.6% |
| Primary 2 | 64.3% | SSS 2 | 60.9% |
| Primary 3 | 63.7% | SSS 3 | 63.5% |
| Primary 4 | 62.1% | | |
| Primary 5 | 63.4% | | |

> **Why the class averages sit in the sixties, not the seventies.** The hero averages 71.3% and her
> report card says she is 4th of 32. Both numbers are on screen — the average in Scene 10, the
> position beside it. If JSS 2 averaged 71% she would be roughly median, and a viewer who reads both
> figures would catch the contradiction. A class mean of 61.4% is what makes 4th place true, and it
> is the more credible number anyway.

> A collection rate of 80.4% with ₦4.37m outstanding is deliberately realistic rather than
> flattering. A proprietor who recognises the problem will trust the demonstration more than one
> showing 100% collected. Do not "improve" these figures — every one of them is load-bearing
> somewhere else in the film.

### Scene 22 rebranding assets

Two identities are needed, since the scene shows one becoming the other:

| | Before | After |
|---|---|---|
| Name | Crestview Public School | **Your School Name** |
| Motto | Knowledge, Character, Service | **Your Motto Here** |
| Logo | fictional mark | generic placeholder mark |

The "after" state should read as a template a buyer mentally fills in — deliberately generic, not a
second fictional school. A second invented school would just raise the same objection again.

**Scene 22 must open the class list.** With the full ladder loaded, the highlight pass over classes
shows Crèche through SSS 3 in one scroll — which does more to prove "it fits your school" than the
narration does. Frame it so JSS and SSS are on screen, not scrolled past.

### Other assets

- **Expenditure:** Category *Utilities* · "Diesel for generator — June" · ₦38,500 · dated inside the
  active term
- **Resource:** "JSS 2 Mathematics — Simple Equations" · type *Lesson Note* · class JSS 2 · PDF, 480 KB
- **Announcement:** "Third Term examinations begin Monday. Please ensure all fees are settled." ·
  audience *Parents*

---

## 4. Screens required

Capture from the running application before animation begins.

| Scene(s) | Screen | Route |
|---|---|---|
| 3 | Login | `/login` |
| 4, 18, 21 | Staff dashboard | `/dashboard` |
| 15, 21 | Parent dashboard | `/dashboard` as Parent |
| 21 | Student dashboard | `/dashboard` as Student |
| 5 | Student list, then registration | `/dashboard/students`, `/students/new` |
| 6 | Parent profile with two linked children | `/dashboard/parents` |
| 7 | Class management | `/dashboard/classes` |
| 8 | Attendance register | `/dashboard/attendance` |
| 9, 10 | Result entry and computed result | `/dashboard/results` |
| 11 | Report comments | `/dashboard/comments` |
| 12, 13 | Report cards, single and bulk | `/dashboard/report-cards` |
| 12, 22 | Generated report card | server-rendered A4 PDF |
| 14 | Public verification page | `/verify-report` |
| 15, 17 | Fees — parent view and debtors | `/dashboard/fees` |
| 16 | Fee structure, payment, receipt | `/dashboard/fees`, `/dashboard/payments` |
| 18 | Expenditures | `/dashboard/expenditures` |
| 19 | Resources | `/dashboard/resources` |
| 20 | Announcements and messages | `/dashboard/announcements`, `/messages` |
| 21 | Teacher and accountant dashboards | `/dashboard` per role |
| **22** | **School settings — identity, grading, classes** | `/dashboard/settings` |

**Scene 14 is the only live-action shot** — a hand holding a phone, scanning the QR code on a
printed report card. Plan a separate mini-setup: printed A4 report, plain desk, soft key light,
phone screen legible in frame.

**Scene 22 needs two captures of the same screens** — before and after the identity change — plus a
regenerated report card carrying the new name. Capture the report card twice in the same session so
the layout is identical and only the identity differs.

---

## 5. Shot list

---

### Scene 1 · 0:00–0:10 · 10s · The Challenge

**Screen:** None — live action or photographic montage.

**On screen:** A school office. A stack of paper registers. A hand-ruled mark sheet with columns of
scores. A hard-backed fee book with entries in biro. Shallow depth of field, warm practical light.

**Action:** Three slow cuts, roughly 3 seconds each. Papers settle onto a pile on the third.

**Voice-over:**
> "Running a school involves far more than teaching."

**On-screen text:** *School management is complex.* — fades in at 0:06, lower third.

**Audio:** Music establishes low. Paper handling, distant classroom ambience.

**Note:** Warm and human, not bleak. The viewer is a proprietor who recognises this office as their
own — the shot should feel familiar, not accusatory. No stressed or unhappy staff.

---

### Scene 2 · 0:10–0:20 · 10s · The Challenge

**Screen:** None — live action.

**On screen:** Hand-written report cards, one at a time. A spreadsheet on a laptop with the same
names retyped. A finger tracing down a column of fee entries.

**Action:** A hand copies a score from a mark sheet onto a report card, checks back, copies the
next. Cut to the same names being typed into a spreadsheet. The repetition is the point.

**Voice-over:**
> "Records, results, fees and communication quickly become difficult to coordinate — and every term,
> the same work starts again."

**On-screen text:** *Records. Results. Fees.* — sequential, one word per beat.

**Audio:** Pen on paper, keyboard. Music adds a low pulse.

---

### Scene 3 · 0:20–0:35 · 15s · Introduction

**Screen:** `/login` → `/dashboard`

**On screen:** The login screen, clean and centred, logo above the form. Cut to the staff dashboard
resolving.

**Action:** Whoosh transition from paper to screen at 0:20 — the strongest cut in the film. The
login screen holds for 3 seconds. **The password field is pre-filled and masked — never film typing
into it.** Sign in. The dashboard assembles: navigation slides in from the left, stat cards fade up
in sequence.

**Voice-over:**
> "There is another way to run it. A complete school management system — one platform for your whole
> school."

**On-screen text:** **[PRODUCT NAME]** — centred, navy on white, with the logo.

**⚠ Blocked on D1b and D3.** The name card cannot be rendered until the product name and logo are
signed off. **The voice-over is not blocked** — the name is deliberately not spoken. Record the read
now; render the card later.

---

### Scene 4 · 0:35–0:55 · 20s · Dashboard

**Screen:** `/dashboard` as Admin

**On screen:** The staff dashboard in full. Four stat cards across the top. Below them the
outstanding-fees card and the financial summary panel. Below that, academic performance by class.

**Action:**
- 0:35–0:41 — the four stat cards **count up** from zero to 412, 26, 288, 16. Stagger by 0.15s.
- 0:41–0:46 — attendance rate resolves to 94.2%. Highlight ring, then release.
- 0:46–0:51 — the financial summary panel builds: income green, expenditure red, net balance blue.
  Each row slides in from the right.
- 0:51–0:55 — performance bars grow left to right across all three sections; a gentle zoom settles
  on the JSS 2 bar. **Frame so that SSS, JSS and Primary bars are all visible** — this is the first
  moment the viewer can see whether the product fits their type of school.

**Voice-over:**
> "From one dashboard, you see what is actually happening across your school — enrolment,
> attendance, fees collected, money spent, and how each class is performing."

**On-screen text:** *One connected platform.*

**Audio:** Soft tick under the counters, resolving as they land.

**⚠ Constraint:** Animate **only** the stat cards, coloured panels and proportional bars that exist.
The product has no charting library. **No line graphs, pie charts or donuts.**

**Note:** This is the proprietor's scene — the one screen that answers "what would I get out of
this?". Give the financial panel and the outstanding figure clear emphasis.

---

### Scene 5 · 0:55–1:08 · 13s · Student Management

**Screen:** `/dashboard/students` → `/dashboard/students/new`

**Action:** Cursor moves to "Add Student". The form opens. Fields complete in sequence — first name,
surname, admission number, gender, class from the dropdown. The passport photograph drops into its
frame. Save. The new profile opens.

**Voice-over:**
> "Every student begins with a structured digital profile."

**On-screen text:** *Student Management*

**Note:** **Let the class dropdown open fully and be seen.** It runs Crèche through SSS 3, and this
is the earliest point at which a secondary-school proprietor can tell the product covers them. Hold
it open long enough for JSS and SSS to register — a half-second flick past them is wasted.

---

### Scene 6 · 1:08–1:18 · 10s · Parent Management

**Screen:** `/dashboard/parents`

**On screen:** Mrs Ngozi Nwosu's profile, two children linked — **Adaeze in JSS 2, Chidi in
Primary 2**.

**Action:** The profile opens. An animated connector draws from the parent record to each child
card, each showing class and outstanding balance.

**Voice-over:**
> "Parents and guardians are linked to their children, so a parent with more than one child in your
> school sees them all together."

**On-screen text:** *Connected Parent Records*

---

### Scene 7 · 1:18–1:29 · 11s · Classes

**Screen:** `/dashboard/classes`

**Action:** The class list loads showing the full ladder; **JSS 2** opens. A form teacher is
assigned. The subject list populates, each row landing in sequence with a teacher against each
subject — the nine JSS 2 subjects from §3.

**Voice-over:**
> "Classes, subjects and teachers are organised in a single structure, and each teacher works only
> with the classes assigned to them."

**On-screen text:** *Classes & Academic Structure*

---

### Scene 8 · 1:29–1:40 · 11s · Attendance

**Screen:** `/dashboard/attendance`

**Action:** The JSS 2 register loads. The cursor marks down the list — present, present, late,
present, absent. Status chips change colour. Save. A brief cut to the dashboard's attendance rate
ticking to 94.2%.

**Voice-over:**
> "Attendance is marked digitally, and the term's record carries through to the report card
> automatically."

**On-screen text:** *Attendance*

**Audio:** A soft click per mark.

**Note:** Mark at a working pace — a teacher doing a routine job, not a demo being rushed.

---

### Scene 9 · 1:40–1:56 · 16s · Result Entry

**Screen:** `/dashboard/results` as Teacher

**On screen:** The score entry grid — **JSS 2, Mathematics, Third Term**. Students down the rows,
CA 1, CA 2 and Exam across the columns.

**Action:** Class, subject and term selected from dropdowns — show each selection. The grid loads.
Scores entered down CA 1, then CA 2, then Exam. The cursor lands on Adaeze Nwosu's row:
**18, 17, 50**. Highlight and hold briefly. Save.

**Voice-over:**
> "Your teachers record continuous assessment and examination scores for their own subjects."

**On-screen text:** *Assessment & Results*

**Audio:** Key clicks. Music drops ~4 dB from here through Scene 14.

**Note:** Adaeze's row must be identifiable — it carries through to Scenes 10, 12 and 15.

---

### Scene 10 · 1:56–2:06 · 10s · Calculation

**Screen:** `/dashboard/results` — computed result view

**Action:** Nine subject rows resolve one by one. Totals appear, then grades —
A, A, A, B, B, A, B, B, A. Overall figures land last: **642 / 900 · 71.3% · Grade A · 4th of 32**.
Highlight ring on the position.

**Note:** Nine rows is more than the primary equivalent and takes marginally longer to read. Resolve
the rows briskly and let the overall figures hold — the viewer needs to register *grade* and
*position*, not audit every subject.

**Voice-over:**
> "From those entries the system calculates subject totals, grades, the overall average and each
> student's position in class — using your school's own grading scale."

**On-screen text:** *Calculated automatically*

**⚠ Constraint:** The system calculates and compiles. It does not mark work and does not write
comments. Never imply otherwise.

---

### Scene 11 · 2:06–2:14 · 8s · Comments

**Screen:** `/dashboard/comments`

**Action:** The teacher's comment types in at a readable pace. Save. Cut — the head teacher's
comment appears in the second field, in a different session.

**Voice-over:**
> "Teacher and head-teacher comments are added to the record."

**On-screen text:** *Comments & Remarks*

**Note:** If it can be shown without slowing the scene, the head-teacher field appearing disabled
under the teacher login is a genuine and telling detail for a buyer assessing controls.

---

### Scene 12 · 2:14–2:32 · 18s · Report Card — the hero shot

**Screen:** `/dashboard/report-cards` → the generated A4 PDF

**Action:** The film's signature transition. On Generate, the individual score cells from Scene 9
**lift out of the entry grid and fly into position** in the report card's subject table. Attendance
figures slide in from the left. The two comments settle into their boxes. The school logo, motto and
address resolve at the head of the document. The PROMOTED stamp lands last.

Then a slow, controlled scroll down the full A4 page — header, student details with photograph,
subject table, overall summary, attendance, comments, promotion stamp, QR code.

**Voice-over:**
> "Then the report card is generated: scores, attendance, comments and your grading scale brought
> together into a finished document, ready to preview, download or print."

**On-screen text:** *Report Card Generation*

**Audio:** A distinct low document tone as the page resolves. Music holds back.

**Note:** Give this room. It is the most persuasive shot in the film — four separate parts of the
system arriving in one document. Do not rush the scroll; the subject table should be readable.

**Note on the secondary report card.** Nine subjects makes this table taller than a primary one. That
is the point — it is the harder case, and demonstrating the harder case is more convincing to a
proprietor. But it is also the tightest element in the film for legibility: check it survives
WhatsApp compression, and give it a dedicated two-pass treatment in the 9:16 version rather than
shrinking the whole page (§9).

---

### Scene 13 · 2:32–2:42 · 10s · Bulk Generation

**Screen:** `/dashboard/report-cards` — class-level action

**Action:** One click. A single merged PDF downloads. The report card multiplies into a fanned stack
of thirty-two, each with a different name and photograph, spreading across the frame.

**Voice-over:**
> "For an entire class, that is one action rather than forty."

**On-screen text:** *An entire class, one action*

**Audio:** A rising sweep as the stack fans out.

**Note:** The stack must show thirty-two cards to match the JSS 2 class size in §3. Front three
legible, the rest blurred.

---

### Scene 14 · 2:42–2:52 · 10s · Verification

**Screen:** Live action → `/verify-report`

**Action:** A phone moves over the QR code on a printed report card. The camera focuses. The
verification page loads, confirming student name, admission number, class and term, with a clear
valid indicator.

**⚠ BLOCKED — the verification page is hardcoded to Carlspat.** `web/src/app/verify-report/page.tsx`
line 55 prints *"Issued by Carlspat Private School, Ido Ekiti."* and line 47 gives Carlspat's phone
number, neither of which comes from School Settings. Filmed as-is, the hero verification shot would
show a competitor's school name to a prospective buyer, three scenes after Scene 22 promises the
system carries *their* branding. **Do not film this scene until it is fixed.** The fix is small: the
page should read `/settings/school` — a public endpoint the login page already calls — and use
`school?.name` and `school?.phone` with fallbacks, exactly as `login/page.tsx` does.

**Voice-over:**
> "And every report card carries a code that verifies it against your records — so any report can be
> checked against what your school actually issued."

**On-screen text:** *Verified report cards*

**Audio:** A soft confirmation tone as the page resolves.

**Note:** The only live-action setup in the film. Shoot the phone display as a separate screen
capture and composite if reflections cannot be controlled. Music begins lifting back at 2:50.

---

### Scene 15 · 2:52–3:07 · 15s · Fee-Linked Release

**Screen:** `/dashboard` as Parent → `/dashboard/report-cards` as Parent

**Action:**
- 2:52–2:57 — parent dashboard, outstanding balance ₦20,000 highlighted.
- 2:57–3:00 — the report card section, restriction message on screen, held just long enough to read.
- 3:00–3:04 — payment settles; the balance counts down ₦20,000 → ₦0.
- 3:04–3:07 — the restriction lifts; the report card becomes available. A light unlock motion, not a
  padlock cliché.

**Voice-over:**
> "And because fees and academic records sit in the same system, report cards are released to parents
> automatically once a term's fees are settled — so fees and reports stop being two separate
> conversations."

**On-screen text:** *Released when fees are settled*

**Audio:** A light rising tone at 3:04. Music resolves upward.

**⚠ Tone — read before storyboarding.** This can easily read as withholding a child's results. It
must not. Frame it as the office being saved a manual check, and let the beat resolve into release —
the restricted state is on screen for under four seconds, the released state closes the scene.
**No distressed parent, no disappointed child, no red warning iconography, no padlock slamming shut.**

**⚠ Claim limit.** For a proprietor this is a commercial argument, and the temptation is to say it
improves fee collection. **Do not.** No figure, percentage or claim about collection rates,
promptness or recovered revenue has been verified, and none may appear in narration, caption or
sales copy derived from this film. The verified statement is about *workflow*: the check is
automatic and consistent. Stop there.

---

### Scene 16 · 3:07–3:23 · 16s · Fees

**Screen:** `/dashboard/fees` → `/dashboard/payments`

**Action:**
- 3:07–3:12 — fee categories with amounts, total resolving to **₦86,000**. The unticked Transport
  Fee is visible.
- 3:12–3:18 — record a payment: student, amount ₦20,000, method Bank Transfer. Save.
- 3:18–3:23 — the PDF receipt generates and downloads, receipt number visible.

**Voice-over:**
> "Fee structures are set for each class and each term. Payments are recorded and receipted, whether
> they arrive in cash, by transfer, or by card and bank payment online where a payment gateway is
> connected."

**On-screen text:** *Fee Management*

**⚠ Constraint:** Online payment is real — Paystack and Flutterwave — but works only when the
school's own API keys are configured. The conditional "where a payment gateway is connected" must
survive into the final mix. If a gateway checkout is filmed, it must be a genuine capture.

---

### Scene 17 · 3:23–3:31 · 8s · Debtors

**Screen:** `/dashboard/fees` — debtors view

**Action:** The list loads and sorts. A gentle zoom to the outstanding total, **₦4,372,000**,
matching Scene 4.

**Voice-over:**
> "Outstanding balances are visible at a glance."

**On-screen text:** *Outstanding at a glance*

**Note:** Every name here must be fictional. This frame shows families in arrears — the single most
sensitive screen in the film.

---

### Scene 18 · 3:31–3:41 · 10s · Expenditure

**Screen:** `/dashboard/expenditures` → `/dashboard`

**Action:** Category, description, amount ₦38,500, date. Save. The entry joins the history list.
Transition to the dashboard, where income ₦19,650,000 and expenditure ₦13,780,000 resolve into the
net balance **₦5,870,000**.

**Voice-over:**
> "Expenditure is recorded by category and set against the term's income, so you can see your
> position rather than estimate it."

**On-screen text:** *Expenditure Management*

---

### Scene 19 · 3:41–3:51 · 10s · Resources

**Screen:** `/dashboard/resources` as Teacher → as Student

**Action:** Upload a lesson note, assigned to JSS 2, with a progress indicator. Cut to a student
account: the same resource appears and opens.

**Voice-over:**
> "Lesson notes, schemes of work and past questions are uploaded once and shared with the right
> class."

**On-screen text:** *Resources & Documents*

**⚠ Constraint:** The type list includes "Assignment", but this is **file distribution only**. No
student submission, no marking. Do not show or imply a student handing work back.

---

### Scene 20 · 3:51–4:01 · 10s · Communication

**Screen:** `/dashboard/announcements` → `/dashboard/messages`

**Action:** An announcement is composed, audience set to **Parents**, published. Cut to a short
message thread between a teacher and a parent.

**Voice-over:**
> "Announcements reach a chosen audience — parents, teachers, students or the whole school — by
> email and SMS where those are configured."

**On-screen text:** *Announcements & Messages*

**⚠ Constraint:** **There is no notification centre, no bell icon and no push notification.** Do not
animate a notification sliding in from the corner of the screen.

---

### Scene 21 · 4:01–4:16 · 15s · Roles

**Screen:** `/dashboard` across six role logins

**Action:** Six dashboards in sequence, each holding about 2.5 seconds. As each appears, its role
name captions in and the navigation is briefly highlighted so the viewer sees the menu genuinely
differs — the accountant has no Results, the teacher has no Expenditures, the parent has neither.
The dark theme carries one of these views, ideally the teacher's.

**Voice-over:**
> "Six roles: super administrator, administrator, teacher, accountant, parent and student. Each sees
> only what belongs to it — enforced by the system itself, not simply hidden from view."

**On-screen text:** *Six roles. Controlled access.*

**⚠ Constraint:** **Exactly six roles.** There is no proprietor account and no principal account —
those people work through Super Admin or Admin. A seventh dashboard would be fabricated.

**Note for this audience:** the proprietor watching is asking "what would *I* log in as?" The answer
is Super Admin or Admin. Caption the Super Admin view clearly — that is their seat.

---

### Scene 22 · 4:16–4:28 · 12s · It Becomes Your School — NEW

**Screen:** `/dashboard/settings` → regenerated report card

**On screen:** School Settings: name, motto, address, phone, email and logo. Then the grading scale
and assessment structure. Then a report card carrying the new identity.

**Action:**
- 4:16–4:20 — the settings screen. The school name field is edited; the name updates in the header
  and sidebar live. The logo is replaced.
- 4:20–4:24 — a quick pass down the configurable structure: sessions and terms, classes, subjects,
  grading bands, assessment weights. Each highlights briefly. **The class list is the important one
  — frame it so Crèche through SSS 3 is visible in a single scroll.** That one shot tells every
  proprietor watching, nursery through senior secondary, that the system covers their school.
- 4:24–4:28 — cut to a freshly generated report card, now carrying the new name, motto and logo in
  its header. Hold.

**Voice-over:**
> "And it becomes your school's system. Your name, your logo, your classes, your subjects, your
> grading scale — set from your own dashboard, on your own installation, with your own data."

**On-screen text:** *Configured for your school*

**Audio:** Music lifts. A soft confirmation tone as the rebranded report card resolves.

**Why this scene exists.** Everything before it shows another school's name, which is the first
objection a proprietor will raise. This answers it directly and truthfully: the system is configured
per school, and each school runs its own installation with its own database.

**⚠ Constraint — the most important on this page.** The system manages **one school per
installation**. It has no school switcher, no group console and no way to view several schools
together. "Your own installation" is accurate and is a genuine advantage — the buyer's data is not
pooled with anyone else's. **"Manage all your schools from one place" is false and must never be
said, captioned or animated.** A proprietor who owns three schools would run three installations.

---

### Scene 23 · 4:28–4:38 · 10s · Benefits

**Screen:** Motion graphics over a softened dashboard.

**On screen:** Six persona marks — proprietor, administrator, teacher, bursar, parent, student —
arranged around a central platform mark, connectors drawing outward to the modules each uses.

**Action:** Connectors draw in sequence, then the diagram settles and holds.

**Voice-over:**
> "For you, your administrators, your teachers and your bursar, the aim is the same: organised
> information, and far fewer manual steps."

**On-screen text:** *Built around your school*

**Note:** "Proprietor" is acceptable as a *persona* label here because it describes a person, not an
account type. Do not attach it to a login or a dashboard.

---

### Scene 24 · 4:38–4:50 · 12s · Close

**Screen:** Dashboard resolving to the product mark.

**Action:** Interface elements lift away in layers. The logo assembles.

**Voice-over:**
> "Bring your school's records, results and finances together."

**On-screen text:** *Manage. Connect. Simplify.*

**Audio:** Music resolves to its final cadence.

**⚠ Blocked on D3** — requires the production logo asset.

---

### Scene 25 · 4:50–5:00 · 10s · Call to Action

**Screen:** Contact card.

**Action:** The product name and logo settle first. The telephone number animates in beneath them at
the largest type size on the card. The email follows on a second line, smaller. Hold a full **five
seconds** — long enough to be written down, photographed or dialled from the screen. Fade.

**Voice-over:**
> "To see it running in your school, call 0 8 0 6 7 2 8 1 6 7 6, or email
> carlspatprivateschool@outlook.com."

**On-screen text:**
> **[PRODUCT NAME]**
> **📞 08067281676**
> ✉️ carlspatprivateschool@outlook.com

**This is the only conversion point in the film.** There is no website, so nothing else gives a
viewer a way to act. The telephone number is the single most important element on screen at any
point in these five minutes:

- **Largest type on the card** after the product name — larger than the email, which is secondary.
- **Legible on a phone at arm's length.** Check on an actual handset, not by scaling the 4K master
  on a monitor. This film will be watched on phones far more often than on desktops.
- **Held five seconds.** The hold is what lets someone dial or screenshot.
- **Digits grouped for reading:** 0806 728 1676 is easier to hold in memory than an unbroken string.
- **High contrast**, gold or white on navy. Never over moving footage.

The button reads **"Contact Us"**. Not "Get Started" — there is nowhere to get started.
Do **not** use "Book a Demo" — no booking process exists.

**On the 9:16 and WhatsApp versions**, this card needs its own composition: the number set larger
still and stacked vertically. Do not crop the 16:9 card.

**⚠ Blocked on D1b and D3** for the name card only. The voice-over is not blocked.

---

## 6. Voice-over script — clean read

**Approximately 600 words · target 5:00 including silent action beats · British English.**

Measured, warm, professional. **The register is one business owner speaking to another** — credible
and unhurried, never a hard sell. The film has several passages of silent interface action, so do
not rush to fill time. Pause where marked. Section headings are for the engineer and are not read.

**The product name is never spoken.** This is deliberate — see §1, D1b. Do not add it.

### Pronunciation

| Word | Say |
|---|---|
| Adaeze | ah-dah-EH-zeh |
| Nwosu | NWOH-soo |
| Ngozi | n-GOH-zee |
| Paystack | PAY-stack |
| Flutterwave | FLUTTER-wave |
| Naira | NY-rah |

The telephone number is read **digit by digit**: "oh, eight, oh, six, seven, two, eight, one, six,
seven, six."

---

**[Scenes 1–2 · the challenge]**

Running a school involves far more than teaching.

*[pause]*

Records, results, fees and communication quickly become difficult to coordinate — and every term,
the same work starts again.

**[Scene 3 · introduction]**

There is another way to run it. A complete school management system — one platform for your whole
school.

**[Scene 4 · dashboard]**

From one dashboard, you see what is actually happening across your school — enrolment, attendance,
fees collected, money spent, and how each class is performing.

**[Scenes 5–6 · students and parents]**

Every student begins with a structured digital profile.

*[pause]*

Parents and guardians are linked to their children, so a parent with more than one child in your
school sees them all together.

**[Scenes 7–8 · classes and attendance]**

Classes, subjects and teachers are organised in a single structure, and each teacher works only with
the classes assigned to them.

*[pause]*

Attendance is marked digitally, and the term's record carries through to the report card
automatically.

**[Scenes 9–11 · results]**

Your teachers record continuous assessment and examination scores for their own subjects.

*[pause]*

From those entries the system calculates subject totals, grades, the overall average and each
student's position in class — using your school's own grading scale.

*[pause]*

Teacher and head-teacher comments are added to the record.

**[Scenes 12–14 · report cards — slow slightly, this is the centre of the film]**

Then the report card is generated: scores, attendance, comments and your grading scale brought
together into a finished document, ready to preview, download or print.

*[pause]*

For an entire class, that is one action rather than forty.

*[pause]*

And every report card carries a code that verifies it against your records — so any report can be
checked against what your school actually issued.

**[Scene 15 · fee-linked release — warm, matter-of-fact, never stern]**

And because fees and academic records sit in the same system, report cards are released to parents
automatically once a term's fees are settled — so fees and reports stop being two separate
conversations.

**[Scenes 16–17 · fees]**

Fee structures are set for each class and each term. Payments are recorded and receipted, whether
they arrive in cash, by transfer, or by card and bank payment online where a payment gateway is
connected.

*[pause]*

Outstanding balances are visible at a glance.

**[Scene 18 · expenditure]**

Expenditure is recorded by category and set against the term's income, so you can see your position
rather than estimate it.

**[Scene 19 · resources]**

Lesson notes, schemes of work and past questions are uploaded once and shared with the right class.

**[Scene 20 · communication]**

Announcements reach a chosen audience — parents, teachers, students or the whole school — by email
and SMS where those are configured.

**[Scene 21 · roles]**

Six roles: super administrator, administrator, teacher, accountant, parent and student. Each sees
only what belongs to it — enforced by the system itself, not simply hidden from view.

**[Scene 22 · it becomes your school — this is the turn; lift slightly]**

And it becomes your school's system. Your name, your logo, your classes, your subjects, your grading
scale — set from your own dashboard, on your own installation, with your own data.

**[Scene 23 · benefits]**

For you, your administrators, your teachers and your bursar, the aim is the same: organised
information, and far fewer manual steps.

**[Scenes 24–25 · close]**

Bring your school's records, results and finances together.

*[pause]*

To see it running in your school, call oh, eight, oh, six, seven, two, eight, one, six, seven, six —
or email carlspat private school at outlook dot com.

---

### Alternate lines — record only after D1b is signed off

If the owner wants the product name spoken, record these two as alternates. Everything else in the
read is unaffected.

**Scene 3 alternate:**
> "There is another way to run it. This is [PRODUCT NAME] — one platform for your whole school."

**Scene 25 alternate:**
> "To see [PRODUCT NAME] running in your school, call oh, eight, oh, six, seven, two, eight, one,
> six, seven, six."

Record both variants in the same session if the name is known by then. If it is not, record the
name-free version and move on — **do not delay the shoot for a name.**

---

## 7. Timing summary

| # | Scene | In | Out | Dur. |
|---|---|---|---|--:|
| 1 | The Challenge — paper | 0:00 | 0:10 | 10s |
| 2 | The Challenge — repetition | 0:10 | 0:20 | 10s |
| 3 | Introduction | 0:20 | 0:35 | 15s |
| 4 | Dashboard | 0:35 | 0:55 | 20s |
| 5 | Student Management | 0:55 | 1:08 | 13s |
| 6 | Parent Management | 1:08 | 1:18 | 10s |
| 7 | Classes | 1:18 | 1:29 | 11s |
| 8 | Attendance | 1:29 | 1:40 | 11s |
| 9 | Result Entry | 1:40 | 1:56 | 16s |
| 10 | Calculation | 1:56 | 2:06 | 10s |
| 11 | Comments | 2:06 | 2:14 | 8s |
| 12 | **Report Card** | 2:14 | 2:32 | 18s |
| 13 | Bulk Generation | 2:32 | 2:42 | 10s |
| 14 | Verification | 2:42 | 2:52 | 10s |
| 15 | **Fee-Linked Release** | 2:52 | 3:07 | 15s |
| 16 | Fees | 3:07 | 3:23 | 16s |
| 17 | Debtors | 3:23 | 3:31 | 8s |
| 18 | Expenditure | 3:31 | 3:41 | 10s |
| 19 | Resources | 3:41 | 3:51 | 10s |
| 20 | Communication | 3:51 | 4:01 | 10s |
| 21 | Roles | 4:01 | 4:16 | 15s |
| 22 | **It Becomes Your School** | 4:16 | 4:28 | 12s |
| 23 | Benefits | 4:28 | 4:38 | 10s |
| 24 | Close | 4:38 | 4:50 | 12s |
| 25 | Call to Action | 4:50 | 5:00 | 10s |

**Total runtime: 5 minutes 00 seconds.**

Weighting: problem 20s (7%) · platform and records 80s (27%) · **results and report cards 72s (24%)**
· **fee-linked release 15s (5%)** · finance 34s (11%) · resources and communication 20s (7%) ·
roles 15s (5%) · **rebranding 12s (4%)** · benefits and close 32s (11%).

Report cards, the fee-linked release and the rebranding scene together carry a third of the runtime.
That is the intended emphasis for a buying audience: *it does the hardest job in the school, it links
money to academics, and it becomes yours.*

---

## 8. Prohibitions — print this page

Nothing on this list exists in the software. Putting any of it on screen makes the video inaccurate,
and in a sales context, misleading.

### Never animate

- ✗ **Multi-school management** — no school switcher, no group console, no "all your schools" view. **One installation per school.**
- ✗ **Line graphs, pie charts, donut charts** — no charting library is installed
- ✗ **A notification centre, bell icon or push notification**
- ✗ **A proprietor or principal login, dashboard or role** — there are six roles, and those are not two of them
- ✗ **A seventh role of any kind**
- ✗ **A mobile app** — the web UI is responsive; there is no native app
- ✗ **A student submitting or uploading work** — resources are distributed, not collected
- ✗ **A timetable or examination schedule**
- ✗ **A library, transport, payroll, inventory or hostel module** — "Transport" is a fee category only
- ✗ **A result approval or publishing workflow**
- ✗ **CSV or Excel export** — PDF only
- ✗ **A WhatsApp integration**
- ✗ **Any AI feature**
- ✗ **Any button, screen or field not present in the captured application**

### Never say or caption

- ✗ **"Manage all your schools in one place"** — or anything implying multi-school operation
- ✗ **Any claim about fee collection improving** — no rates, no percentages, no "get paid faster"
- ✗ Uptime figures or availability percentages
- ✗ Security certifications or compliance standards
- ✗ Encryption technology
- ✗ Automatic or cloud backup
- ✗ Any statistic about time saved, money saved or results improved
- ✗ "The system marks", "the system writes comments", "fully automated"
- ✗ "Book a Demo" — no booking process exists
- ✗ Named references to other schools as customers

### Never film

- ✗ Real student names, photographs, results or fee balances
- ✗ The demo credentials published in the repository README
- ✗ A password being typed, in any field, at any point

### Say instead

| Instead of | Say |
|---|---|
| "Manage all your schools" | "Your own installation, with your own data" |
| "Improves fee collection" | "Fees and reports stop being two separate conversations" |
| "Secure and encrypted" | "Controlled access" |
| "Automated report cards" | "Report cards generated from the scores entered" |
| "Accept payments online" | "Card and bank payment online, where a payment gateway is connected" |
| "Sends notifications" | "Announcements by email and SMS, where those are configured" |
| "Analytics and insights" | "Summaries across enrolment, attendance, fees and performance" |
| "Assignment management" | "Lesson notes and materials shared with the class" |

---

## 9. Deliverables

| Deliverable | Spec |
|---|---|
| Master | 3840 × 2160, 25 fps, H.264 or ProRes, 48 kHz |
| YouTube / laptop playback | 1920 × 1080 minimum, 16:9 |
| **WhatsApp** | H.264 MP4, compressed — **the primary distribution channel** |
| Promotional cut (75s) | Problem → Dashboard → Report card → Fee release → **Rebranding** → CTA |
| Social teaser (25s) | Hand-written cards → score entry → report card → whole class → CTA |
| Instagram / Facebook | 16:9, 1:1, 4:5 |
| TikTok / Reels | 1080 × 1920, 9:16, enlarged text and UI crops |
| Feature clips | Report cards (45–60s) · Fee-linked release (30–45s) · **Configured for your school (30s)** · QR verification (20–30s) · Fees (30–45s) · Results (30–45s) · Dashboard (20–40s) · Attendance (20–30s) · Expenditure (20–40s) · Resources (20–40s) |
| Subtitles | Separate SRT for the master; burned-in for all social versions |

**Distribution note.** With no website, this film reaches proprietors hand to hand — sent on
WhatsApp, played on a phone or laptop across a desk during a conversation. Two consequences:

1. **The WhatsApp-compressed cut is not an afterthought.** It is the main deliverable. Check that
   the report card in Scene 12 and the contact card in Scene 25 survive compression.
2. **The 75-second promotional cut carries most of the selling.** A proprietor will watch a short
   version first. It must include the rebranding beat — without it, a stranger's school name is the
   last thing they remember.

Mobile versions are **recomposed, not cropped.** The report card table in Scene 12 is the tightest
element in the film and needs its own vertical treatment — frame two or three subject rows at a time
rather than shrinking the whole page.
