/* fellowSHIP Commons 001 — independent Neon backend.
   RLS in db/neon-schema.sql is the authority, never frontend state.
   These are PUBLIC Neon endpoints. Never embed role passwords or service secrets. */

import { createClient } from "https://esm.sh/@neondatabase/neon-js@0.9.0-beta";
const $ = (id) => document.getElementById(id);
const NEON_AUTH_URL = "https://ep-broad-waterfall-bbq2rh82.neonauth.c-15.us-east-1.aws.neon.tech/fellowship/auth";
const NEON_DATA_URL = "https://ep-broad-waterfall-bbq2rh82.apirest.c-15.us-east-1.aws.neon.tech/fellowship/rest/v1";
const INVITE_EMAIL_SERVICE_URL = "https://br-dawn-cherry-bbnlokf9-sendinvite.compute.c-15.us-east-1.aws.neon.tech/";
let directInviteEmailReady = false;
let db = null;
let user = null;
let communities = [];
let rooms = [];
let currentRoom = null;
let roomRequest = 0;
let pendingInvite = null;

function restoreInviteFromLink() {
  const fromFragment = /^#invite=([0-9a-f]{64})$/.exec(window.location.hash);
  if (fromFragment) {
    sessionStorage.setItem("fellowship.pendingRoomInvite", fromFragment[1]);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  pendingInvite = sessionStorage.getItem("fellowship.pendingRoomInvite") || null;
}
function setPendingInvite(token) {
  pendingInvite = token || null;
  if (pendingInvite) sessionStorage.setItem("fellowship.pendingRoomInvite", pendingInvite);
  else sessionStorage.removeItem("fellowship.pendingRoomInvite");
  displayInvitation();
}
function displayInvitation() {
  $("pending-invite-panel").hidden = !pendingInvite;
  $("accept-room-invite").disabled = !pendingInvite || !user || !db;
  $("pending-invite-message").textContent = user
    ? "You are signed in. Accept to join the invited project room."
    : "Sign in or create an account, then accept this private invitation.";
}


function notice(message, isError = false) {
  $("status").textContent = message;
  $("status").dataset.error = String(isError);
}
function errorMessage(error) {
  return error?.message || String(error);
}
async function action(work) {
  try { await work(); }
  catch (error) {
    console.error(error);
    notice(errorMessage(error), true);
  }
}
function cleanInput(id) { return $(id).value.trim(); }
function shortId(id) { return id ? id.slice(0, 8) + "…" : "unknown"; }
function addText(parent, tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}
function dateText(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function clearGeneratedInvite() {
  $("invite-link").value = "";
  $("generated-invite").hidden = true;
  $("invite-email-options").hidden = true;
  $("open-gmail-invite").removeAttribute("href");
  $("open-mailto-invite").removeAttribute("href");
  $("invite-feedback").hidden = true;
}

function invitationEmailDraft(email, room, url) {
  // Only generate outbound links with encoded recipient, subject and body.
  const subject = "Invitation to " + room + " on fellowSHIP";
  const body = [
    "You've been invited to work on " + room + " at fellowSHIP.",
    "",
    "Open this private invitation to join the room:",
    url,
    "",
    "Sign in or create an account and verify your email address.",
    "This invitation can only be used once and expires in 48 hours.",
    "",
    "fellowSHIP — make something good, together."
  ].join("\n");
  const params = new URLSearchParams({ view: "cm", fs: "1", to: email, su: subject, body });
  return {
    gmail: "https://mail.google.com/mail/?" + params.toString(),
    mailto: "mailto:" + encodeURIComponent(email) +
      "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body)
  };
}

function owns(room) { return user && room.created_by === user.id; }

async function connect() {
  db = createClient({ auth: { url: NEON_AUTH_URL }, dataApi: { url: NEON_DATA_URL } });
  await refreshSession();
  void detectDirectEmail();
}

async function detectDirectEmail() {
  try {
    const response = await fetch(INVITE_EMAIL_SERVICE_URL, { headers: { accept: "application/json" } });
    if (response.ok) directInviteEmailReady = (await response.json()).ready === true;
  } catch {
    directInviteEmailReady = false;
  }
  $("prepare-email-invite").textContent = directInviteEmailReady
    ? "Send invitation email" : "Prepare email invitation";
  $("direct-email-hint").textContent = directInviteEmailReady
    ? "Email invitations are sent directly. A prepared draft remains available if sending fails."
    : "The email draft opens in Gmail or your mail app with the entire link; press Send. Automatic sending is not yet configured.";
}

async function sendInviteEmailThroughService(token) {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  const jwt = data?.session?.token;
  if (!jwt) throw new Error("Sign in again to send an email.");
  const response = await fetch(INVITE_EMAIL_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + jwt
    },
    body: JSON.stringify({ token })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.sent !== true) {
    throw new Error(result.error || "The email service did not confirm sending.");
  }
  return result;
}

async function refreshSession() {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  const previousId = user?.id;
  user = data?.user || null;
  displaySession();
  if (user && user.id !== previousId) await refreshWorkspace();
  else if (user) notice("Signed in · " + user.email);
  else notice("Ready · Sign in to participate");
}

function displaySession() {
  $("auth-panel").hidden = Boolean(user);
  $("workspace").hidden = !user;
  if (user) {
    $("member-id").textContent = user.id;
    $("verify-email-panel").hidden = true;
  }
  displayInvitation();
}

async function refreshWorkspace() {
  if (!db || !user) return;
  notice("Refreshing rooms…");
  const [communityResponse, roomResponse] = await Promise.all([
    db.from("communities").select("id,name,created_by,created_at").order("created_at"),
    db.from("rooms").select("id,community_id,name,description,created_by,created_at").order("created_at")
  ]);
  if (communityResponse.error) throw communityResponse.error;
  if (roomResponse.error) throw roomResponse.error;
  communities = communityResponse.data || [];
  rooms = roomResponse.data || [];
  if (!rooms.some((r) => r.id === currentRoom)) {
    currentRoom = rooms[0]?.id || null;
    clearGeneratedInvite();
  }
  drawCommunities();
  drawRooms();
  if (currentRoom) await loadRoom();
  else clearRoom();
  notice("Synced · " + rooms.length + " accessible room" + (rooms.length === 1 ? "" : "s"));
}

function drawCommunities() {
  const list = $("community-list");
  list.replaceChildren();
  if (!communities.length) addText(list, "li", "No communities yet. Start one below.", "muted");
  for (const community of communities) {
    const li = document.createElement("li");
    addText(li, "strong", community.name);
    addText(li, "span", community.created_by === user.id ? "Founded by you" : "Collaborating", "muted small");
    list.append(li);
  }
  const select = $("room-community");
  select.replaceChildren();
  const mine = communities.filter((c) => c.created_by === user.id);
  for (const community of mine) {
    const option = document.createElement("option");
    option.value = community.id;
    option.textContent = community.name;
    select.append(option);
  }
  $("room-form").hidden = mine.length === 0;
}

function drawRooms() {
  const list = $("room-list");
  list.replaceChildren();
  if (!rooms.length) addText(list, "li", "No rooms accessible yet.", "muted");
  for (const room of rooms) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-choice" + (room.id === currentRoom ? " selected" : "");
    addText(button, "strong", room.name);
    const community = communities.find((c) => c.id === room.community_id);
    addText(button, "span", community?.name || "Shared community", "muted small");
    button.addEventListener("click", () => action(async () => {
      if (room.id !== currentRoom) {
        clearGeneratedInvite();
      }
      currentRoom = room.id;
      drawRooms();
      await loadRoom();
    }));
    li.append(button);
    list.append(li);
  }
}

function clearRoom() {
  roomRequest++;
  $("room-empty").hidden = false;
  $("room-detail").hidden = true;
}
async function loadRoom() {
  const room = rooms.find((r) => r.id === currentRoom);
  if (!room) return clearRoom();
  const request = ++roomRequest;
  const [taskResponse, memberResponse, activityResponse, checkinResponse, invitesResponse] = await Promise.all([
    db.from("tasks").select("id,title,details,status,created_by,created_at,updated_at")
      .eq("room_id", room.id).order("created_at", { ascending: false }),
    db.from("room_members").select("user_id,role,added_at").eq("room_id", room.id),
    db.from("activity").select("id,actor_id,action,details,occurred_at")
      .eq("room_id", room.id).order("occurred_at", { ascending: false }).limit(40),
    db.from("room_checkins").select("seen_at").eq("room_id", room.id).eq("user_id", user.id).maybeSingle(),
    owns(room) ? db.rpc("list_room_invites", { p_room: room.id }) : Promise.resolve({ data: [], error: null })
  ]);
  if (request !== roomRequest) return; // A faster room switch has superseded us.
  for (const result of [taskResponse, memberResponse, activityResponse, checkinResponse, invitesResponse]) {
    if (result.error) throw result.error;
  }
  const members = memberResponse.data || [];
  const editor = owns(room) || members.some((m) => m.user_id === user.id && m.role === "editor");
  $("room-empty").hidden = true;
  $("room-detail").hidden = false;
  $("room-title").textContent = room.name;
  $("room-description").textContent = room.description || "A place for people to carry work together.";
  $("room-parent").textContent = communities.find((c) => c.id === room.community_id)?.name || "SHARED PROJECT";
  $("room-role").textContent = owns(room) ? "Owner" : editor ? "Editor" : "Viewer";
  $("task-form").hidden = !editor;
  $("invite-tools").hidden = !owns(room);
  drawTasks(taskResponse.data || [], editor);
  drawMembers(room, members);
  drawActivity(activityResponse.data || []);
  drawCatchup(activityResponse.data || [], checkinResponse.data?.seen_at || null);
  if (owns(room)) drawInvites(invitesResponse.data || []);
}
function drawTasks(tasks, editor) {
  const list = $("task-list");
  list.replaceChildren();
  $("task-count").textContent = tasks.length + " total";
  if (!tasks.length) addText(list, "li", "Nothing assigned yet. Start with one concrete action.", "muted");
  for (const task of tasks) {
    const li = document.createElement("li");
    li.className = "task-item";
    const body = document.createElement("div");
    addText(body, "strong", task.title);
    if (task.details) addText(body, "p", task.details, "muted small");
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Status for " + task.title);
    select.disabled = !editor;
    for (const [value, label] of [["todo", "To do"], ["doing", "In progress"], ["done", "Done"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    select.value = task.status;
    select.addEventListener("change", () => action(async () => {
      const { error } = await db.from("tasks").update({ status: select.value }).eq("id", task.id);
      if (error) { select.value = task.status; throw error; }
      await loadRoom();
      notice("Task updated");
    }));
    li.append(body, select);
    list.append(li);
  }
}
function drawMembers(room, members) {
  const list = $("members-list");
  list.replaceChildren();
  addText(list, "li", "Owner · " + (room.created_by === user.id ? "You" : shortId(room.created_by)));
  for (const member of members) {
    const li = document.createElement("li");
    li.className = "member-row";
    addText(li, "span",
      (member.user_id === user.id ? "You" : shortId(member.user_id)) + " · " + member.role
    );
    if (owns(room)) {
      const role = document.createElement("select");
      role.setAttribute("aria-label", "Access level for " + shortId(member.user_id));
      for (const value of ["viewer", "editor"]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        role.append(option);
      }
      role.value = member.role;
      role.addEventListener("change", () => action(async () => {
        const { error } = await db.from("room_members")
          .update({ role: role.value })
          .eq("room_id", room.id).eq("user_id", member.user_id);
        if (error) { role.value = member.role; throw error; }
        await loadRoom();
        notice("Collaborator access updated");
      }));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "quiet";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + shortId(member.user_id) + " from room");
      remove.addEventListener("click", () => action(async () => {
        if (!window.confirm("Remove this person's access to the room?")) return;
        const { error } = await db.from("room_members").delete()
          .eq("room_id", room.id).eq("user_id", member.user_id);
        if (error) throw error;
        await loadRoom();
        notice("Access revoked");
      }));
      li.append(role, remove);
    }
    list.append(li);
  }
}
function drawCatchup(events, lastSeen) {
  const recent = lastSeen
    ? events.filter((event) => new Date(event.occurred_at) > new Date(lastSeen))
    : events;
  const text = lastSeen
    ? (recent.length ? recent.length + " recorded changes since " + dateText(lastSeen) : "No new task changes since your last check-in.")
    : "First visit on this account: here are the most recent changes in this room.";
  $("catchup-summary").textContent = text + (recent.length >= 40 ? " (Showing at most 40 recent events.)" : "");
  const list = $("catchup-list");
  list.replaceChildren();
  for (const event of recent.slice(0, 8)) {
    const actor = event.actor_id === user.id ? "You" : shortId(event.actor_id);
    const verb = event.action === "task_created" ? "created" : "updated";
    addText(list, "li", actor + " " + verb + " · " + (event.details?.title || "a task"));
  }
  $("mark-caught-up").disabled = Boolean(lastSeen && recent.length === 0);
}

function drawInvites(invites) {
  const list = $("invite-list");
  list.replaceChildren();
  if (!invites.length) addText(list, "li", "No invitations created yet.", "muted");
  for (const invite of invites) {
    const li = document.createElement("li");
    li.className = "invite-row";
    const status = invite.redeemed_at ? "used" : invite.revoked_at ? "revoked"
      : new Date(invite.expires_at) < new Date() ? "expired" : "open";
    const description = invite.invite_role + " · " + (invite.recipient_email || "anyone with link");
    addText(li, "span", description + " · " + status);
    addText(li, "small", "Expires " + dateText(invite.expires_at), "muted");
    if (status === "open") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiet";
      button.textContent = "Revoke";
      button.addEventListener("click", () => action(async () => {
        const { data, error } = await db.rpc("revoke_room_invite", { p_invite: invite.invite_id });
        if (error) throw error;
        if (!data) throw new Error("Invitation was already redeemed, revoked or expired.");
        await loadRoom();
        notice("Invitation revoked");
      }));
      li.append(button);
    }
    list.append(li);
  }
}

function drawActivity(events) {
  const list = $("activity-list");
  list.replaceChildren();
  if (!events.length) addText(list, "li", "No recorded activity yet.", "muted");
  for (const event of events) {
    const li = document.createElement("li");
    const actor = event.actor_id === user.id ? "You" : shortId(event.actor_id);
    const description = event.action === "task_created" ? "created" : "updated";
    const title = event.details?.title || "a task";
    addText(li, "span", actor + " " + description + " “" + title + "”");
    addText(li, "time", dateText(event.occurred_at), "muted small");
    list.append(li);
  }
}

function bindForms() {
  $("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    action(async () => {
      const { error } = await db.auth.signIn.email({
        email: cleanInput("login-email"),
        password: $("login-password").value
      });
      if (error) throw error;
      $("login-password").value = "";
      await refreshSession();
    });
  });
  $("signup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    action(async () => {
      const { error } = await db.auth.signUp.email({
        name: cleanInput("signup-name"),
        email: cleanInput("signup-email"),
        password: $("signup-password").value
      });
      if (error) throw error;
      $("signup-password").value = "";
      $("verify-email").value = cleanInput("signup-email");
      $("verify-email-panel").hidden = false;
      await refreshSession();
      if (!user) notice("Account created · check your email for a verification code");
    
    });
  });
  $("verify-email-form").addEventListener("submit", (e) => {
    e.preventDefault();
    action(async () => {
      const { error } = await db.auth.emailOtp.verifyEmail({
        email: cleanInput("verify-email"),
        otp: cleanInput("verify-code")
      });
      if (error) throw error;
      $("verify-code").value = "";
      $("verify-email-panel").hidden = true;
      await refreshSession();
      notice(user ? "Email verified · welcome to fellowSHIP" : "Email verified · sign in to continue");
    });
  });
  $("community-form").addEventListener("submit", (e) => {
    e.preventDefault();
    action(async () => {
      const { error } = await db.from("communities").insert({
        name: cleanInput("community-name"), created_by: user.id
      });
      if (error) throw error;
      $("community-name").value = "";
      await refreshWorkspace();
    });
  });
  $("room-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = $("create-room");
    const feedback = $("room-feedback");
    const p_community = $("room-community").value;
    const p_name = cleanInput("room-name");
    button.disabled = true;
    feedback.hidden = false;
    feedback.dataset.error = "false";
    feedback.textContent = "Creating room…";
    try {
      if (!user || !p_community) throw new Error("Sign in and select a community first.");
      // Only the signed-in community founder may create a room. The RPC
      // checks ownership in PostgreSQL and generates the room ID server-side.
      const { data, error } = await db.rpc("create_fellowship_room", {
        p_community, p_name
      });
      if (error) throw error;
      if (!data || typeof data !== "string") throw new Error("The server did not return a room ID.");
      currentRoom = data;
      $("room-name").value = "";
      await refreshWorkspace();
      feedback.textContent = "Room created successfully.";
      notice("Room created · " + p_name);
    } catch (error) {
      console.error("Failed to create room", error);
      feedback.dataset.error = "true";
      feedback.textContent = "Room not created: " + errorMessage(error);
      notice("Room not created. See the message below the Create room button.", true);
    } finally {
      button.disabled = false;
    }
  });
  $("task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    action(async () => {
      const { error } = await db.from("tasks").insert({
        room_id: currentRoom, title: cleanInput("task-title"),
        details: cleanInput("task-details"), created_by: user.id
      });
      if (error) throw error;
      $("task-title").value = "";
      $("task-details").value = "";
      await loadRoom();
      notice("Task added");
    });
  });
  async function createRoomInvitation(linkOnly = false) {
    const button = linkOnly ? $("create-link-only") : $("prepare-email-invite");
    const feedback = $("invite-feedback");
    const email = cleanInput("invite-email").toLowerCase();
    const room = rooms.find((r) => r.id === currentRoom);
    feedback.hidden = false;
    feedback.dataset.error = "false";
    feedback.textContent = linkOnly ? "Generating your private link…" : "Preparing the email invitation…";
    button.disabled = true;
    try {
      if (!room || !owns(room)) throw new Error("Select a room you own first.");
      if (!linkOnly && !email) throw new Error("Enter a recipient email, or choose Create link instead.");
      const { data, error } = await db.rpc("issue_room_invite", {
        p_room: room.id,
        p_role: $("invite-role").value,
        p_target_email: email || null
      });
      if (error) throw error;
      if (!/^[0-9a-f]{64}$/.test(data || "")) throw new Error("The server did not return a valid invitation.");
      const link = window.location.origin + window.location.pathname + "#invite=" + data;
      $("invite-link").value = link;
      $("generated-invite").hidden = false;
      $("invite-email-options").hidden = linkOnly || !email;
      if (email && !linkOnly) {
        const drafts = invitationEmailDraft(email, room.name, link);
        $("open-gmail-invite").href = drafts.gmail;
        $("open-mailto-invite").href = drafts.mailto;
        $("invite-created-message").textContent =
          "Ready for " + email + ". Open a preaddressed draft and press Send.";
        feedback.textContent = "Private invitation created. Choose Open Gmail draft or Open email app below.";
      } else {
        $("open-gmail-invite").removeAttribute("href");
        $("open-mailto-invite").removeAttribute("href");
        $("invite-created-message").textContent = "Private link ready. Copy or share it with the intended person.";
        feedback.textContent = "Private invitation link created.";
      }
      let sent = false;
      if (!linkOnly && email && directInviteEmailReady) {
        feedback.textContent = "Sending the email invitation…";
        try {
          const result = await sendInviteEmailThroughService(data);
          sent = true;
          feedback.textContent = "Email accepted for sending to " + result.recipient + ".";
          $("invite-created-message").textContent =
            "Email accepted by the sending service. The private draft remains as backup.";
        } catch (deliveryError) {
          console.error("Automatic email could not be sent", deliveryError);
          feedback.dataset.error = "true";
          feedback.textContent = "Email was not confirmed: " + errorMessage(deliveryError)
            + " Use the draft links below to send it manually.";
        }
      }
      try { await loadRoom(); } catch (refreshError) { console.warn("Invitation list refresh failed", refreshError); }
      if (sent) notice("Invitation email accepted for sending");
      else notice("Invitation ready · " + (linkOnly ? "copy the link" : "open a preaddressed email draft"));
    } catch(error) {
      console.error("Invitation creation failed", error);
      feedback.dataset.error = "true";
      feedback.textContent = "Invitation not created: " + errorMessage(error);
      notice("Invitation could not be created. See the message below the form.", true);
    } finally {
      button.disabled = false;
    }
  }
  $("invite-form").addEventListener("submit", (e) => {
    e.preventDefault();
    void createRoomInvitation(false);
  });
  $("create-link-only").addEventListener("click", () => {
    void createRoomInvitation(true);
  });
  $("copy-invite-link").addEventListener("click", () => action(async () => {
    await navigator.clipboard.writeText($("invite-link").value);
    notice("One-time invitation link copied");
  }));
  $("accept-room-invite").addEventListener("click", () => action(async () => {
    if (!user || !pendingInvite) throw new Error("Sign in and open a valid invitation first.");
    const { data, error } = await db.rpc("redeem_room_invite", { p_token: pendingInvite });
    if (error) throw error;
    if (!data) throw new Error("Could not join the room.");
    setPendingInvite(null);
    currentRoom = data;
    await refreshWorkspace();
    notice("Invitation accepted · welcome to your room");
  }));
  $("dismiss-room-invite").addEventListener("click", () => {
    setPendingInvite(null);
    notice("Invitation dismissed on this device");
  });
  $("mark-caught-up").addEventListener("click", () => action(async () => {
    const room = currentRoom;
    if (!room || !user) return;
    const { error } = await db.from("room_checkins").upsert(
      { room_id: room, user_id: user.id },
      { onConflict: "room_id,user_id" }
    );
    if (error) throw error;
    if (room === currentRoom) await loadRoom();
    notice("Room check-in saved for your account");
  }));
  $("refresh").addEventListener("click", () => action(refreshWorkspace));
  $("copy-id").addEventListener("click", () => action(async () => {
    await navigator.clipboard.writeText(user.id);
    notice("Member ID copied");
  }));
  $("sign-out").addEventListener("click", () => action(async () => {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    user = null;
    communities = [];
    rooms = [];
    currentRoom = null;
    clearGeneratedInvite();
    displaySession();
    notice("Signed out");
  }));
}
async function start() {
  restoreInviteFromLink();
  bindForms();
  displayInvitation();
  await action(connect);
}
void start();
