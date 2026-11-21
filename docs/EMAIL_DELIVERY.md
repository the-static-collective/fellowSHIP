# Invitation email delivery

## Current working option: prepared Gmail/email-app drafts (no copying)

The browser can now produce a complete, URL-safe email message containing an actual single-use invitation:
1. Room owner enters the invitee's email and role, then clicks **Prepare email invitation**.
2. The backend creates a 48-hour hashed-token invite that may be redeemed only by that verified email holder.
3. Owner clicks **Open Gmail draft** or **Open email app**. The recipient, subject and message are filled in, including the full `https://fellowship.abundent.org/#invite=...` fragment. Press **Send** in that email client.
4. Recipient verifies email and accepts the invite. **Create link instead** remains as fallback for text messaging.

These are drafts. **The website itself does not yet send email automatically.** Do not display a success label such as "Email sent" on this path. This avoids accidentally misleading users and means no API secrets are exposed.

## Direct-send requirement: secure transactional email service

The authoritative DNS zone for `abundent.org` has Resend-related TXT/CNAME/DKIM records. These records indicate a prior attempt to configure sending but **do not prove** that an active sender account/key is available to this project, or that the sender is verified by Resend.

To provide a **Send invitation now** button with true delivery:
- Provision a **new least-privilege Resend API key** under the intended sender account, ideally restricted to sending from an `abundent.org` identity and stored only in a server-side secret store such as Neon Functions deployment environment. Never paste it into GitHub files or the static frontend.
- Deploy a dedicated server-side Neon Function in the **fellowSHIP Commons** project, not an existing pantry-gate or unrelated production app.
- Browser authenticates with Neon Auth. Server verifies a valid JWT and calls a dedicated Postgres function that checks the caller owns the room, finds the invitation by the SHA-256 hash of its token, requires a specific recipient email and verified-owner identity, enforces expiry, revocation and a strict per-account and per-room rate limit. It must not trust a user-supplied recipient address without database verification.
- Send a minimal HTML and plain text message using the sender provider; do not log the bearer invite token or store it in plaintext. Use provider idempotency and an email delivery audit record limited to intended parties. If sending fails, show that status accurately and offer the draft fallback.
- Keep the one-use acceptance semantics, email verification, and ability to revoke invitations. Add bounce/complaint protections, per-user throttling, and robust testing before enabling direct-send broadly.

The Gmail draft path is working without additional credentials or database migrations. Automatically sending real mail still requires a securely configured outbound service; no sender credentials are currently provisioned for fellowSHIP.

## Why this matters

Copying the link through ChatGPT or a phone messenger can break a long hash fragment and leaks an otherwise private token into that service. Opening a preaddressed email draft solves the copy/paste problem now, even while server-side automatic delivery awaits configuration.
