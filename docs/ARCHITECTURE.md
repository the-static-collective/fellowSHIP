# Commons 001 — Architecture and security boundary

## What is implemented

Commons 001 has exactly one authority for collaborative state: a dedicated Supabase Postgres database. The browser uses the public Supabase client, with email magic-link authentication and **RLS** deciding who can read or write every exposed record.

### Data model

- `communities`: independent named organizations, each founded by an authenticated person.
- `rooms`: projects anchored to one community but able to include external people.
- `room_members`: explicit room-level grants (`viewer` or `editor`) to Auth user UUIDs.
- `tasks`: action items within a room; owner/editors can create and update.
- `activity`: database-created records for task changes; humans cannot rewrite these using the public API.

In the initial vertical slice, "room" and "project" are intentionally one resource. A future project-to-many-communities association may evolve without weakening room-level access.

### Access matrix

| Action | Room owner | Room editor | Room viewer | Other signed-in user |
|---|---|---|---|---|
| Read room and tasks | Yes | Yes | Yes | No |
| Read members and activity | Yes | Yes | Yes | No |
| Create/change task | Yes | Yes | No | No |
| Grant/revoke membership | Yes | No | No | No |
| Create room in community | Community founder only | No | No | No |

Community names are visible only to its founder and people who can read at least one associated room. A user added to one room does not gain access to sibling rooms. The founder can invite someone from an entirely separate church by ID, without changing that person's other memberships.

The DB uses narrow `private` SECURITY DEFINER **read helpers** so room and membership policies do not recursively query one another. These functions are in an unexposed schema; explicitly revoke PUBLIC execute and grant only required `authenticated` execution. The task activity trigger is a separate narrow SECURITY DEFINER **writer**, with no direct client EXECUTE grant. It writes records from authenticated data changes; it does not authorize privileged user actions.

### Invariants

1. All exposed `public` tables have RLS enabled; `anon` is not granted table operations.
2. A task's room, author, and creation timestamp cannot be changed after creation.
3. No user can update or delete `activity` from the browser API.
4. A task event's actor is inferred from `auth.uid()`, never a client-supplied actor field.
5. Only a room's creator may change its collaborators.
6. A request to read an unrelated church's room must return no rows under that user's credentials.
7. No authorization decision trusts frontend state or user-editable JWT metadata.
8. Neither Supabase secret keys nor Suno/R2 tokens belong in frontend source.
9. All cross-organization work requires an explicit person-level room grant.
10. A claim of rights, editorial clearance or approval is **not** inferred from a generated media file.

### Threats and what remains open

This is **a pilot**, not a certified production platform. The pilot explicitly lacks email invitations, owner recovery, moderation queues, per-community delegation, spam/abuse rate limiting, data export and deletion flows, a church-facing privacy policy, and secure pastoral-information workflows. User UUIDs are exposed to members of the same room to support the temporary invite interface, so they are not anonymous identifiers.

A future MCP server must validate every user's independently issued bearer token and use **that user's RLS context**, not a privileged service-role bypass. Never let an agent read a full conversation history merely because the user belongs to a church. Treat AI-written content as untrusted input and use human approval for consequential publishing and permissions.

## Future module: fellowSHIP Radio

The proposal recorded in [../VISION.md](../VISION.md) is a **separate integration boundary**, not a reason to rewrite the commons.

```text
Authorized contributor
  → audio creation (Suno, local recording, or other tool)
  → review + rights/consent + attribution record
  → media object (Cloudflare R2)
  → station library + scheduling/playout
  → church station stream
  → explicit syndication license
  → federation catalogue / shared station
```

R2 is object storage, not a live transmission engine. Each participating church retains control over its own station; the wider station cannot unilaterally rebroadcast its material. An AI may suggest connections among stations but should distinguish factual metadata, thematic similarity, and contested theological interpretation. Humans hold final publishing and moderation authority.

### Proposed follow-on increments

1. **Invite tokens:** Expiring, revocable, narrowly scoped invitations instead of copying Auth UUIDs.
2. **Membership and governance:** Church-level roles, multiple room owners, membership requests, and clear room exit/revocation flows.
3. **MCP service:** Authenticated `list_rooms`, `catch_me_up`, `list_tasks`, `propose_task`, and explicit `record_decision` commands with audit receipts.
4. **Signed/attributable events:** Stronger provenance and approval trails beyond the current task event log.
5. **Radio proof:** Two independent opt-in station libraries, one shared approved recording, metadata and editorial rights checks, and a syndication event.
6. **Federation:** Graph of relationships, recommendations with consent, and a curated station-of-stations without centralized doctrinal authority.

No radio-specific schema is added in Commons 001 because its rights and permission model must be settled deliberately.
