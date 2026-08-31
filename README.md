# Sliply — Payment Slip Generator

A private, browser-based payment-slip workspace for creating professional A4 payment records. Sliply is built with React, TypeScript, and Vite and is designed for free hosting on GitHub Pages. PDF generation, printing, draft storage, and calculations work without a backend.

## Features

- Live A4 payment-slip preview with responsive desktop and mobile layouts
- Guided Company → Recipient → Payment → Review workflow with preserved form state
- Company, recipient, payment, line-item, adjustment, and signature details
- Selectable LKR, USD, EUR, GBP, INR, AUD, CAD, and SGD formatting with currency-aware amount-in-words conversion
- Optional custom bottom seal such as “Thank You”, “Paid”, or “Received”
- Company theme-color picker that updates the live slip and exported PDF
- Persistent light and dark application themes with automatic first-use system preference
- A4 (default), A5, B5, and Letter documents in portrait or landscape orientation
- Fixed or percentage discounts, VAT/tax, service, delivery, and custom charges
- Sharp, text-based A4 PDF export through jsPDF (not a screenshot)
- Print stylesheet that prints only the payment slip
- Browser-local saved company profile, drafts, and yearly `PS-{YEAR}-{SEQUENCE}` reference sequence
- Field-level validation, accessible labels, notices, and loading states
- Optional, session-only Google Drive OAuth and Google Docs creation
- Automated calculation/reference tests and GitHub Pages deployment workflow

## Local development

Requires Node.js 24 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Open the local URL printed by Vite. Google integration is optional; leave `VITE_GOOGLE_CLIENT_ID` blank to run in setup-required mode.

Other commands:

```bash
npm test          # run utility tests
npm run build     # TypeScript validation and production build
npm run preview   # preview the production build
```

For local development, set `VITE_BASE_PATH=/`. For a repository Pages site, use `/repository-name/`. A future custom domain should use `/`.

## Deploy to GitHub Pages

1. Push this project to GitHub with `main` as the deployment branch.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main`, or open **Actions → Deploy to GitHub Pages → Run workflow**.
5. When the workflow completes, the site is available at `https://USERNAME.github.io/REPOSITORY-NAME/`.

Pages must be enabled once before the first workflow run. If `actions/configure-pages` reports `Get Pages site failed: Not Found`, open **Settings → Pages**, select **GitHub Actions** as the source, save the setting, and rerun the failed workflow. The standard workflow token cannot initialize a previously disabled Pages site automatically; the action's `enablement` option requires a separate elevated token, so this project intentionally uses the safer one-time settings step.

The workflow calculates the correct Vite base path from the repository name. For a custom domain, add the domain in Pages settings and change the workflow's `VITE_BASE_PATH` to `/` (and add a `public/CNAME` file if appropriate).

## Enable Google Drive and Docs

The core application does not need Google configuration. To enable the optional buttons:

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. In **APIs & Services → Library**, enable **Google Drive API** and **Google Docs API**.
3. Open **Google Auth Platform** and configure the OAuth consent screen. Add the app name, support email, developer contact, and any test users required while the app remains in testing.
4. Create an OAuth client from **APIs & Services → Credentials → Create credentials → OAuth client ID** and choose **Web application**.
5. Add both local development and the exact Pages origin as authorized JavaScript origins, for example:
   - `http://localhost:5173`
   - `https://USERNAME.github.io`
6. Copy the public client ID. Never create or include a client secret in this client-side app.
7. Locally, place it in an uncommitted `.env` file:

   ```env
   VITE_GOOGLE_CLIENT_ID=000000000000-example.apps.googleusercontent.com
   VITE_BASE_PATH=/
   ```

8. For GitHub Pages, add it as a repository variable named `VITE_GOOGLE_CLIENT_ID` under **Settings → Secrets and variables → Actions → Variables**. It is a public browser client identifier, not a secret.

The integration requests only `drive.file`, which limits access to files created or explicitly opened by this application. Access tokens are retained only in memory and are never persisted to localStorage. Disconnecting revokes the current token.

### Folder selection note

The application lists folders that the granted `drive.file` scope makes available and asks the user to select one. Under this minimum-privilege scope, Google may only expose folders the app has created or that the user has explicitly opened with the app. If no folder is visible, create or expose a folder to the app first. A broader all-Drive scope is intentionally not requested.

## Privacy and security

- Payment information, NIC/ID details, company profiles, and drafts stay in the browser's localStorage.
- No analytics, advertising, tracking, database, server, or third-party data processing is included.
- Data leaves the device only when the user explicitly creates a Google Doc.
- OAuth access tokens are held in memory for the current page session only.
- Local browser data is not encrypted; avoid using a shared browser profile for sensitive records and clear site data when appropriate.
- Uploaded logos are limited to image files smaller than 2 MB.

### Payment reference persistence

Each new payment reserves the next browser-local reference in the form `PS-2026-0001`. The yearly counter and issued-reference list are stored in `localStorage`; the active reference is also held in `sessionStorage` so refreshing the same tab does not consume another number. “Another slip” and the generate-reference button explicitly reserve the next number. Manual edits are preserved in the payment and in saved drafts. Existing legacy yearly counters and higher `PS-…` references found in the saved draft are used when choosing the next sequence.

## Known limitations

- Browser storage belongs to one browser profile/device and is not synchronized or backed up.
- Clearing site data removes saved settings, drafts, and the local reference sequence.
- Reference numbers are unique only within the locally available browser profile and year. Separate devices/profiles are not coordinated, and simultaneous creation in multiple tabs is not an atomic distributed operation.
- Reserved or deleted payments can leave sequence gaps; references are intentionally not reused.
- Google authorization requires an owner-supplied OAuth client ID and correct authorized origins.
- The minimum Drive scope can limit which pre-existing folders are listed.
- Very large numbers beyond normal payment ranges are not intended for the amount-in-words converter.
