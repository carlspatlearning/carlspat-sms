# Carlspat SMS — Deployment & Production Setup Guide

Recommended topology (free/cheap tiers available):

- **Frontend** → Vercel
- **Backend + PostgreSQL** → Railway (or Render / AWS)
- **Images** → Cloudinary
- **Email/SMS** → SendGrid / Twilio
- **Payments** → Paystack and/or Flutterwave

HTTPS is terminated automatically by Vercel/Railway/Render. Never expose the API over plain HTTP in production.

---

## 1. Backend on Railway

1. Create a project → **Add PostgreSQL** (Railway provisions `DATABASE_URL`).
2. **Add service → GitHub repo**, root directory `server/`. Railway detects the Dockerfile.
3. Set environment variables:

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_ACCESS_SECRET=<64+ random hex chars>
JWT_REFRESH_SECRET=<different 64+ random hex chars>
CORS_ORIGIN=https://your-app.vercel.app
PAYMENT_CALLBACK_URL=https://your-app.vercel.app/dashboard/fees
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
PAYSTACK_SECRET_KEY=sk_live_...
FLUTTERWAVE_SECRET_KEY=...
FLUTTERWAVE_WEBHOOK_HASH=<random string you also paste in the FLW dashboard>
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=carlspatprivateschool@outlook.com
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

4. The container entrypoint runs `prisma migrate deploy` then starts the API,
   so schema changes apply automatically on each deploy.
5. One-time: open a shell on the service and seed → `npx prisma db seed`.

**Render equivalent:** New Web Service → root `server` → Docker; New PostgreSQL; same env vars.
**AWS equivalent:** ECR + ECS Fargate (or a single EC2 with docker compose) + RDS PostgreSQL behind an ALB with an ACM certificate.

## 2. Frontend on Vercel

1. **Import the repo** → set **Root Directory = `web`**. Vercel auto-detects Next.js.
2. Environment variable:

```env
NEXT_PUBLIC_API_URL=https://<your-railway-api-domain>/api/v1
```

3. Deploy. Add your custom domain (e.g. `portal.carlspat.sch.ng`) in Vercel → Domains.
4. Update `CORS_ORIGIN` on the backend to the final frontend URL(s), comma-separated.

## 3. Payment gateway webhooks

| Gateway | Dashboard setting | URL |
|---|---|---|
| Paystack | Settings → API Keys & Webhooks | `https://<api-domain>/api/v1/payments/webhooks/paystack` |
| Flutterwave | Settings → Webhooks (set the secret hash = `FLUTTERWAVE_WEBHOOK_HASH`) | `https://<api-domain>/api/v1/payments/webhooks/flutterwave` |

Webhook signatures are verified server-side (HMAC-SHA512 for Paystack, `verif-hash` for Flutterwave); payments only flip from PENDING → SUCCESS via a valid webhook.

## 4. Docker self-hosting (single VPS)

```bash
git clone <repo> && cd carlspat-sms
cp server/.env.example server/.env   # fill in production values
docker compose up -d --build
```

Put Caddy or nginx in front for TLS:

```
portal.example.com {
    reverse_proxy localhost:3000
}
api.example.com {
    reverse_proxy localhost:4000
}
```

## 5. CI/CD

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push/PR:

1. **server**: `npm ci` → `prisma generate` → `tsc --noEmit` → `jest` (22 tests)
2. **web**: `npm ci` → `next build` (includes type checking)

Vercel and Railway both auto-deploy on push to `main` once connected; the CI gate
ensures broken commits never reach them (enable "Wait for CI" in Railway settings
and branch protection on GitHub).

## 6. Production checklist

- [ ] All six seeded demo passwords changed (or demo users deleted/disabled)
- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` ≥ 48 random bytes, unique per environment
- [ ] `CORS_ORIGIN` lists only the real frontend domain(s)
- [ ] Live (not test) Paystack/Flutterwave keys; webhooks configured and test-fired
- [ ] Cloudinary configured (local `/uploads` storage is for development only)
- [ ] Daily `pg_dump` backups scheduled and restore tested (see DATABASE.md)
- [ ] Audit log reviewed periodically (Admin → User Accounts → audit endpoint)
- [ ] Rate limits left enabled (default: 1000 req/15 min global, 20 logins/15 min)

## 7. Free deployment: Supabase (database) + Render (API) + Vercel (web)

Supabase provides a free PostgreSQL database that never expires. Pair it with
Render free web service for the API and Vercel free tier for the frontend for
a NGN 0/month deployment.

### 7.1 Database on Supabase
1. Sign up at https://supabase.com with GitHub. Create a project (e.g. `carlspat-sms`),
   region **West EU (London)** (closest to Nigeria), and set a strong database password.
2. Project Settings -> Database -> Connection string -> **Session pooler** (IPv4-compatible).
   It looks like:
   `postgresql://postgres.abcdefgh:[PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`
3. Replace `[PASSWORD]` with your database password. This is your `DATABASE_URL`.

### 7.2 API on Render
1. Sign up at https://render.com with GitHub. New -> Web Service -> pick the repo.
2. Root Directory `server`. Build command:
   `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
   Start command: `npm start`. Instance type: **Free**.
3. Environment variables: `DATABASE_URL` (from 7.1), `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET` (long random strings), `CORS_ORIGIN` (your Vercel URL),
   `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` (required:
   Render free disks are wiped on every deploy, so images must live in Cloudinary).
4. After the first deploy, run the seed once from the service Shell tab: `npm run seed`.
5. Note the public URL, e.g. `https://carlspat-api.onrender.com`.

Note: free Render services sleep after 15 minutes of inactivity; the first request
after a sleep takes ~30-60 s. Upgrade to the USD 7/month instance to remove this.

### 7.3 Web on Vercel
1. Sign up at https://vercel.com with GitHub. Add New -> Project -> import the repo.
2. Root Directory `web`. Environment variable:
   `NEXT_PUBLIC_API_URL=https://carlspat-api.onrender.com/api/v1`
3. Deploy, then put the resulting URL into the API's `CORS_ORIGIN` on Render.
