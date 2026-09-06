# Supabase setup

1. Create a Supabase project.
2. Run `supabase/migrations` using `supabase db push`, or execute files in order through the SQL editor.
3. Put the project URL and publishable/anonymous key in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Never use a service-role key in a Vite variable or browser bundle.
5. Configure Auth redirects for local development and `https://YOUR_ACCOUNT.github.io/PaySlipGenerator/`, including the `#/login` password-recovery destination.
6. Configure email confirmation and password-reset templates.
7. Add the two public values as GitHub Actions repository variables.

## Development Pro entitlement

Create a test account normally, then use an administrator session in the Supabase SQL editor:

```sql
update public.profiles set plan = 'pro' where id = 'TEST-USER-UUID';
```

There is intentionally no public UI or localStorage plan control. If the profile cannot be verified, the frontend behaves as Free.

Run the RLS and concurrency cases in `phase-1-qa.md` against a non-production project before release. Vitest cannot prove hosted policy behavior.
