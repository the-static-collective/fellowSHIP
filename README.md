# fellowSHIP

**An open digital commons for churches and neighbors to make things together.**

This repository holds the [living vision](VISION.md) and the first independently deployable code slice: **Commons 001**. The first two slices form a small shared workspace, **not** a deployed radio network or a finished multi-tenant platform.

## What Commons 001–002 does

- Neon managed email/password sign-in with required email-code verification. Each contributor has their **own** account.
- Found a community (e.g. a congregation or cooperative group).
- Create project rooms associated with that community.
- Invite collaborators **from any church/account** by private, 48-hour, single-use room link, optionally bound to their email.
- Create tasks, change their status, and read the durable activity history. Each person can mark a room caught up across devices.
- Access the same tasks from distinct accounts and devices. The **database** is the shared source of truth, not a ChatGPT conversation.
- Authenticate with Neon Auth and authorize writes with Postgres row-level security, not frontend UI logic.

There is deliberately **no service-role secret in the app**, no public searchable member directory, and no need for participants to install or subscribe to an AI product.

## Neon backend (provisioned 2026-11-21)

The project now has an isolated **Neon Free** backend under the **the static** Neon organization:

- Project: `fellowSHIP Commons` (`long-mode-35200070`), `aws-us-east-1`
- Main branch: `br-dawn-cherry-bbnlokf9`
- Database: `fellowship`
- Managed Better Auth and the Neon Data API are provisioned.
- Base tables and RLS are in [db/neon-schema.sql](db/neon-schema.sql); secure invitations in [db/002_room_invites.sql](db/002_room_invites.sql); durable check-ins in [db/003_room_checkins.sql](db/003_room_checkins.sql); verified-email redemption in [db/004_verified_invites.sql](db/004_verified_invites.sql); guarded room creation in [db/005_create_room_rpc.sql](db/005_create_room_rpc.sql). All have been applied to the dedicated Neon project. Do not rerun them.
- No Supabase project was altered; [db/schema.sql](db/schema.sql) is retained only as a **Supabase reference**, and **must not** be applied to the Neon project.

The browser client uses **public HTTPS API endpoints** hardcoded in `app.js`; it does not contain a privileged database role password or API secret. Its dependency is pinned to a published Neon SDK release imported through a third-party ESM CDN. For more reliable production distribution, bundle and self-host the dependency after browser verification.

## Test the two-person pilot

1. Open `https://fellowship.abundent.org` after its HTTPS certificate is active. For local development, run `python3 -m http.server 8000` and browse `http://localhost:8000`. **Do not run directly from file://.**
2. Create an account with your name, email and password; check your mailbox for a one-time code and enter it in **Verify your email address**. You can sign in using the same credentials later.
3. Create a community such as "Real Life Church", then create a room such as "Friday Supper". Room creation uses an owner-checked RPC and displays progress or server errors directly under the button.
4. Create a task and update its status.
5. The room owner selects **Create private invitation**, selects viewer or editor, and preferably enters the recipient’s email. **Copy invitation link** and send it privately (never publish it in a general chat).
6. The second person opens the link, creates or signs into their own account, and clicks **Accept invitation**. The invited room becomes available; use **Refresh shared work** to fetch new changes.
7. Verify that the second person can see the authorized room and its history but cannot access an unrelated room.
8. The room owner can revoke unused links or change/revoke membership from the room controls. Each person can review **Since your last check-in** and click **Mark caught up**; the checkpoint is stored per account, not just in the browser.

**Deployment state:** The isolated database is provisioned and its structural privileges have been checked. End-to-end browser, email, and adversarial multi-account access testing is **not yet complete**. Keep out confidential pastoral, financial, and children's information. Full testing instructions: [docs/TEST_PLAN.md](docs/TEST_PLAN.md).

## Hosting: GitHub Pages + Abundent (2026-11-21)

**GitHub Pages is now configured and the Pages deployment completed successfully.** The publishing source is the standalone `gh-pages` branch, with exactly `index.html`, `styles.css`, `app.js`, `CNAME`, and `.nojekyll`. It is a snapshot of the code in the draft feature branch, not a release of the whole repository.

- Preferred site: **https://fellowship.abundent.org** (GitHub Pages reports this custom domain; HTTPS certificate issuance/client reachability not yet independently verified).
- Cloudflare's authoritative DNS has a DNS-only CNAME: `fellowship.abundent.org` → `the-static-collective.github.io`.
- GitHub Pages deployment: [successful Actions run](https://github.com/the-static-collective/fellowSHIP/actions/runs/44922316209).
- Neon Auth now trusts `https://fellowship.abundent.org`; the existing backend and database were not migrated.
- The old Vercel pilot remains temporarily available as a fallback. **Do not send its old share link as the primary URL.** Retire it after HTTPS, sign-in, invite redemption and cross-account permissions work on the new site.
- The draft PR remains unmerged; no confidential church data should be entered during the pilot.

See [docs/HOSTING.md](docs/HOSTING.md) for deployment/update/rollback instructions. Because `gh-pages` is currently a static publishing branch, future changes in the draft PR do **not** automatically update the live site: republish the reviewed three frontend files deliberately.

## Architectural boundary

```
Browser / human                          Future: ChatGPT or other AI
      |                                               |
      +-------------------+---------------------------+
                          |
                 Authorized service API
                 (Neon Auth / Data API)
                          |
                  Postgres + enforced RLS
     communities → rooms → memberships / tasks / activity
                          |
      Future: MCP tools | federated rooms | radio permissions
                          |
    Future: Suno / human audio → review → R2 → playout engine
```

- `db/neon-schema.sql`: current Neon data model and row-level permissions. `db/schema.sql` is the superseded Supabase-specific reference.
- `index.html`, `styles.css`, `app.js`: browser-only pilot.
- `docs/ARCHITECTURE.md`: ownership, access model, and extension boundaries.
- `docs/TEST_PLAN.md`: repeatable multi-account acceptance and security tests.
- `VISION.md`: broader inter-church and federated radio horizon, not deployed features.

## Current deliberate limits

- **Invitations use hashed 256-bit tokens** and expire after 48 hours; optionally restrict the redemption to a specific signed-in email. There is no automatic email delivery—send the link privately. Revocation only applies before it is redeemed.
- **Only a community's founder can create its rooms.** Additional organization-level administrators, transfer of ownership, room archiving, and community-wide role management are future features.
- **No real-time push.** Refresh explicitly to pull the latest state; no automatic polling or websocket subscriptions. The cross-device catch-up view currently summarizes the latest 40 recorded task events, not every possible event in a busy room.
- **No editing project metadata, task deletion, or event deletion.** An append-only task activity log records author IDs, titles, and status changes; history itself is never writable from the browser.
- **No radio, Suno, R2, public streams, shared-federation moderation, or live MCP endpoint yet.** Those are later increments gated by editorial approval, rights metadata, and authentication.
- Church membership alone does **not** grant access to every room. Rooms are private to their creator and specifically added members.
- No personally sensitive pastoral or child information should be stored in this early pilot. Security claims still require live policy tests and threat review.

## Development / verification

```sh
node --check app.js
python3 -m http.server 8000
```

The isolated Neon schema and Commons 002 additions have been applied and structurally inspected. Real browser login and multi-account denial tests remain required before real-world church use.

## Guiding principle

**Every person can contribute. Every community keeps its identity. Every shared undertaking has a place to live.**

See [VISION.md](VISION.md).
