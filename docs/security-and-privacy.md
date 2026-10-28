# Security and privacy

## Configuration and sessions

The Slipy API URL, Cognito user pool and client IDs, Google OAuth client ID, and Vite base path are public frontend configuration. Service-role keys, database passwords, email-provider keys, OAuth client secrets, and other private credentials must never be exposed through `VITE_` variables.

Amazon Cognito (`amazon-cognito-identity-js`) manages browser session persistence and refresh, and the access token is sent to the Slipy API as a bearer token. Application code does not copy tokens to custom storage keys. Google Drive is connected through the API: the browser only receives a one-time Google authorization code, which the API exchanges and stores encrypted. No Google access or refresh token ever reaches the browser.

## Authorization

Every user-owned table has RLS. Payment policies verify ownership of referenced companies and recipients. Child policies derive ownership through the parent slip. Column grants prevent clients from updating `profiles.plan`; Free company writes cannot disable Sliply branding. RPCs execute as the caller and remain subject to RLS.

## Sensitive fields and logos

Recipient identification is stored only through an explicit local save, cloud save, or import. Lists mask it. Production logs must not contain tokens, payment objects, addresses, bank details, or identification values. React renders text normally and the app has no `dangerouslySetInnerHTML` path.

The legacy editor accepts image files up to 2 MB and stores Base64 locally. Cloud logo storage is not implemented. A future bucket must validate decoded content and size, use paths rather than persisted signed URLs, and have an explicit access policy.

## Data and deletion

Guest data stays in browser storage unless cloud import is explicitly accepted. Import never deletes local data. Cloud records (Pro only) live in the Slipy API database. Pro customers can download all of their data and delete their Slipy data from account settings; the HSClogic account is kept. Lapsed customers can download during the 14-day grace period, after which data is archived for 24 months and obtained through HSClogic support.

Known limitations include no enterprise audit log, automatic conflict merging, cloud logo upload, or self-service account deletion. Email and signatures remain outside Phase 1. Hosted RLS and concurrency require project-level verification.
