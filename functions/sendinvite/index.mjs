// fellowSHIP private invitation email sender.
// Runs as a Neon Function; no provider secret or database password in browser code.
// RESEND_API_KEY is configured only in the Neon Function's server-side environment.
import { createPublicKey, verify as verifySignature } from "node:crypto";

const SITE_ORIGIN = "https://fellowship.abundent.org";
const ALLOWED_ORIGINS = new Set([SITE_ORIGIN]);
let cachedKeys = null;
let keysExpiry = 0;

function headers(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : SITE_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
function reply(status, body, origin) {
  return Response.json(body, { status, headers: headers(origin) });
}
async function publicKeys() {
  if (cachedKeys && keysExpiry > Date.now()) return cachedKeys;
  const url = process.env.NEON_AUTH_JWKS_URL;
  if (!url) throw new Error("Missing auth key configuration");
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Unable to fetch auth signing keys");
  const data = await response.json();
  if (!Array.isArray(data.keys)) throw new Error("Invalid auth signing keys");
  cachedKeys = data.keys;
  keysExpiry = Date.now() + 5 * 60 * 1000;
  return cachedKeys;
}
async function verifyNeonJWT(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid bearer token");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (header.alg !== "EdDSA" || typeof header.kid !== "string" || !header.kid)
    throw new Error("Unsupported auth token");
  const issuer = new URL(process.env.NEON_AUTH_BASE_URL || "").origin;
  const now = Math.floor(Date.now() / 1000);
  if (!issuer || payload.iss !== issuer || typeof payload.sub !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(payload.sub) ||
      !Number.isFinite(payload.exp) || payload.exp <= now ||
      (typeof payload.nbf === "number" && payload.nbf > now + 30))
    throw new Error("Expired or invalid auth token");
  let key = (await publicKeys()).find((item) => item.kid === header.kid && item.kty === "OKP");
  if (!key) {
    keysExpiry = 0;
    key = (await publicKeys()).find((item) => item.kid === header.kid && item.kty === "OKP");
  }
  if (!key) throw new Error("Unrecognized signing key");
  const verified = verifySignature(
    null, Buffer.from(parts[0] + "." + parts[1]),
    createPublicKey({ key, format: "jwk" }), Buffer.from(parts[2], "base64url")
  );
  if (!verified) throw new Error("Invalid auth signature");
  return payload.sub;
}
function safeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
const handler = {
  async fetch(request) {
    const origin = request.headers.get("origin") || "";
    if (origin && !ALLOWED_ORIGINS.has(origin))
      return reply(403, { error: "Origin not allowed" }, origin);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: headers(origin) });
    if (request.method === "GET")
      return reply(200, { ready: Boolean(process.env.RESEND_API_KEY) }, origin);
    if (request.method !== "POST")
      return reply(405, { error: "Method not allowed" }, origin);
    if (!process.env.RESEND_API_KEY)
      return reply(503, { error: "Automatic delivery not yet configured; use the email draft" }, origin);
    const auth = request.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ") || auth.length > 4096)
      return reply(401, { error: "Sign in to send invitations" }, origin);
    const jwt = auth.slice(7);
    try { await verifyNeonJWT(jwt); }
    catch { return reply(401, { error: "Please sign in again" }, origin); }
    let token;
    try {
      const body = await request.text();
      if (body.length > 1024) throw new Error("Request too large");
      token = JSON.parse(body).token;
      if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token))
        throw new Error("Invalid invitation token");
    } catch {
      return reply(400, { error: "Invalid invitation" }, origin);
    }
    const api = process.env.NEON_DATA_API_URL;
    if (!api || !api.startsWith("https://"))
      return reply(503, { error: "Mail backend not configured" }, origin);

    // The Data API authenticates the *same* human JWT and the SQL RPC enforces
    // the inviter's ownership, exact database-bound email and send limits.
    let delivery;
    try {
      const claim = await fetch(api.replace(/\/$/, "") + "/rpc/reserve_room_invite_email", {
        method: "POST",
        headers: { "Authorization": "Bearer " + jwt, "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: token }),
      });
      if (!claim.ok) {
        return reply(claim.status === 401 ? 401 : 403,
          { error: "Invitation unavailable or email limit reached. Use the email draft." }, origin);
      }
      delivery = await claim.json();
      if (!delivery || typeof delivery.recipient !== "string" ||
          typeof delivery.invite_id !== "string" ||
          typeof delivery.room_name !== "string")
        throw new Error("Invalid authorized recipient");
    } catch {
      return reply(502, { error: "Could not authorize the invitation email; use the draft" }, origin);
    }

    const url = SITE_ORIGIN + "/#invite=" + token;
    const room = delivery.room_name.slice(0, 100);
    const subject = "Your invitation to " + room + " · fellowSHIP";
    const message = [
      "You are invited to collaborate in the " + room + " project room on fellowSHIP.",
      "", "Use this private invitation:", url, "",
      "Sign in or create an account with the invited email address, then accept.",
      "This link expires in 48 hours and works once.",
      "", "fellowSHIP — make something good, together."
    ].join("\n");
    const html = "<p>You are invited to collaborate in <strong>" + safeHtml(room) +
      "</strong> on fellowSHIP.</p><p><a href=\"" + url +
      "\">Accept your private room invitation</a></p>" +
      "<p>Sign in with the invited email address. The link expires in 48 hours and works once.</p>";
    try {
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + process.env.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Idempotency-Key": "fellowship-room-" + delivery.invite_id
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "fellowSHIP <invites@abundent.org>",
          to: [delivery.recipient], subject, text: message, html
        })
      });
      if (!sent.ok)
        return reply(502, { error: "Email provider could not send; use the email draft" }, origin);
      const result = await sent.json();
      if (!result?.id)
        return reply(502, { error: "Email provider did not confirm delivery; use the email draft" }, origin);
      return reply(200, { sent: true, recipient: delivery.recipient }, origin);
    } catch {
      return reply(502, { error: "Email sending failed; use the email draft" }, origin);
    }
  }
};
export default handler;
