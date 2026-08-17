# Carlspat SMS — REST API Reference

Base URL: `http://localhost:4000/api/v1` (set by `PORT` / deployment).
All responses are JSON: `{ "success": true, "data": … }` or `{ "success": false, "message": "…", "details": […] }`.

## Authentication

Send the access token on every protected request:

```
Authorization: Bearer <accessToken>
```

Access tokens live 15 minutes; refresh tokens 7 days. Refresh tokens are revoked
globally when a password changes (`tokenVersion` bump).

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | `{email, password}` → user + access/refresh tokens. Rate-limited (20/15 min). |
| POST | `/auth/refresh` | — | `{refreshToken}` → new token pair |
| GET | `/auth/me` | any | Current user + linked teacher/parent/student profile |
| POST | `/auth/change-password` | any | `{currentPassword, newPassword}` — revokes all sessions |
| POST | `/auth/logout-all` | any | Revoke refresh tokens on all devices |

### Roles

`PLATFORM_OWNER`, `SUPER_ADMIN`, `ADMIN`, `TEACHER`, `PARENT`, `STUDENT`, `ACCOUNTANT`.
**ADMINS** below = SUPER_ADMIN + ADMIN. **STAFF** = ADMINS + TEACHER + ACCOUNTANT.
**FEE_MANAGERS** = ADMINS + ACCOUNTANT.

`PLATFORM_OWNER` runs the platform itself and belongs to no school. It is the
only role permitted a null `schoolId`, the only role that reaches `/platform/*`,
and it is refused from every school route. No API can create one — see
`npm run platform:owner`.

## Tenancy

Every school route is fenced to one school, taken from the `schoolId` in the
access token. A school id in a URL, query string or request body is never
trusted as evidence of anything.

Two consequences worth knowing when calling the API:

**Records belonging to another school return `404`, not `403`.** Confirming that
an id exists elsewhere would itself be a disclosure, so an id from another school
is indistinguishable from an id that does not exist.

**Lists are filtered before anything else.** Filters in the query string narrow
within the caller's school; none of them can widen past it.

### Subscription gate

Every school route also checks the school's subscription before doing any work.
A lapsed school keeps all of its data — only access stops.

| Status | Access |
|---|---|
| `TRIAL`, `ACTIVE` | allowed |
| `PAST_DUE` | allowed — grace period |
| `SUSPENDED`, `CANCELLED` | `403` |
| any status, past `subscriptionEndsAt` | `402` |

### Per-school numbering

Admission numbers, staff numbers and receipt numbers restart at 1 for each
school and use that school's own `numberPrefix` (`CPS/2026/0001`,
`CPS/STF/001`, `CPS-RCP-2026-00001`). They are unique within a school, never
across the platform.

## School settings (admin-editable, no code changes)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/settings/school?slug=` | public | School name, motto, address, phone, email, logo. Resolved in order: a valid token's own school (cannot be spoofed, so it beats a slug pointing elsewhere) → `?slug=` → the only school when exactly one exists. With several schools and neither a token nor a slug it returns `400` asking for the slug, rather than guessing. |
| PUT | `/settings/school` | ADMINS | Update any school profile field incl. `logoUrl` |
| GET | `/settings/sessions` | any | Academic sessions with terms |
| POST | `/settings/sessions` | ADMINS | `{name: "2026/2027", startDate, endDate, isCurrent?}` |
| POST | `/settings/sessions/:id/terms` | ADMINS | Create a term in a session |
| PATCH | `/settings/terms/:id/current` | ADMINS | Switch the active term/session |
| GET | `/settings/current-term` | any | The current term (default context everywhere) |
| GET | `/settings/grading` | any | Grade scale + assessment structure |
| PUT | `/settings/grading/scales` | ADMINS | Replace grade bands `{scales:[{minScore,maxScore,grade,remark}]}` |
| PUT | `/settings/grading/assessments` | ADMINS | Replace assessment components; max scores must total 100 |

## Students

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/students?q=&classRoomId=&status=&page=&pageSize=` | STAFF | Search + filter + pagination |
| POST | `/students` | ADMINS | Register; admission no auto-generated (`CPS/<year>/0001`); optional `createLogin` |
| GET | `/students/:id` | staff / own parent / self | Full profile incl. medical info + promotion history |
| PUT | `/students/:id` | ADMINS | Update profile, class, status |
| DELETE | `/students/:id` | ADMINS | Hard-delete if no records; otherwise marks WITHDRAWN |
| POST | `/students/promote` | ADMINS | `{studentIds, toClassRoomId|null}` — null graduates |

## Teachers / Parents

| Method | Path | Auth |
|---|---|---|
| GET/POST | `/teachers` | STAFF / ADMINS |
| GET | `/teachers/me/classes` | TEACHER — own form classes + subject assignments |
| PUT | `/teachers/:id` | ADMINS |
| GET/POST | `/parents` | STAFF / ADMINS |
| GET | `/parents/me/children` | PARENT |
| POST | `/parents/:id/link` | ADMINS — `{studentIds}` |

## Classes & subjects

| Method | Path | Auth |
|---|---|---|
| GET | `/classes`, `/classes/:id` | any authenticated |
| POST/PUT/DELETE | `/classes…` | ADMINS |
| PUT | `/classes/:id/subjects` | ADMINS — `{assignments:[{subjectId, teacherId?}]}` |
| GET | `/subjects` | any · POST/PUT/DELETE: ADMINS |

## Attendance

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/attendance/mark` | TEACHER (own classes) / ADMINS | `{classRoomId, date, records:[{studentId, status: PRESENT\|ABSENT\|LATE, remark?}]}` — upserts |
| GET | `/attendance/class/:classRoomId?date=` | TEACHER/ADMINS | Day register |
| GET | `/attendance/student/:studentId?termId=&from=&to=` | staff / own parent / self | History + summary |
| GET | `/attendance/report?classRoomId=&from=&to=` | TEACHER/ADMINS | Daily/weekly/monthly analytics + attendance rate |

## Results

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/results/scores` | TEACHER (assigned subject) / ADMINS | Bulk upsert; rejects scores above the assessment max |
| GET | `/results/scores?classRoomId=&subjectId=&termId=` | TEACHER/ADMINS | Editable score sheet |
| GET | `/results/student/:studentId?termId=` | staff / own parent / self | Computed result: per-subject totals, %, grade, class position |
| GET | `/results/class/:classRoomId?termId=` | TEACHER/ADMINS | Class ranking (dense, ties share position) |
| PUT | `/results/comments` | TEACHER (teacher comment) / ADMINS (both) | Report card comments |

## Report cards — fee lock enforced

> **402 Payment Required** with message
> *“Access to report card is restricted until school fees have been fully paid.”*
> is returned to parents/students with any outstanding balance. Staff bypass the lock.

| Method | Path | Description |
|---|---|---|
| GET | `/report-cards/:studentId/access?termId=` | `{allowed, outstanding, message}` — UI pre-check |
| GET | `/report-cards/:studentId/data?termId=` | Full report JSON (locked) |
| GET | `/report-cards/:studentId/pdf?termId=` | A4 PDF: logo, passport, scores, grades, position, comments, attendance, stamp area, QR (locked) |
| GET | `/report-cards/verify?sid=&tid=&sig=` | Public QR verification (HMAC-signed) |

## Fees & payments

| Method | Path | Auth | Description |
|---|---|---|---|
| GET/POST | `/fees/categories` | any / FEE_MANAGERS | Tuition, PTA, Examination, Development Levy, Transport, … |
| GET/POST/DELETE | `/fees/structures` | FEE_MANAGERS | Amount per class × term × category |
| POST | `/fees/waivers` | ADMINS | Discounts/scholarships |
| GET | `/fees/balance/:studentId?termId=` | staff / own parent / self | expected, waived, paid, outstanding |
| GET | `/fees/debtors?termId=&classRoomId=` | FEE_MANAGERS | Outstanding fees report |
| GET | `/payments?studentId=&termId=&q=` | FEE_MANAGERS or own | Payment history |
| POST | `/payments` | FEE_MANAGERS | Record offline payment → receipt no `CPS-RCP-<year>-00001`, email to parent |
| GET | `/payments/:id/receipt` | staff / own | PDF receipt — 400 until the payment is confirmed |
| POST | `/payments/paystack/init` | parent/own | → `{authorizationUrl, reference}`; creates a PENDING payment |
| GET | `/payments/paystack/verify?reference=` | parent/own | Confirms from the browser callback → `{status, receiptNo, amount}`. Idempotent; safe alongside the webhook |
| POST | `/payments/flutterwave/init` | parent/own | → `{authorizationUrl}` |
| POST | `/payments/webhooks/paystack` | signature | HMAC-SHA512 `x-paystack-signature` over raw body |
| POST | `/payments/webhooks/flutterwave` | signature | `verif-hash` header |
| GET | `/payments/reports/summary?termId=` | FEE_MANAGERS | Totals, by method, recent payments |

### Online payment lifecycle

`init` creates the payment as **PENDING with no receipt number**. It becomes SUCCESS
through either the gateway webhook or `paystack/verify` — whichever arrives first;
both are idempotent, so the parent is credited and emailed exactly once.

**Receipt numbers are assigned at confirmation, not at init**, so an abandoned
checkout leaves no gap in the `CPS-RCP-` sequence. A PENDING payment therefore has
`receiptNo: null` and cannot produce a receipt PDF.

Only SUCCESS payments count toward a student's paid total, so a pending checkout
never unlocks a report card. `verify` refuses to confirm if the amount Paystack
reports differs from the initialized amount — the bursar reconciles those by hand.

## Communication

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/announcements` | any | Filtered to the viewer's audience |
| POST | `/announcements` | ADMINS | `{title, body, audience, notifyByEmail?, notifyBySms?}` — broadcasts via SendGrid/Twilio |
| DELETE | `/announcements/:id` | ADMINS | |
| GET | `/messages?box=inbox\|sent` | any | Direct messages |
| GET | `/messages/contacts` | any | Valid recipients (parents/students → staff only) |
| POST | `/messages` | any | `{recipientId, subject?, body}` |
| PATCH | `/messages/:id/read` | recipient | |

## Dashboard, uploads, admin

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard/stats` | STAFF | Totals, attendance rate, fee collection rate, outstanding, class performance |
| GET | `/dashboard/me` | PARENT/STUDENT | Children/own balances + current term |
| POST | `/uploads/passport` `/uploads/logo` | ADMINS | multipart `file` (JPEG/PNG/WebP ≤ 2 MB) → Cloudinary or local |
| POST | `/uploads/avatar` | any · `/uploads/materials`: TEACHER/ADMINS | |
| GET/POST/PATCH | `/users` | ADMINS | Account management; only SUPER_ADMIN can create admins |
| GET | `/users/audit-logs` | ADMINS | Activity tracking (who did what, when, from which IP) |
| GET | `/health` | public | Liveness probe |

## Platform console — PLATFORM_OWNER only

Subscription management, outside every school. This is the only area where more
than one school is visible at once. `requirePlatformOwner` is mounted on the
router rather than per-route, so a new route cannot forget it.

| Method | Path | Description |
|---|---|---|
| GET | `/platform/overview` | Schools, pupils across the platform, recurring revenue from ACTIVE schools, counts expiring within 30 days and already expired |
| GET | `/platform/schools?q=&status=` | Every school with pupil and account counts |
| GET | `/platform/schools/:id` | One school in detail: pupils, staff, fees collected, its admin accounts, and whether online payment is configured |
| POST | `/platform/schools` | Create a school **and its first super-admin in one transaction** — a school nobody can sign in to is not a usable school. Slug and `numberPrefix` are derived from the name; a slug clash gets a numeric suffix |
| PATCH | `/platform/schools/:id` | Name, contact, plan, price, `subscriptionStatus`, `subscriptionEndsAt`, `isActive`, private notes |
| POST | `/platform/schools/:id/renew` | `{months}` — extends from the existing end date when it is still in the future, so renewing early does not cost the school time it already paid for |
| PUT | `/platform/schools/:id/paystack` | `{secretKey}` — the school's own gateway key; empty string switches online payment off |

`paystackSecretKey` is **never returned by any response**. The detail endpoint
reports `onlinePaymentConfigured: true|false` instead, and the audit entry
records only whether a key is now set.

### Payment gateway per school

Each school receives fees into its own Paystack account; money never passes
through the platform. The webhook therefore has to pick the right key before it
can check the signature: it reads the reference from the (still untrusted) body,
looks up which school that payment belongs to, and verifies the HMAC with that
school's key. A forged reference selects a key that then fails to verify.

Schools with no key of their own fall back to the server-wide
`PAYSTACK_SECRET_KEY`, which is how the founding school keeps working.

## Error codes

| Code | Meaning |
|---|---|
| 400 | Validation failed (`details` lists field errors); several schools exist and none was named |
| 401 | Missing/invalid/expired token, bad credentials, bad webhook signature |
| 402 | Report card locked — fees outstanding; **or** the school's subscription has expired |
| 403 | Role not permitted / not your child / deactivated account; school suspended or cancelled; school account reaching `/platform`, or a platform account reaching school routes |
| 404 | Not found — **including anything belonging to another school** |
| 409 | Duplicate (unique constraint) or guarded delete |
| 429 | Rate limit exceeded |
