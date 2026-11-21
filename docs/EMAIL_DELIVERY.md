# Invitation email delivery

## Current working option: prepared Gmail/email-app drafts (no copying)

The browser can now produce a complete, URL-safe email message containing an actual single-use invitation:
1. Room owner enters the invitee's email and role, then clicks **Prepare email invitation**.
2. The backend creates a 48-hour hashed-token invite that may be redeemed only by that verified email holder.
3. Owner clicks **Open Gmail draft** or **Open email app**. The recipient, subject and message are filled in, including the full `https://fellowship.abundent.org/#invite=...` fragment. Press **Send** in that email client.
4. Recipient verifies email and accepts the invite. **Create link instead** remains as fallback for text messaging.

These are drafts. **The website itself does not yet send email automatically.** Do not display a success label such as "Email sent" on this path. This avoids accidentally misleading users and means no API secrets are exposed.

## Sender implementation: deployed, disabled until configured

The source for the isolated Neon Function is in [functions/sendinvite/index.mjs](../functions/sendinvite/index.mjs). It was deployed on **2026-11-21** to the dedicated fellowSHIP project as Neon Function `sendinvite`, with public endpoint `https://br-dawn-cherry-bbnlokf9-sendinvite.compute.c-15.us-east-1.aws.neon.tech/`. GitHub Pages itself continues to be the public website host.

A matching additive SQL migration [db/006_email_delivery.sql](../db/006_email_delivery.sql) was applied to the fellowSHIP database. It adds server-only per-invite send-attempt counters, a 2-minute resend cooldown, a maximum of three attempts per invite, and a 12-attempts-per-hour cap per inviter. It authorizes sending only when the caller owns the room and original invitation, the recipient email was bound to that invitation at creation, the inviter is verified, and the link is still unredeemed/unrevoked/unexpired.

The server checks Neon Auth JWT signing keys, validates the trusted site origin, forwards the user JWT to the restricted Neon Data API RPC for ownership verification, sends via Resend with a stable idempotency key, and does not log or retain plaintext invite tokens. Its provider secret is **not present**, so the endpoint is disabled for sending and the frontend correctly displays draft-email options. Browser UI automatically discovers readiness; when a server-side Resend key is configured, the primary button will offer **Send invitation email** and send using the same secure invite token.

**Required operator setup:** Check that the Resend sender domain is verified. Create a scoped, send-only API key in Resend. Set `RESEND_API_KEY` only as a **Neon Function deployment environment variable** for `sendinvite`; optionally set `RESEND_FROM` to a verified sending address. Never put keys in `app.js`, GitHub, or a ChatGPT message. Re-deploy or update the function environment on Neon; then verify the status endpoint reports readiness, and run a test send to an address you control. The free Neon Functions plan currently has a per-project free usage quota, which should be monitored.

**Sending status:** Not yet enabled. Neon deployment status `completed` means the function exists; it does **not** prove that Resend accepted email, that authenticating JWTs from the browser works, or that delivery arrived in an inbox.

## Direct-send requirement: secure transactional email service

The authoritative DNS zone for `abundent.org` has Resend-related TXT/CNAME/DKIM records. These records indicate a prior attempt to configure sending but **do not prove** that an active sender account/key is available to this project, or that the sender is verified by Resend.

The implemented **Send invitation email** button will provide true delivery once the sender credential is configured and tested. Before opening it beyond the pilot:
- Provision a **new least-privilege Resend API key** under the intended sender account, ideally restricted to sending from an `abundent.org` identity and stored only in a server-side secret store such as Neon Functions deployment environment. Never paste it into GitHub files or the static frontend.
- Deploy a dedicated server-side Neon Function in the **fellowSHIP Commons** project, not an existing pantry-gate or unrelated production app.
- Browser authenticates with Neon Auth. Server verifies a valid JWT and calls a dedicated Postgres function that checks the caller owns the room, finds the invitation by the SHA-256 hash of its token, requires a specific recipient email and verified-owner identity, enforces expiry, revocation and a strict per-account and per-room rate limit. It must not trust a user-supplied recipient address without database verification.
- Send a minimal HTML and plain text message using the sender provider; do not log the bearer invite token or store it in plaintext. Use provider idempotency and an email delivery audit record limited to intended parties. If sending fails, show that status accurately and offer the draft fallback.
- Keep the one-use acceptance semantics, email verification, and ability to revoke invitations. Add bounce/complaint protections, per-user throttling, and robust testing before enabling direct-send broadly.

The Gmail draft path is working without additional credentials. Server-side sending requires the missing Resend credential and a real delivery verification. No sending credentials are currently provisioned for fellowSHIP.

## Why this matters

Copying the link through ChatGPT or a phone messenger can break a long hash fragment and leaks an otherwise private token into that service. Opening a preaddressed email draft solves the copy/paste problem now, even while server-side automatic delivery awaits configuration.
