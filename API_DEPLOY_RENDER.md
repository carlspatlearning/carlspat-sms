# Deploy the online API to Render and use Supabase Postgres

This repository has a Next.js website in `web/` and an Express API in `server/`. The API needs its own public service URL. The Supabase dashboard URL is not the API URL.

## Prepare the repository

The root `render.yaml` defines the Express service using Render's native Node runtime, `/api/v1/health` health check, production settings, and generated JWT secrets. It prompts for `DATABASE_URL` instead of putting credentials in source. Render installs dependencies, generates Prisma, builds the API, applies migrations at startup, and starts the server. Docker is not required on your PC or for this Render service.

Push the updated `carlspatlearning/carlspat-sms` repository to its `main` branch. The current Render workspace must have GitHub access to that repository.

## Create the Render service

1. In Render, choose **New → Blueprint** and connect `carlspatlearning/carlspat-sms`, branch `main`.
2. Render will read the repository's `render.yaml`. Review the service and select the plan you want before creating it; the plan can affect cost and whether the service sleeps when idle.
3. When prompted for `DATABASE_URL`, open the Supabase project and choose **Connect → Session pooler**. Copy the PostgreSQL connection string (port 5432) into Render's secret field. Do not use the Supabase dashboard URL, publishable key, or service-role key here.
4. Confirm the service has generated `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, then create/deploy the Blueprint.
5. Wait for Render's deploy and health check. The API URL will look like `https://olufunmilyo-sms-api.onrender.com`; verify `https://<that-host>/api/v1/health` returns a healthy JSON response.

Render's Blueprint `sync: false` prompts for database credentials without committing them. Its `healthCheckPath` checks the API endpoint.

## Connect the website and desktop app

1. In Vercel project `carlspat-sms`, set Production `NEXT_PUBLIC_API_URL` to `https://<that-host>/api/v1`, then redeploy the website.
2. Install the updated desktop build. In **Settings & backups → Cloud data sync**, enter only the API origin, `https://<that-host>`, and sign in with the online host administrator account.
3. Choose **Copy all local records** for the initial upload. Later edits sync automatically while the desktop app is open and online.

Never send the `DATABASE_URL`, JWT secrets, or administrator password in chat. Enter them only in the respective provider's secure settings or directly in the desktop app.

The API code stores desktop records in its cloud mirror table. The website's normal student/finance screens do not yet merge mirror records into their normalized tables. Local student photos and documents also need a separate file-storage migration.
