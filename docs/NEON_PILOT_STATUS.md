# Neon Commons 001 — Provisioning and validation receipt

**2026-11-21 | State:** Provisioned backend, browser pilot pending full end-to-end test.

## Live backend (safe metadata)

- Neon organization: `the static` (Free plan).
- Neon project: `fellowSHIP Commons` — `long-mode-35200070`.
- Main branch: `br-dawn-cherry-bbnlokf9`.
- Postgres 17, region `aws-us-east-1`, database `fellowship`.
- Managed Better Auth: enabled, email/password sign-in. Domain allowlist includes `https://the-static-collective.github.io`.
- Data API: enabled, `public` is the exposed schema.
- No privileged Neon passwords or server keys committed to source. These hostnames are public API destinations, not credentials.
- Existing Supabase projects (`pantry-gate`, `WITNESS`, `the-autodiso`) were **not modified**.

## Installed schema

Applied `db/neon-schema.sql` to the new database, containing five RLS-protected application tables:
`communities`, `rooms`, `room_members`, `tasks`, and `activity`.

**Provider-specific fix:** Neon's restricted `authenticated` database role cannot directly access its managed `auth` schema. A narrow `private.current_uid()` SECURITY DEFINER helper returns only the authenticated JWT subject through Neon's `auth.uid()`. The helper has no arbitrary user-ID input and the `private` schema is not exposed to the Data API. Policies use this helper instead of directly invoking `auth.uid()`. The deployed database was patched to match the tracked Neon schema.

## Verification performed

- SQL inventory: **5/5** application tables have RLS enabled.
- SQL grant inventory: the `anonymous` role has **no SELECT** on those tables; `authenticated` has limited table privileges behind RLS.
- SQL under `SET LOCAL ROLE authenticated` **without a JWT** returned a NULL identity and **zero** visible communities; the private identity helper completed without an auth schema permission error.
- GitHub Actions syntax and structure checks passed after the Neon port (see the PR checks).
- The Data API reports active and the Neon Auth integration reports enabled.

**This is not a complete security test.** No independently authenticated two-person browser session has yet tested actual permissions, task writes, invitation flow, or revoked access. An account with no JWT is not a substitute for a forged or cross-tenant request test. Browser SDK import, email delivery, CORS, and Pages hosting are not yet confirmed.

## Launch gates

1. Review PR #1 and publish the branch using a test host / GitHub Pages after merge.
2. Verify the pinned CDN-imported browser SDK loads and the public endpoints are reachable over HTTPS.
3. Run the full [TEST_PLAN.md](TEST_PLAN.md) using two genuine independent test accounts plus an unrelated third account.
4. Verify per-room authorization and denial attempts directly against the Data API, not only through hidden UI controls.
5. Set up signup policy, anti-abuse controls, email verification/delivery, backups/recovery, and production CSP. No confidential pastoral/children's data during the pilot.
6. Only after those checks invite outside church collaborators. The future MCP and broadcast federation remain separate.

**Safety:** The original Supabase bootstrap `db/schema.sql` is kept only for historical reference. Never execute it in the Neon project or on active pantry-gate. Do not re-run `db/neon-schema.sql` on an already initialized database because it is a one-time bootstrap.
