# Multi-Tenancy Plan — Converting Carlspat SMS into a Subscribable Platform

**Status:** Proposal, not started
**Written:** 16 August 2026
**Audience:** The developer who will implement this, and the product owner

---

## 1. What this covers

Today the system serves exactly one school. The goal is for many schools to
subscribe, each configuring the system for themselves, each seeing only their
own data.

This document covers **isolation only** — making the existing system
school-aware. It deliberately does *not* cover the platform owner console or
subscription billing. Those are comparatively small and depend on this being
done first.

The single most important requirement: **no school may ever see another
school's data.** In a system holding children's records, medical notes and fee
histories, a leak between tenants is a data protection incident, not a bug
report.

---

## 2. Where the codebase already helps

The schema was designed with a `School` table and most top-level records already
carry `schoolId`:

`AcademicSession` · `AssessmentType` · `GradeScale` · `Student` · `ClassRoom` ·
`Subject` · `FeeCategory` · `FeeStructure` · `StudentFeeItem` · `ExpenseCategory` ·
`Expense` · `Announcement` · `Resource` · `User` (nullable)

The access token already carries the school:

- `server/src/utils/jwt.ts:8` — `schoolId: string | null` in `AccessPayload`
- `server/src/middleware/auth.ts:16` — `authenticate` attaches it to `req.auth`

So the plumbing exists. What is missing is enforcement: nothing currently checks
that the record being read or written belongs to the caller's school.

---

## 3. Where it does not

These models have **no** `schoolId` and reach their school only through a
parent record:

`Term` (via `AcademicSession`) · `Teacher` · `Parent` · `ClassSubject` ·
`Attendance` · `Score` · `TermReport` · `Promotion` · `FeeWaiver` · `Payment` ·
`Message` · `AuditLog`

This is defensible design, but it means a query against any of them is unscoped
unless it explicitly joins upwards. **This is where isolation bugs will hide.**

A decision is needed early: either denormalise `schoolId` onto these tables
(faster queries, simpler filters, a migration and a backfill), or require every
query to join upward (no migration, more discipline, easier to get wrong).

Recommendation: **denormalise.** The safety benefit outweighs the redundancy,
and it makes the automatic fence in Stage 1 far simpler to implement.

---

## 4. Stage 1 — The automatic fence

**Do this first. Everything else depends on it.**

Do not rely on developers remembering to filter by school in each query. There
are several hundred queries today and more will be added. One forgotten filter
is a cross-tenant leak.

Instead, apply the scope at the data layer using a **Prisma client extension**
(`$extends` with a `query` hook) that injects the current school into every
`where` clause and stamps `schoolId` on every create.

Implementation notes:

- Carry the current school in request-scoped context (`AsyncLocalStorage`), set
  by middleware immediately after `authenticate`.
- The extension must **fail closed**: if no school is in context, throw rather
  than returning unscoped data. A missing scope must never mean "all schools".
- Provide one explicit, clearly-named escape hatch for the platform-owner
  console and for legitimately cross-school jobs (migrations, backups). Make it
  obvious in code review when it is used.
- Webhooks (`server/src/routes/payments.ts`, the handlers before
  `router.use(authenticate)`) have no logged-in user. They must resolve the
  school from the payment reference, then enter the scoped context explicitly.

---

## 5. Stage 2 — Uniqueness constraints

Four constraints are globally unique and must become per-school. Each will
break the second a school signs up.

| Field | Location | Problem | Change to |
|---|---|---|---|
| `User.email` | `schema.prisma:186` | Two schools cannot both use `info@…`; a parent with children at two schools cannot exist | `@@unique([schoolId, email])` |
| `Teacher.staffNo` | `schema.prisma:219` | Staff numbering collides across schools | `@@unique([schoolId, staffNo])` |
| `Student.admissionNo` | `schema.prisma:243` | Every school issues its own `001` | `@@unique([schoolId, admissionNo])` |
| `Payment.receiptNo` | `schema.prisma:473` | Receipt sequences collide | `@@unique([schoolId, receiptNo])` |

`Teacher` and `Payment` have no `schoolId` column yet — see the denormalisation
decision in section 3.

**Login is affected.** With email no longer globally unique, `POST /auth/login`
can no longer look a user up by email alone. Either ask for the school at login
(a subdomain such as `stmarys.yourapp.com`, or a school code field), or keep
email globally unique and accept the limitation. Decide this before starting —
it changes the login screen, the token, and the password reset flow.

---

## 6. Stage 3 — The 23 "first school" lookups

Each call below means *"give me the first school in the database"*. Each must
become *"give me the caller's school"*.

| File | Lines |
|---|---|
| `server/src/routes/settings.ts` | 16, 43, 78, 181, 217 |
| `server/src/routes/fees.ts` | 32, 99, 146, 179 |
| `server/src/routes/expenses.ts` | 34, 110 |
| `server/src/routes/teachers.ts` | 106, 170 |
| `server/src/routes/users.ts` | 31, 199 |
| `server/src/routes/announcements.ts` | 58 |
| `server/src/routes/classes.ts` | 41 |
| `server/src/routes/parents.ts` | 68 |
| `server/src/routes/payments.ts` | 256 |
| `server/src/routes/reportCards.ts` | 33 |
| `server/src/routes/resources.ts` | 65 |
| `server/src/routes/students.ts` | 83 |
| `server/src/routes/subjects.ts` | 31 |

Once Stage 1 is in place, most become a context read rather than a query.

---

## 7. Stage 4 — The staff authorisation hole

`server/src/middleware/auth.ts:45` — `assertCanAccessStudent`:

```ts
if ((STAFF as string[]).includes(auth.role)) return;
```

Any staff member passes unconditionally. Correct for one school; a cross-tenant
hole for many — a teacher at School A could read School B's pupil by supplying
its ID. The guard must also confirm the student belongs to the caller's school.

Audit every other guard for the same assumption. Anywhere the code reasons
"is this person staff?" it must now also ask "staff *of this school*?".

---

## 8. Stage 5 — Identifier generation

`server/src/utils/ids.ts` hardcodes Carlspat's prefix and scans globally:

- `nextAdmissionNo()` line 9 — prefix `CPS/${year}/`
- `nextReceiptNo()` line 29 — prefix `CPS-RCP-${year}-`

Both then take the highest existing value **across all rows**. With several
schools this produces another school's initials on documents and interleaved
sequences (School A gets 00107, School B gets 00108).

Both need a per-school prefix stored on the `School` record, and both `findFirst`
scans need scoping. Note the existing race-condition retry in
`confirmGatewayPayment` (`server/src/routes/payments.ts`) depends on the unique
constraint — keep that behaviour when the constraint becomes composite.

---

## 9. Stage 6 — Proving isolation

This is the deliverable that lets you sell the product honestly.

Build a test suite that creates **two** schools with deliberately similar data —
same class names, same admission numbers, same parent email patterns — then, as
School A's admin, attempts to reach School B's:

- pupils, parents, teachers, classes, subjects
- attendance, scores, report cards, report card PDFs
- fee structures, waivers, payments, receipt PDFs
- announcements, messages, resources, audit logs

Every attempt must return `404`. Test by **direct ID and URL manipulation**, not
by clicking through the interface — the interface will not offer the links, and
that is precisely why the gap goes unnoticed.

Run this suite on every release, permanently.

---

## 10. Stage 7 — Migrating Carlspat itself

Carlspat becomes tenant number one. Its live data (currently 64 active pupils,
44 parents, 9 teachers, and a full term of attendance, scores and payments)
must land intact with its `schoolId` populated everywhere.

Sequence:

1. Take and **restore-test** a backup before starting.
2. Run the migration against a scratch copy first; count rows before and after.
3. Verify a sample of parent logins see exactly what they saw before.
4. Only then run against production, out of school hours.

The weekly backup job in `carlspat-sms-backups/weekly-backup.ps1` produces a
suitable dump.

---

## 11. Open question: four unmanaged tables

The live database contains four tables that appear nowhere in the Prisma schema
or this codebase:

`portal_credentials` · `gallery` · `study_materials` · `contact_messages`

Something outside this system writes to them — most likely the public website.
They have no `schoolId` and no owner in this repo.

**Resolve before starting.** Establish what writes to them and whether they hold
per-school data. If they do, they need the same treatment. If they are orphans
from an earlier iteration, they should be removed. Either way they are currently
a blind spot in any isolation guarantee, and note that `portal_credentials` is a
name that warrants a look on security grounds regardless.

---

## 12. Sequencing summary

| Stage | Work | Depends on |
|---|---|---|
| 1 | Automatic school fence at the data layer | Section 3 decision |
| 2 | Composite uniqueness constraints + migration | Login strategy decision |
| 3 | Replace 23 first-school lookups | 1 |
| 4 | Fix staff guards, audit all authorisation | 1 |
| 5 | Per-school identifier prefixes and sequences | 2 |
| 6 | Isolation test suite | 1–5 |
| 7 | Migrate Carlspat as tenant one | 6 green |

Two decisions are needed before any code is written:

1. **Denormalise `schoolId` onto the twelve indirect tables, or join upward?**
   (Recommendation: denormalise.)
2. **How does a user identify their school at login?** (Subdomain, school code,
   or keep email globally unique.)

---

## 13. Not covered here

The platform owner console, subscription plans, recurring Paystack billing, and
suspending a school on non-payment. All are straightforward relative to the
above, and all assume the isolation work is complete and proven.
