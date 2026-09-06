# Security and privacy

## Configuration and sessions

The Supabase URL, anonymous/publishable key, Google OAuth client ID, and Vite base path are public frontend configuration. Service-role keys, database passwords, email-provider keys, OAuth client secrets, and other private credentials must never be exposed through `VITE_` variables.

Supabase manages browser session persistence and refresh. Application code does not copy tokens to custom storage keys. Google Drive authorization is separate and memory-only.

## Authorization

Every user-owned table has RLS. Payment policies verify ownership of referenced companies and recipients. Child policies derive ownership through the parent slip. Column grants prevent clients from updating `profiles.plan`; Free company writes cannot disable Sliply branding. RPCs execute as the caller and remain subject to RLS.

## Sensitive fields and logos

Recipient identification is stored only through an explicit local save, cloud save, or import. Lists mask it. Production logs must not contain tokens, payment objects, addresses, bank details, or identification values. React renders text normally and the app has no `dangerouslySetInnerHTML` path.

The legacy editor accepts image files up to 2 MB and stores Base64 locally. Cloud logo storage is not implemented. A future bucket must validate decoded content and size, use paths rather than persisted signed URLs, and have an explicit access policy.

## Data and deletion

Guest data stays in browser storage unless cloud import is explicitly accepted. Import never deletes local data. Cloud records live in the configured Supabase project and may be archived in the app. Full account/cloud-data deletion currently requires administrator support and must be disclosed before production.

Known limitations include no enterprise audit log, automatic conflict merging, cloud logo upload, or self-service account deletion. Email and signatures remain outside Phase 1. Hosted RLS and concurrency require project-level verification.
