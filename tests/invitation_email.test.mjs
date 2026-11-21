import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const js = readFileSync("app.js", "utf8");
const html = readFileSync("index.html", "utf8");
const source = js.match(/function invitationEmailDraft\([\s\S]*?\n\}/)?.[0];
assert.ok(source, "invitation email draft helper must exist");
const invitationEmailDraft = new Function(source + "\nreturn invitationEmailDraft;")();

test("full single-use link survives encoding in Gmail and system email drafts", () => {
  const token = "a".repeat(64);
  const link = "https://fellowship.abundent.org/#invite=" + token;
  const { gmail, mailto } = invitationEmailDraft("paula@example.org", "December 4th- FIRST friday", link);
  const gmailUrl = new URL(gmail);
  assert.equal(gmailUrl.hostname, "mail.google.com");
  assert.equal(gmailUrl.searchParams.get("to"), "paula@example.org");
  assert.match(gmailUrl.searchParams.get("su"), /December 4th- FIRST friday/);
  assert.ok(gmailUrl.searchParams.get("body").includes(link));
  assert.ok(mailto.startsWith("mailto:paula%40example.org?subject="));
  assert.ok(decodeURIComponent(mailto).includes(link));
});

test("frontend labels drafts accurately, retains link fallback and does not include server API secrets", () => {
  for (const id of ["prepare-email-invite", "create-link-only", "open-gmail-invite", "open-mailto-invite", "invite-feedback"]) {
    assert.ok(html.includes('id="' + id + '"'), "Missing email UI element: " + id);
  }
  assert.ok(js.includes('db.rpc("issue_room_invite"'));
  assert.ok(js.includes("Open a preaddressed draft and press Send."));
  assert.ok(!js.includes("RESEND_API_KEY"), "No provider API key may be in the public frontend");
  assert.ok(!/Email sent successfully/i.test(js), "Draft must never claim email delivery");
});
