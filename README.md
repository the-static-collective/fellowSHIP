# fellowSHIP

**An open digital commons for churches and neighbors to make things together.**

This repository holds the [living vision](VISION.md) and the first independently deployable code slice: **Commons 001**. The first slice is a small shared workspace, **not** a deployed radio network or a finished multi-tenant platform.

## What Commons 001 does

- Email magic-link sign-in. Each contributor has their **own** account.
- Found a community (e.g. a congregation or cooperative group).
- Create project rooms associated with that community.
- Add collaborators **from any church/account** to a room as viewer or editor.
- Create tasks, change their status, and read the durable activity history.
- Access the same tasks from distinct accounts and devices. The **database** is the shared source of truth, not a ChatGPT conversation.
- Authenticate and authorize writes with Postgres row-level security, not frontend UI logic.

There is deliberately **no service-role secret in the app**, no public searchable member directory, and no need for participants to install or subscribe to an AI product.

## Run a two-person pilot

> IMPORTANT: Use a **new, dedicated Supabase project**. Do not execute the bootstrap SQL against an existing pantry, church operations, or production database. Nothing in this repository provisions a Supabase project or modifies existing data.

1. Create a dedicated [Supabase](https://supabase.com/) project. Review the displayed plan/cost before creation.
2. In the project's SQL editor, run [db/schema.sql](db/schema.sql) **once**. It creates the new tables, permissions, RLS policies, task-logging triggers, and private read-only authorization helpers. It is not an idempotent migration runner.
3. In Supabase **Authentication → URL Configuration**, add your local test address (for example `http://localhost:8000`) to **Redirect URLs**. For a published site, add its exact HTTPS URL too. Configure email OTP/magic-link delivery (production use requires email deliverability planning).
4. Serve the repository over HTTP, for example:

   ```sh
   python3 -m http.server 8000
   ```

   Open `http://localhost:8000`. A file:// URL is not supported for reliable auth callbacks.
5. Paste the project's **Project URL** and **publishable** (`sb_publishable_...`) key into the Connect screen. A legacy **anon** key is also accepted. **Never enter a service_role or secret key.** The public connection settings are stored in browser localStorage.
6. Sign in with a valid email, then create a community and room.
7. A second person signs in separately, copies their full **Member ID**, and sends it privately to the room owner. The owner opens that room and grants editor or viewer access to the exact ID.
8. The second person hits **Refresh shared work**. They can read the room and, if an editor, create/update tasks. Both can see the activity history.

For full checks, including isolation and deliberate denial tests, see [docs/TEST_PLAN.md](docs/TEST_PLAN.md).

## Run on GitHub Pages (after review)

This is a **zero-build** HTML/CSS/JavaScript application. Once the branch is reviewed and merged, an administrator can enable **Settings → Pages → Deploy from branch → main / (root)**. Then add the published HTTPS URL to Supabase Auth Redirect URLs. Until this is configured and the Supabase schema is installed, there is no working hosted service.

The browser loads a **pinned** Supabase SDK (`2.119.2`) from jsDelivr. For production, bundle/self-host a verified dependency rather than relying solely on a third-party CDN. Offline use is not implemented.

## Architectural boundary

```
Browser / human                          Future: ChatGPT or other AI
      |                                               |
      +-------------------+---------------------------+
                          |
                 Authorized service API
                 (Supabase Auth / PostgREST)
                          |
                  Postgres + enforced RLS
     communities → rooms → memberships / tasks / activity
                          |
      Future: MCP tools | federated rooms | radio permissions
                          |
    Future: Suno / human audio → review → R2 → playout engine
```

- `db/schema.sql`: current durable source of truth and row-level permissions.
- `index.html`, `styles.css`, `app.js`: browser-only pilot.
- `docs/ARCHITECTURE.md`: ownership, access model, and extension boundaries.
- `docs/TEST_PLAN.md`: repeatable multi-account acceptance and security tests.
- `VISION.md`: broader inter-church and federated radio horizon, not deployed features.

## Current deliberate limits

- **Invites are by full Auth user UUID**, not email/invite links. The invitee must have signed in at least once. Use a private communication channel to share the ID. A time-bound invitation service is an immediate next step.
- **Only a community's founder can create its rooms.** Additional organization-level administrators, transfer of ownership, room archiving, and role management are future features.
- **No real-time push.** Refresh explicitly to pull the latest state; no automatic polling or websocket subscriptions.
- **No editing project metadata, task deletion, or event deletion.** An append-only task activity log records author IDs, titles, and status changes; history itself is never writable from the browser.
- **No radio, Suno, R2, public streams, shared-federation moderation, or live MCP endpoint yet.** Those are later increments gated by editorial approval, rights metadata, and authentication.
- Church membership alone does **not** grant access to every room. Rooms are private to their creator and specifically added members.
- No personally sensitive pastoral or child information should be stored in this early pilot. Security claims still require live policy tests and threat review.

## Development / verification

```sh
node --check app.js
python3 -m http.server 8000
```

SQL has not been applied to a live project by this repository commit. Follow the multi-account acceptance plan before real-world church use.

## Guiding principle

**Every person can contribute. Every community keeps its identity. Every shared undertaking has a place to live.**

See [VISION.md](VISION.md).
