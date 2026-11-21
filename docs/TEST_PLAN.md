# Commons 001 — Two-account acceptance and security test plan

**Environment:** the isolated Neon project `fellowSHIP Commons` with `db/neon-schema.sql` installed. Never test authorization bypasses against real church or pastoral records.

**Accounts:** A = church A founder, B = collaborator, C = unrelated user. All sign in independently with Neon Auth email/password.

## Functional acceptance

1. A signs in, creates **Church A**, then creates the **Friday Supper** room.
2. A creates the task "Confirm kitchen" and sets it to **In progress**. Activity should show `task_created` followed by `task_updated`, actor A, and timestamps.
3. B signs in with another account, copies their full Member ID, and shares it privately with A.
4. A adds B as **viewer** to Friday Supper. On refresh, B sees the room, tasks, people, and activity but has no task-entry form and cannot change task status.
5. A changes B's role to **editor** using the room's people controls. B refreshes and can create/update tasks.
6. A and B open the room from separate browsers; B changes a task and A refreshes to see the change and event.
7. A creates a second room **Leadership Notes** and does **not** invite B. B must not see it.
8. C signs in independently. C must see neither Church A nor either room before being invited.
9. Optionally C creates **Church C** and its own room. A must not see that room unless invited.
10. A explicitly adds C to Friday Supper. C can now see the shared room without gaining access to Leadership Notes.

## Security/negative tests (using the authenticated client, not a service-role key)

- **Cross-room SELECT:** as B or C before invitation, query `rooms`, `tasks`, `activity`, and `room_members` for a known inaccessible room ID. Expect no returned records.
- **Cross-room INSERT:** as C, try to insert a task into A's room without a grant. Expect an RLS denial.
- **Viewer write:** as B with viewer role, attempt a direct `tasks.update` or insert (not merely the disabled UI). Expect denial or zero affected records.
- **Permission escalation:** as B (editor), try to insert/update/delete `room_members`. Expect denial.
- **Metadata reparent:** as A, try to set a task's `room_id` to another room or change `created_by`. Expect trigger rejection.
- **Log tampering:** as A, try to directly insert/update/delete `activity`. Expect privilege denial.
- **Unauthorized room creation:** as B, attempt to create a room in A's community. Expect denial.
- **Wrong member ID:** the invite should fail if an Auth user with that ID does not exist. No fake account should be silently created.
- **Revocation:** as A, remove B's `room_members` grant. After refresh, B can no longer read tasks or events. The revoked user must not be able to write either.
- **Secrets:** inspect browser source, localStorage, and network calls. No privileged Postgres password, Neon secret key, R2/Suno credential, or server token may appear.
- **Email redirect:** test an authenticated click-through at both localhost and the intended HTTPS site URL.

## SQL review

Confirm through the Neon SQL API or Neon console:
- Every Commons table has `relrowsecurity=true`.
- `anon` has no table grants; `authenticated` has only the grants enumerated at the end of `db/schema.sql`.
- `private` is not in the project's exposed API schemas.
- The `activity` trigger produces a row only when a task is created or material task fields change.
- Neon Data API security advisor and role grants show no unresolved RLS or privilege issue.

## Not tested by a repository-only commit

The Neon project is provisioned, but this plan still requires actual independent authenticated sessions. Static source review and owner-role SQL cannot prove live session-bound RLS, email delivery, CDN availability, browser/device compatibility, or a federated broadcast. Do not label any of these verified until the relevant test has run.
