# Carlspat School Management — Android

This project packages the existing Carlspat School Management web application as an Android Trusted Web Activity.

- Package ID: `com.carlspat.sms`
- Start URL: `https://carlspat-sms.vercel.app/login?source=android`
- Web and Android users share the same server, accounts, role permissions, and records.
- The Android package contains no school database and runs no database migrations.

## Build

The release APK is built by the GitHub Actions workflow in `.github/workflows/android-apk.yml`. It signs the release with the private key supplied through two encrypted repository Actions secrets:

- `ANDROID_SIGNING_KEY_B64`: base64-encoded PKCS#12 keystore.
- `ANDROID_SIGNING_PASSWORD`: keystore and key password.

The signing keystore is excluded from Git. Keep a secure backup of both the keystore and its password: future app updates must use the same signing key.

For a local build, install the pinned Node dependency and run Bubblewrap from this directory:

```powershell
npm ci
node node_modules/@bubblewrap/cli/bin/bubblewrap.js build
```
