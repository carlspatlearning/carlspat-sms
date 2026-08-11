# Carlspat SMS — Local Setup Guide

This is a step-by-step, environment-verified guide to running the project locally.
It documents exactly what this repo requires — confirmed by inspecting the
Dockerfiles, CI workflow, `package.json` files, `schema.prisma`, and `.env.example`
files — not just what the READMEs describe.

> This repo was restored from GitHub after a fresh OS/SSD install. `node_modules/`,
> `.env` files, and the local `uploads/` folder are all gitignored and are
> **not present** — they must be recreated following this guide.

---

## 1. Prerequisites

| Requirement | Version | Evidence |
|---|---|---|
| Node.js | **20.x** | `server/Dockerfile` / `web/Dockerfile` use `node:20-alpine`; CI (`.github/workflows/ci.yml`) pins `node-version: 20` |
| npm | **10.x** (ships with Node 20) | Only `package-lock.json` files exist (see §2) — no `yarn.lock` / `pnpm-lock.yaml` |
| PostgreSQL | **15+** (16 used in Docker/CI) | `docker-compose.yml` and CI both use `postgres:16-alpine`; README states "PostgreSQL ≥ 15" |
| Docker + Docker Compose | optional but recommended | `docker-compose.yml` at repo root runs DB + API + web in one command |
| Git | optional | only needed if you re-clone |

**This environment currently has neither `node` nor `npm` on PATH** — confirmed via
`node --version` / `npm --version` returning "command not found". Install Node 20 LTS
(e.g. via [nodejs.org](https://nodejs.org), `nvm`, or `winget install OpenJS.NodeJS.LTS`
on Windows) before continuing with the manual path. If you use Docker Desktop instead,
Node does not need to be installed on the host at all.

## 2. Package manager

**npm** — confirmed by the presence of `server/package-lock.json` and
`web/package-lock.json` only (no `yarn.lock`, no `pnpm-lock.yaml`, no `packageManager`
field in either `package.json`). Use `npm install` / `npm ci`, not `yarn` or `pnpm`.

## 3. Two backends, two apps — what to install where

This is a monorepo with **two independently-installed Node projects**, not a single
root install:

```
carlspat-sms/
├── server/   ← npm install here (Express API)
└── web/      ← npm install here (Next.js app)
```

There is no root `package.json` — do not run `npm install` from the repo root.

## 4. Database requirements

- PostgreSQL 15+ (16 recommended to match Docker/CI).
- One database + one user with full privileges on it.
- Prisma manages the schema via migrations already committed in
  `server/prisma/migrations/` (`0001_init` → `0005_promotion_type`) — you do not
  write SQL by hand, you run `prisma migrate` commands (below).

**Fastest path:** let `docker compose up --build` provision Postgres for you — no
local Postgres install needed at all, even if you run the API/web manually afterward
(you can point `DATABASE_URL` in `server/.env` at the Dockerized DB on `localhost:5432`).

**Manual path:** create the DB yourself:

```sql
CREATE USER carlspat WITH PASSWORD 'carlspat_dev_password';
CREATE DATABASE carlspat_sms OWNER carlspat;
```

## 5. Environment variables

Neither `server/.env` nor `web/.env.local` exists in this checkout — only the
`.env.example` templates. Copy and fill them in:

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env.local
```

### `server/.env`

| Variable | Required? | Notes |
|---|---|---|
| `NODE_ENV` | optional | defaults to `development` |
| `PORT` | optional | defaults to `4000` |
| `DATABASE_URL` | **required** | e.g. `postgresql://carlspat:carlspat_dev_password@localhost:5432/carlspat_sms?schema=public` |
| `JWT_ACCESS_SECRET` | **required** | ≥ 32 chars. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | **required** | must differ from the access secret |
| `JWT_ACCESS_TTL` | optional | defaults `15m` |
| `JWT_REFRESH_TTL` | optional | defaults `7d` |
| `CORS_ORIGIN` | optional | defaults `http://localhost:3000`; comma-separated for multiple origins |
| `SEED_ON_START` | optional | `true`/`false`; used by the Docker entrypoint only, not `npm run dev` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | optional | omit → uploads fall back to local `server/uploads/`, served at `/uploads` |
| `PAYSTACK_SECRET_KEY` | optional | omit → `/payments/paystack/init` returns 400 "not configured" |
| `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_WEBHOOK_HASH` | optional | same as above for Flutterwave |
| `PAYMENT_CALLBACK_URL` | optional | defaults `http://localhost:3000/dashboard/fees` |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | optional | omit → emails are logged to console instead of sent (`server/src/services/notify.ts`) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | optional | omit → SMS logged to console instead of sent |

Only `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` are enforced at
startup (`server/src/config/env.ts` throws if missing) — everything else is
genuinely optional for local dev.

### `web/.env.local`

| Variable | Required? | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | **required** | e.g. `http://localhost:4000/api/v1` — must include `/api/v1` and no trailing slash |

## 6. Exact commands

### Option A — Docker (fastest, no local Node/Postgres needed)

```bash
docker compose up --build
```

Starts Postgres 16, the API (with `prisma migrate deploy` + optional seed on boot),
and the web app together. Web: http://localhost:3000, API health:
http://localhost:4000/api/v1/health.

### Option B — Manual

**Backend:**

```bash
cd server
cp .env.example .env              # then edit DATABASE_URL + JWT secrets
npm install
npx prisma generate               # generates the Prisma client into node_modules
npx prisma migrate deploy         # applies the 5 committed migrations
npm run seed                      # tsx prisma/seed.ts — idempotent
npm run dev                       # tsx watch src/index.ts → http://localhost:4000
```

Use `npx prisma migrate dev` instead of `migrate deploy` only if you intend to
author a *new* migration; for just applying the existing ones, `migrate deploy`
is what CI and Docker both use and is safer (non-interactive, no drift prompts).

**Frontend** (separate terminal):

```bash
cd web
cp .env.example .env.local
npm install
npm run dev                       # next dev → http://localhost:3000
```

### Verify

```bash
curl http://localhost:4000/api/v1/health
cd server && npm test             # Jest test suite (auth, JWT, grading, fee-lock)
```

Then open http://localhost:3000/login.

## 7. ⚠️ Demo account discrepancy (verified against current code)

`README.md` and `docs/INSTALL.md` both list **six** seeded demo accounts, including:

```
Parent    parent@carlspat.sch.ng    Parent#1234
Student   student@carlspat.sch.ng   Student#123
```

**This is stale.** Reading `server/prisma/seed.ts` directly shows it only creates
**four** users: `superadmin@carlspat.sch.ng`, `admin@carlspat.sch.ng`,
`bursar@carlspat.sch.ng`, and two teachers (`teacher@carlspat.sch.ng`,
`teacher2@carlspat.sch.ng`). No parent or student user, and no sample
students/scores/attendance/payments are created — consistent with the commit
`c8a6bb7 Remove all demo/sample data from seed — only structural config remains`,
which post-dates whatever version the docs were last describing.

Parent and Student logins are created **manually**, per-student, via the Admin →
Students UI (`POST /students` with an optional `createLogin: { email, password }`
field — see `server/src/routes/students.ts`). To get a working Parent/Student login
locally you must first create a student record as Admin and supply login credentials
at creation time; there is no shortcut seed for this today.

*(This guide does not change `README.md` or `docs/INSTALL.md` — flagging the
discrepancy here per instructions not to modify other files yet.)*

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Missing required environment variable: DATABASE_URL` on `npm run dev` | `server/.env` missing or not copied from `.env.example` |
| `PrismaClientInitializationError` / ECONNREFUSED on 5432 | Postgres isn't running, or `DATABASE_URL` host/port/credentials don't match your actual DB |
| `Cannot find module '@prisma/client'` or types missing | Run `npx prisma generate` inside `server/` (it's a build step, not automatic on `npm install`) |
| API starts but every request 401s | Check `web/.env.local`'s `NEXT_PUBLIC_API_URL` matches the running API's actual host/port |
| CORS errors in browser console | `CORS_ORIGIN` in `server/.env` doesn't match the URL the web app is actually served from |
| `npm run seed` fails with a unique-constraint error | Seed is idempotent via upserts for most rows but assumes it's re-run against the same school row; if you hand-edited data outside the seed's expectations, drop and recreate the dev DB |
| Port 4000 or 3000 already in use | Something else is bound to it — change `PORT` (server) or run `next dev -p <port>` (web), and update `NEXT_PUBLIC_API_URL` / `CORS_ORIGIN` to match |
| File uploads 404 after restart | Local `server/uploads/` is gitignored and not persisted outside the container/process — expected in dev without Cloudinary configured |

## 9. What's *not* needed for local dev

- Cloudinary, Paystack, Flutterwave, SendGrid, Twilio credentials — all optional,
  all degrade gracefully (see §5 table).
- A root-level `npm install` — there is no root `package.json`.
- Manually writing SQL — Prisma migrations are already committed; just apply them.
