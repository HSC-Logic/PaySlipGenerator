# Phase 1 manual QA

Use current Chrome, Firefox, and Safari where available. Repeat responsive checks at 320, 375, 768, and desktop widths; verify keyboard order, visible focus, labels, status messages, dark mode, and no page-level horizontal overflow.

| Area | Cases |
|---|---|
| Guest | Create blank slip; saved company; draft save/load; recovery; preview; PDF; print; local history; offline |
| Documents | A4/A5/B5/Letter × portrait/landscape; logo/no logo; long content; multi-page; Free attribution |
| Auth | Register; confirm email; login; restored session; logout; invalid credentials; reset; expired session; intended-route redirect |
| Import | Valid profile/draft; accept; skip; malformed records; partial failure; local copies retained |
| Companies | Create/edit/archive/default; multiple companies; Free branding enforced; administrator-assigned Pro preference |
| Recipients | Create/edit/archive/search; duplicate prompt; one-time recipient; masked NIC; related history |
| Payments | Create/save/view/edit; explicit statuses; paid-edit warning; create similar; archive; PDF/print; loading/error/empty states |
| History | Search; date/status/currency/company/recipient filters; newest/oldest/amount; clear filters |
| Offline | Disconnect before save; honest error; local recovery preserved; explicit retry; no duplicate |
| Cross-device | Sign in on a second device and verify companies, recipients, and payments |

## Hosted database verification

Use test users A and B. For every table, create A-owned and B-owned rows and verify each user can select/update/archive only their own. Attempt to attach an A item to a B slip, and an A slip to a B company or recipient; each must fail. Attempt to update `profiles.plan` as the authenticated client; it must fail. Administrator SQL may change it.

Issue at least 20 simultaneous `reserve_payment_reference` calls for the same company/year. Assert 20 distinct references and no reuse after archive. Repeat across companies and users.

Run before release:

```sh
npm ci
npm test
npm run build
```
