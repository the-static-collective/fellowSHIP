# Neon Commons 001 — Provisioning and validation receipt

**2026-11-21 | State:** GitHub Pages deployed to custom Abundent domain; HTTPS/client login verification pending; isolated Neon backend provisioned; real multi-account security test pending.

## Live backend (safe metadata)

- Neon organization: `the static` (Free plan).
- Neon project: `fellowSHIP Commons` — `long-mode-35200070`.
- Main branch: `br-dawn-cherry-bbnlokf9`.
- Postgres 17, region `aws-us-east-1`, database `fellowship`.
- Managed Better Auth: enabled, email/password sign-in. Trusted domains include `https://the-static-collective.github.io` and `https://fellowship.abundent.org`.
- Data API: enabled, `public` is the exposed schema.
- No privileged Neon passwords or server keys committed to source. These hostnames are public API destinations, not credentials.
- Existing Supabase projects (`pantry-gate`, `WITNESS`, `the-autodiso`) were **not modified**.

## Installed schema

`db/neon-schema.sql` plus additive migrations `002_room_invites.sql`, `003_room_checkins.sql`, and `004_verified_invites.sql` have been applied. Seven RLS-protected application tables now exist:
`communities`, `rooms`, `room_members`, `tasks`, `activity`, `room_invites`, and `room_checkins`. The invitation table has no direct authenticated/anonymous table grants; four invitation RPCs require authenticated calls and per-room authorization. Email-restricted invites require a verified Neon Auth email.

**Provider-specific fix:** Neon's restricted `authenticated` database role cannot directly access its managed `auth` schema. A narrow `private.current_uid()` SECURITY DEFINER helper returns only the authenticated JWT subject through Neon's `auth.uid()`. The helper has no arbitrary user-ID input and the `private` schema is not exposed to the Data API. Policies use this helper instead of directly invoking `auth.uid()`. The deployed database was patched to match the tracked Neon schema.

## Verification performed

- SQL inventory: **7/7** application tables have RLS enabled.
- SQL grant inventory: the `anonymous` role has **no SELECT** on those tables; `authenticated` has limited table privileges behind RLS.
- SQL under `SET LOCAL ROLE authenticated` **without a JWT** returned a NULL identity and **zero** visible communities; the private identity helper completed without an auth schema permission error.
- GitHub Actions syntax and structure checks passed after the Neon port (see the PR checks).
- The Data API reports active and Neon Auth requires email OTP verification on signup.
- GitHub Pages deployment **succeeded** on the dedicated `gh-pages` branch; the Cloudflare DNS-only CNAME for `fellowship.abundent.org` points to `the-static-collective.github.io`.
- The GitHub Pages deployment log reports `http://fellowship.abundent.org/`; valid external HTTPS and browser behavior remain unverified.
- The original protected Vercel pilot remains temporarily as a fallback and will be retired after TLS and two-account checks; no Vercel share token is stored in GitHub.

**This is not a complete security test.** No independently authenticated two-person browser session has yet tested actual permissions, task writes, invitation flow, or revoked access. An account with no JWT is not a substitute for a forged or cross-tenant request test. Browser SDK import, email delivery, CORS and the GitHub Pages site's external HTTPS behavior are not yet confirmed.

## Launch gates

1. Visit `https://fellowship.abundent.org` from a real device and confirm the certificate, network delivery and authentication flows; GitHub Pages deployment is already done.
2. Verify the pinned CDN-imported browser SDK actually executes, email OTP arrives and validates, and the public API endpoints work with an authenticated session. HTTP 200 on static assets alone is insufficient.
3. Run the full [TEST_PLAN.md](TEST_PLAN.md) using two genuine independent test accounts plus an unrelated third account.
4. Verify per-room authorization and denial attempts directly against the Data API, not only through hidden UI controls.
5. Set up signup policy, anti-abuse controls, email verification/delivery, backups/recovery, and production CSP. No confidential pastoral/children's data during the pilot.
6. Only after those checks invite outside church collaborators. The future MCP and broadcast federation remain separate.

**Hosting documentation:** [HOSTING.md](HOSTING.md) records source, DNS, update, rollback and Vercel retirement steps.

**Safety:** The original Supabase bootstrap `db/schema.sql` is kept only for historical reference. Never execute it in the Neon project or on active pantry-gate. Do not re-run `db/neon-schema.sql` on an already initialized database because it is a one-time bootstrap.
