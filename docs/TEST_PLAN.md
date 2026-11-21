# Commons 001 — Two-account acceptance and security test plan

**Environment:** the isolated Neon project `fellowSHIP Commons` with `db/neon-schema.sql` installed. Never test authorization bypasses against real church or pastoral records.

**Accounts:** A = church A founder, B = collaborator, C = unrelated user. All sign in independently with Neon Auth email/password.

## Functional acceptance

1. A signs in, creates **Church A**, then creates a **Friday Supper** room.
2. A creates a task "Confirm kitchen", changes it to **In progress**, and checks activity records actor/time.
3. A selects **Create private invitation**, chooses **editor**, and optionally restricts the link to B's email. The raw link is shown once in the UI; the database stores only a SHA-256 digest.
4. B opens the link from a separate device/browser. If signed out, B signs up or logs in, then explicitly selects **Accept invitation**.
5. B can read/edit tasks in Friday Supper and see the history, but not **Leadership Notes**, a room A creates separately without inviting B.
6. A creates a second **viewer** link. C opens it and can read but cannot create/update tasks.
7. B marks **Caught up**; when B opens the room from another browser under the same account, the saved check-in timestamp is reflected. New task events appear on the next refresh.
8. A revokes an unused link and verifies redemption fails. A uses the member control to revoke B's access; subsequent B reads and writes to Friday Supper fail. Future events cannot be read after removal.
9. C creates **Church C** and a separate room. A and B cannot read its records without an invitation.
10. After a review, A may create another restricted editor link for one other church collaborator; verify that sharing a room never grants access to either church's unrelated rooms.

## Invitation and check-in denial tests

- **No JWT:** the `anonymous` role must have zero table grants; test all four public invitation RPCs deny unauthenticated calls.
- **Token replay:** redeem a single-use invitation twice, including concurrently. The second attempt must fail.
- **Token confidentiality:** confirm `room_invites` stores only a 32-byte hash, never the raw token; browser URL fragment is cleared from the address bar after loading. Do not put invite links in public docs, logs or screenshots.
- **Recipient binding:** an invitation restricted to B's email must fail when C attempts redemption.
- **Expiry and revocation:** expired and owner-revoked tokens cannot be redeemed. Revoke after redemption should not revoke membership; room-owner membership removal is a separate operation.
- **Role scope:** viewer invitation grants no task writes. Editor invitation grants only tasks and not room-owner privileges.
- **Room privacy:** external invitees can only read the one room they accepted; no sibling-room or private community records.
- **Check-in privacy:** a person can read/write only their own room checkpoint, and only while they can read that room. Role changes or revocation must block checkpoint access.
- **Cross-device check-in:** run with genuine accounts. No owner-role SQL test can replace it.

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
