# Carlspat Private School — School Management System   

> **Motto:** Emphasis on All-Round Development
> Surulere, Old Keye Water Factory, Opposite Luku Panel Beater, Ora Road, Ido Ekiti, Ekiti State, Nigeria
> 📞 08067281676 · ✉️ carlspatprivateschool@outlook.com

A production-ready, cloud-based School Management System with role-based portals for
**Super Admin, School Admin, Teachers, Parents, Students, and the Accountant/Bursar**.

All school information (name, logo, motto, address, phone, email, academic sessions,
classes, subjects, grading system, assessment structure) is **editable from the Admin
Dashboard** — no code changes required.

## Monorepo Layout

```
carlspat-sms/
├── server/          # Express + TypeScript + Prisma + PostgreSQL REST API
├── web/             # Next.js (App Router) + TypeScript + Tailwind CSS + shadcn-style UI
├── docs/            # API docs, DB schema/ERD, deployment & user guides
├── .github/         # CI pipeline (GitHub Actions)
└── docker-compose.yml
```

## Quick Start (Local, with Docker)

```bash
docker compose up --build
```

- Web portal: http://localhost:3000
- API: http://localhost:4000/api/v1
- API health: http://localhost:4000/api/v1/health

## Quick Start (Manual)

Requirements: Node.js ≥ 20, PostgreSQL ≥ 15.

```bash
# 1. Backend
cd server
cp .env.example .env          # set DATABASE_URL + JWT secrets
npm install
npx prisma migrate dev        # creates schema
npm run seed                  # seeds school, roles, demo users, grading, fees
npm run dev                   # http://localhost:4000

# 2. Frontend
cd ../web
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

## Seeded Demo Accounts

| Role        | Email                          | Password      |
|-------------|--------------------------------|---------------|
| Super Admin | superadmin@carlspat.sch.ng     | SuperAdmin#1  |
| Admin       | admin@carlspat.sch.ng          | Admin#12345   |
| Teacher     | teacher@carlspat.sch.ng        | Teacher#123   |
| Parent      | parent@carlspat.sch.ng         | Parent#1234   |
| Student     | student@carlspat.sch.ng        | Student#123   |
| Accountant  | bursar@carlspat.sch.ng         | Bursar#1234   |

> Change all passwords immediately in production (`/dashboard/profile`).

## Key Business Rule — Report Card Fee Lock

Parents/students can **only view, download, or print report cards when school fees are
fully paid** for the term. With any outstanding balance the API returns `402` and the UI
shows: *“Access to report card is restricted until school fees have been fully paid.”*

## Documentation

- [docs/INSTALL.md](docs/INSTALL.md) — installation guide
- [docs/API.md](docs/API.md) — REST API reference
- [docs/DATABASE.md](docs/DATABASE.md) — schema + ER diagram
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Vercel / Railway / Render / AWS + Docker
- [docs/USER_MANUAL.md](docs/USER_MANUAL.md) — per-role user manual

## License

Proprietary — © Carlspat Private School.
