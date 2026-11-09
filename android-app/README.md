# Carlspat School Management — Android

This project packages the existing Carlspat School Management web application as an Android Trusted Web Activity.

- Package ID: `com.carlspat.sms`
- Start URL: `https://carlspat-sms.vercel.app/login?source=android`
- Web and Android users share the same server, accounts, role permissions, and records.
- The Android package contains no school database and runs no database migrations.

## Build

Install the pinned Node dependency, then run Bubblewrap from this directory:

```powershell
npm ci
node node_modules/@bubblewrap/cli/bin/bubblewrap.js build
```

The signing keystore and credentials are deliberately excluded from Git. Keep the release-key backup safe: every future update must be signed with the same key.
