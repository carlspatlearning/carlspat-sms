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

`SUPER_ADMIN`, `ADMIN`, `TEACHER`, `PARENT`, `STUDENT`, `ACCOUNTANT`.
**ADMINS** below = SUPER_ADMIN + ADMIN. **STAFF** = ADMINS + TEACHER + ACCOUNTANT.
**FEE_MANAGERS** = ADMINS + ACCOUNTANT.

## School settings (admin-editable, no code changes)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/settings/school` | public | School name, motto, address, phone, email, logo |
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
| GET | `/payments/:id/receipt` | staff / own | PDF receipt |
| POST | `/payments/paystack/init` | parent/own | → `{authorizationUrl}`; confirmed by webhook |
| POST | `/payments/flutterwave/init` | parent/own | → `{authorizationUrl}` |
| POST | `/payments/webhooks/paystack` | signature | HMAC-SHA512 `x-paystack-signature` over raw body |
| POST | `/payments/webhooks/flutterwave` | signature | `verif-hash` header |
| GET | `/payments/reports/summary?termId=` | FEE_MANAGERS | Totals, by method, recent payments |

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

## Error codes

| Code | Meaning |
|---|---|
| 400 | Validation failed (`details` lists field errors) |
| 401 | Missing/invalid/expired token, bad credentials |
| 402 | Report card locked — fees outstanding |
| 403 | Role not permitted / not your child / deactivated account |
| 404 | Not found |
| 409 | Duplicate (unique constraint) or guarded delete |
| 429 | Rate limit exceeded |
