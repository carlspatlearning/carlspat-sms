# Carlspat SMS — Installation Guide

## Prerequisites

- Node.js 20+ and npm 10+
- PostgreSQL 15+ (or Docker)
- Git (optional)

## Option A — Docker (recommended, one command)

```bash
cd carlspat-sms
docker compose up --build
```

This starts:

| Service | URL |
|---|---|
| PostgreSQL 16 | `localhost:5432` (`carlspat` / `carlspat`) |
| API (Express) | http://localhost:4000/api/v1/health |
| Web (Next.js) | http://localhost:3000 |

Migrations and seed data run automatically on first API start.

## Option B — Manual (development)

### 1. Database

Create a database, e.g.:

```sql
CREATE USER carlspat WITH PASSWORD 'carlspat';
CREATE DATABASE carlspat_sms OWNER carlspat;
```

### 2. Backend

```bash
cd server
cp .env.example .env          # then edit DATABASE_URL + JWT secrets
npm install
npx prisma migrate deploy     # apply SQL migrations
npx prisma db seed            # demo school, classes, users
npm run dev                   # http://localhost:4000
```

Generate strong JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Frontend

```bash
cd web
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
npm install
npm run dev                   # http://localhost:3000
```

## Seeded demo accounts

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@carlspat.sch.ng` | `SuperAdmin#1` |
| School Admin | `admin@carlspat.sch.ng` | `Admin#12345` |
| Teacher | `teacher@carlspat.sch.ng` | `Teacher#123` |
| Parent | `parent@carlspat.sch.ng` | `Parent#1234` |
| Student | `student@carlspat.sch.ng` | `Student#123` |
| Bursar | `bursar@carlspat.sch.ng` | `Bursar#1234` |

> **Change every password immediately in production** (Profile → Change password,
> or Admin → User Accounts → reset).

The seed also creates the 2025/2026 session (Third Term current), 10 classes,
12 subjects, the default assessment structure and grade scale, Primary 5 fee
structure, sample scores/attendance, and two payments — one child fully paid
(report card unlocked) and one part-paid (locked) so you can see the fee lock
working out of the box.

## Optional integrations (all work without them in dev — messages are logged)

| Feature | Env vars (server/.env) |
|---|---|
| Cloudinary image storage | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Paystack online payments | `PAYSTACK_SECRET_KEY` + webhook → `/api/v1/payments/webhooks/paystack` |
| Flutterwave | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` + webhook → `/api/v1/payments/webhooks/flutterwave` |
| SendGrid email | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` |
| Twilio SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |

## Verify the installation

```bash
cd server && npm test          # 22 tests should pass
curl http://localhost:4000/api/v1/health
```

Then log in at http://localhost:3000 as the admin and open **School Settings** —
update the school name/motto/logo and watch it change on the login page,
report cards and receipts with no code edits.
