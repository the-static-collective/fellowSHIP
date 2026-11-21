# Database strategy — Commons 001 and an expanding garden

**Decision status:** Recommended direction, **not yet approved or deployed**.  
**Reviewed:** 2026-11-21. Recheck plans and prices immediately before provisioning.

## Evidence from the connected Supabase account

Organization: `the-static-collective`.

- `pantry-gate`: **ACTIVE_HEALTHY**; read-only inspection found **111 public tables** and approximately **88 MB** total database size. This project already carries active HUMKIN, JAR;VIS, community intake, Reality 2.0, Night Shift, and other systems. It must not be treated as a disposable staging database.
- `WITNESS`: **INACTIVE/paused**. Contents were **not accessible**; do not assume empty or abandoned.
- `the-autodiso`: **INACTIVE/paused**. Contents were **not accessible**; do not assume empty or abandoned.

Supabase's Free plan allows **two active projects**; paused projects do **not** count, but resuming a paused project will require room in the active limit. [Official FAQ](https://supabase.com/docs/guides/platform/billing-faq). Free projects may be paused for inactivity and a paused project has a limited restoration window. [Official pausing documentation](https://supabase.com/docs/guides/platform/free-project-pausing).

## Options, verified November 2026

| Provider | Free allocation | Strengths | Tradeoffs |
| --- | --- | --- | --- |
| **Existing pantry-gate (Supabase)** | No new project cost if within current limits | Current Auth, PostgREST, RLS, existing integration | Shared failure domain, shared user pool, no independent restore, additional load in a busy multi-product DB |
| **Another free Supabase project** | One apparent available active slot with the current one-active/two-paused state | Commons 001 code can be used unchanged after normal setup | Filling the second active slot can obstruct restoration of WITNESS/the-autodiso until a slot is freed |
| **Neon Free (recommended for new independent applications)** | **100 projects**, **1 GB Postgres per project**, **20 GB account-wide**, **100 CU-hours per project/month**, **5 GB transfer per project**, **10 branches per project** | Native Postgres, per-project isolation, managed Better Auth, JWT/RLS-compatible Data API; compute scales to zero | Commons 001's Supabase Auth/JWT functions and SDK must be **ported**, not simply pointed at a Neon URL; free monthly compute/transfer caps suspend workloads at limit |
| **Cloudflare D1 + Workers Free** | **10 databases**, **5 GB total**, **5M rows read/day**, **100K rows written/day** | Excellent for edge workloads/counters; aligns with R2 and Cloudflare workers; no database compute-hours bill | SQLite, not Postgres: Commons SQL and RLS architecture are not drop-in; build and protect app-specific server-side auth/API |
| **Self-hosted PocketBase** | Open-source app; host charges depend on server | Embedded SQLite, built-in accounts, realtime APIs, simple admin UX | Need dependable always-on host, updates/backups and operational security, not a managed free backend |

Primary references:
- Neon updated free plan (2026-10-02): https://neon.com/blog/neon-free-plan-1-gb-per-project
- Neon quotas: https://neon.com/docs/introduction/free-tier
- Neon Data API role and RLS rules: https://neon.com/docs/data-api/access-control
- Cloudflare D1: https://developers.cloudflare.com/d1/platform/pricing/
- PocketBase: https://pocketbase.io/faq/
- Supabase: https://supabase.com/docs/guides/platform/billing-faq

## Recommendation

1. **Preserve** pantry-gate and both paused projects. In particular, do **not** run `db/schema.sql` directly against pantry-gate: this script was explicitly designed for a dedicated empty Supabase instance and uses new unprefixed public names and a `private` schema. A compatible, namespaced additive migration requires separate review and backup.
2. Prefer a **dedicated Neon free project for fellowSHIP Commons 001** once Neon is connected and project provisioning is authorized. Validate the backend's managed authentication, user IDs, PostgREST-style Data API and RLS semantics before adapting the existing browser app and `db/schema.sql`.
3. Keep existing Supabase live systems where they are. Future new garden services may each use isolated Neon projects, while **Cloudflare D1** is well suited to edge counters/public projections and **R2** remains the choice for larger media blobs. Do not duplicate user data unnecessarily between providers.
4. Before church members are invited, run a true multi-account test and cross-room denial tests, set up export/backups and recoverability, review service limits, configure rate limits and member invitation controls. **Do not store pastoral or children's confidential records in this pilot.**
5. If the user prioritizes an immediate Supabase deployment instead of provider separation, provision a dedicated project only after confirming that keeping WITNESS/the-autodiso paused is acceptable; **do not interpret inactive as unused**.

## Porting Commons 001 to Neon

The core *data model* (communities, rooms, memberships, tasks, activity) is portable to Postgres, but these parts are **not**:
- `auth.users` foreign keys and UUID assumptions
- `auth.uid()` used in policies, trigger logging and owner checks
- Supabase-specific `createClient`, magic-link sign-in and session handling
- Auth role/API grants and schema exposure assumptions
- Secret placement and web redirect allowlists

Neon's Data API uses native Postgres privileges and RLS with its own authenticated JWT identity semantics (for example `auth.user_id()`), and its managed Auth integration differs from Supabase Auth. Build a **provider-specific adapter and SQL schema** rather than copying a Supabase SQL script into Neon.

**No existing project was changed by this assessment.**
