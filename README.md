# Sliply — Payment Slip Generator

A browser-based payment-slip workspace for creating professional payment records. Sliply is built with React, TypeScript, and Vite and is designed for free hosting on GitHub Pages. PDF generation, printing, draft storage, and calculations work without a backend.

## Features

- Live payment-slip preview with responsive desktop and mobile layouts
- Guided Company → Recipient → Payment → Review workflow with preserved form state
- Company, recipient, payment, line-item, adjustment, and signature details
- Selectable LKR, USD, EUR, GBP, INR, AUD, CAD, and SGD formatting with currency-aware amount-in-words conversion
- Optional custom bottom seal such as “Thank You”, “Paid”, or “Received”
- Company theme-color picker that updates the live slip and exported PDF
- Persistent light and dark application themes with automatic first-use system preference
- A4 (default), A5, B5, and Letter documents in portrait or landscape orientation
- Fixed or percentage discounts, VAT/tax, service, delivery, and custom charges
- Sharp, text-based PDF export through jsPDF (not a screenshot)
- Printing from the same generated PDF used by downloads
- Browser-local saved company profile, reusable recipients, drafts, and yearly `PS-{YEAR}-{SEQUENCE}` reference sequence
- Searchable browser-local payment history with snapshot editing and duplication
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

PDF regression tests run as part of `npm test`. Before document-generation releases, complete the [manual PDF QA matrix](docs/pdf-manual-qa.md).

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

- Payment information, NIC/ID details, company profiles, drafts, and recovery snapshots are stored in the browser's localStorage. Reusable saved-recipient records deliberately exclude NIC/ID; NIC/ID remains only in payment drafts and recovery snapshots. The active generated reference is also kept in sessionStorage.
- There is no analytics, advertising, behavioral tracking, application backend, or database.
- The interface loads DM Sans and Manrope from Google Fonts when the page opens. As with any external web resource, that request exposes ordinary connection metadata such as the user's IP address and browser headers to the resource provider; it does not include the payment form contents.
- The optional Google integration connects only after the user selects **Connect Drive** and authorizes the requested `drive.file` scope. Folder selection retrieves available folder names and IDs. **Create Google Doc** sends the payment reference in the file title and sends the document's textual payment content to Google Drive and Docs for storage in the user's selected folder. It does not upload the logo.
- OAuth access tokens are held in memory for the current page session only.
- Local browser data is not encrypted; avoid using a shared browser profile for sensitive records and clear site data when appropriate.
- Uploaded logos are limited to image files smaller than 2 MB. Logos are stored as Base64 data, which adds roughly one-third to the source file size; because a logo may also be present in the company profile, explicit draft, and recovery snapshots, large logos can approach browser storage quotas. The application reports quota failures without changing image quality or discarding the in-memory form.

### Payment reference persistence

Each new payment reserves the next browser-local reference in the form `PS-2026-0001`. The yearly counter and issued-reference list are stored in `localStorage`; the active reference is also held in `sessionStorage` so refreshing the same tab does not consume another number. “Another slip” and the generate-reference button explicitly reserve the next number. Manual edits are preserved in the payment and in saved drafts. Existing legacy yearly counters and higher `PS-…` references found in the saved draft are used when choosing the next sequence.

### Line items and legacy drafts

Payments use line items with a description, quantity, and rate. Item amounts, subtotal, adjustments, and final total are calculated by one shared minor-unit calculation boundary used by the form, preview, PDF, and optional Google Doc output. Values are rounded to the nearest currency minor unit so decimal arithmetic does not expose binary floating-point artifacts.

When loading an older unversioned draft that has no `items` array, a valid `description` and `amount` pair—stored either on the draft or its payment section—is migrated in memory to one item with quantity `1` and the legacy amount as its rate. The original stored value is not rewritten until the user explicitly saves the draft. Malformed legacy amounts fall back safely instead of loading an invalid payment.

### Payment status

Payment workflow status is stored using the stable values `draft`, `pending`, `paid`, and `cancelled`. Existing drafts and recovery snapshots without a status load as `draft`, which avoids assuming that an older payment has been settled. Paid date and paid reference are optional and available when editing a Paid payment. They are retained if the status temporarily changes, but a newly created similar slip resets to Draft and clears settlement metadata because it represents a new transaction. Status remains workflow metadata and is not printed on the payment-slip document.

### Payment history

History uses the versioned `payment-slip-history` localStorage key. Each record contains a UUID record ID, created/updated timestamps, and a complete payment-slip snapshot. Record identity is independent from the human-readable payment reference, so duplicate reference text cannot cause an accidental overwrite. Loading a record copies its snapshot into the editor; changes are persisted only when **Update record** is selected. Company-profile and saved-recipient edits therefore do not rewrite historical entries.

Duplicating history copies company, recipient, line items, and reusable payment context, then generates a new payment reference and date, resets status to Draft, clears paid metadata and transaction reference, and assigns fresh item/adjustment IDs. The duplicate is not added to history until explicitly saved. Legacy unversioned arrays of raw payment slips are accepted and receive deterministic `legacy-…` IDs in memory. Invalid entries and duplicate record IDs are skipped without preventing the application from opening.

## Known limitations

- Browser storage belongs to one browser profile/device and is not synchronized or backed up.
- Clearing site data removes saved settings, recipients, drafts, history, and the local reference sequence.
- Reference numbers are unique only within the locally available browser profile and year. Separate devices/profiles are not coordinated, and simultaneous creation in multiple tabs is not an atomic distributed operation.
- Reserved or deleted payments can leave sequence gaps; references are intentionally not reused.
- Google authorization requires an owner-supplied OAuth client ID and correct authorized origins.
- The minimum Drive scope can limit which pre-existing folders are listed.
- Very large numbers beyond normal payment ranges are not intended for the amount-in-words converter.
