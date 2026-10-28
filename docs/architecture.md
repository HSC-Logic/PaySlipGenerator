# Sliply architecture

Sliply remains local-first. The root HashRouter route renders the editor and its browser persistence, calculations, preview, PDF, and print paths. Every HSClogic account can sign in, but the cloud is exclusive to Pro: the Slipy API (`VITE_API_BASE_URL`) rejects any token without the `slipy-pro` Cognito group. Without the API URL and the Cognito pool values, `cloudDataEnabled` is false and the app stays browser-only.

Authenticated routes are separated from document state. `AuthProvider` owns Cognito session restoration, the plan (`planFromSession`), the lapsed state (`isLapsed`) and `cloudAccess` (cloud configured, signed in, `slipy-pro` present, and not rejected by the server). Cloud routes (dashboard, payments, companies, recipients) sit behind `ProGate`, which shows an upgrade panel linking to `/plans` instead of mounting them. Account settings stay available to every signed-in account. `apiFetch` refuses to call the API without `slipy-pro` in the token (only `GET /account/export` also accepts `slipy-lapsed`) and maps ProblemDetails, including a server `pro-required`, to `ApiError`.

UI pages call repository contracts; the `Api*` repositories map between API DTOs and the existing `PaymentSlip` model (`services/repositories/mappers.ts`). Edits send the `version` last read and surface a 409 as a conflict. PDF and preview continue consuming the same model.

Logos are normalised in the browser (`utils/logoImage.ts`: at most 600 px, PNG, JPEG 0.85 fallback, 512 KB limit) and uploaded as `data:` URLs. Responses carry `logoId`; `services/logos.ts` fetches `GET /logos/{id}` once per id with the bearer token and hands the preview and jsPDF a `data:` URL.

Trust boundaries:

- Browser-local data is untrusted input and is validated on load.
- Cognito identifiers in `VITE_` variables are public configuration, not credentials.
- The API validates the access token and enforces tenant isolation; the browser only interprets the plan.
- Attribution removal is the one Pro feature enforced in the browser (PDFs are rendered client-side).
- Google Drive runs through the API (Pro only): the browser gets a one-time authorization code with `initCodeClient` and posts it to `POST /drive/connection`; the API stores the refresh token and performs every Drive call. The browser never holds a Google token.
- Pro users keep saved PDF designs in the cloud (`/designs`); Free users keep them in `localStorage` (`payment-slip-custom-designs`).

HashRouter keeps refreshes under `/PaySlipGenerator/` compatible with GitHub Pages. Cloud writes retain company and recipient snapshots on each payment.

## Repository boundaries

- `services/repositories/contracts.ts`: UI-facing persistence contracts.
- `services/repositories/apiRepository.ts`: Slipy API implementation.
- `services/api/client.ts`: bearer token, Pro guard, ProblemDetails mapping.
- `utils/storage.ts`: guest/local storage and recovery.

Failed cloud writes preserve the editor and its local recovery snapshot; users retry explicitly.

## History: Supabase

The Phase 1 cloud used Supabase (Auth, PostgreSQL RLS, RPCs `save_payment_slip`, `reserve_payment_reference`, `payment_dashboard_summary`). It was replaced by the Slipy API and the shared HSClogic Cognito pool; the Supabase client, repositories and setup guide were removed. `supabase/migrations` is kept only as the reference the backend schema was derived from and is not used by the app.
