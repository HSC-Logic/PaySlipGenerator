# Sliply Phase 1 architecture

Sliply remains local-first. The root HashRouter route renders the existing editor and its browser persistence, calculations, preview, PDF, and print paths. Supabase is optional; without both public environment values, authentication explains that cloud features are unavailable while guest creation continues normally.

Authenticated routes are separated from document state. `AuthProvider` owns Supabase session restoration and the verified profile plan. UI pages call repository contracts; Supabase repositories map between PostgreSQL rows and the existing `PaymentSlip` model. PDF and preview continue consuming that same model.

Trust boundaries:

- Browser-local data is untrusted input and is validated on load.
- The Supabase anonymous key is public configuration, not an administrator credential.
- Supabase Auth establishes identity; PostgreSQL RLS enforces ownership.
- The profile `plan` is server-managed; browser code only interprets it.
- Drive authorization remains a separate in-memory Google token and stays experimental/hidden.

HashRouter keeps refreshes under `/PaySlipGenerator/` compatible with GitHub Pages. Cloud writes retain company and recipient snapshots on each payment. Child items and adjustments are replaced atomically through `save_payment_slip`.

## Repository boundaries

- `services/repositories/contracts.ts`: UI-facing persistence contracts.
- `services/repositories/supabaseRepository.ts`: authenticated cloud implementation.
- `utils/storage.ts`: existing guest/local storage and recovery.
- `services/supabase/client.ts`: optional public configuration boundary.

Phase 1 deliberately avoids automatic conflict resolution. Failed cloud writes preserve the editor and its local recovery snapshot; users retry explicitly.
