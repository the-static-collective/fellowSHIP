/* fellowSHIP Commons 001 — a browser client, NOT an authorization boundary.
   Every read/write is enforced by Supabase RLS in db/schema.sql.
   No service key, administration credential, or server-side secret belongs here. */

const $ = (id) => document.getElementById(id);
const CONFIG_URL = "fellowship.supabase.url";
const CONFIG_KEY = "fellowship.supabase.publishable";
let db = null;
let user = null;
let communities = [];
let rooms = [];
let currentRoom = null;
let roomRequest = 0;

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
function owns(room) { return user && room.created_by === user.id; }

function validateConfig(url, key) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("Use an HTTPS Supabase project URL.");
  }
  if (!key || key.startsWith("sb_secret_") || key.includes("service_role")) {
    throw new Error("Use only a public publishable or legacy anon key, never a secret key.");
  }
  // Older JWT anon keys contain the role claim in their payload.
  if (key.split(".").length === 3) {
    let claims;
    try { claims = JSON.parse(atob(key.split(".")[1])); }
    catch { throw new Error("That public key is not valid."); }
    if (claims.role !== "anon") {
      throw new Error("This is not an anon key. Never put a privileged key in the browser.");
    }
  } else if (!key.startsWith("sb_publishable_")) {
    throw new Error("Expected a Supabase publishable key.");
  }
  return [parsed.origin, key];
}

async function connect(url, key) {
  const [base, publicKey] = validateConfig(url, key);
  if (!window.supabase?.createClient) {
    throw new Error("The Supabase browser SDK did not load. Check your network connection.");
  }
  db = window.supabase.createClient(base, publicKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  localStorage.setItem(CONFIG_URL, base);
  localStorage.setItem(CONFIG_KEY, publicKey);
  db.auth.onAuthStateChange((_event, session) => {
    const formerId = user?.id;
    user = session?.user || null;
    displaySession();
    if (user && user.id !== formerId) {
      queueMicrotask(() => action(refreshWorkspace));
    }
  });
  const { data, error } = await db.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  user = data?.user || null;
  displaySession();
  if (user) await refreshWorkspace();
  else notice("Connected · Sign in to continue");
}

function displaySession() {
  $("setup-panel").hidden = Boolean(db);
  $("auth-panel").hidden = !db || Boolean(user);
  $("workspace").hidden = !user;
  if (user) $("member-id").textContent = user.id;
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
  if (!rooms.some((r) => r.id === currentRoom)) currentRoom = rooms[0]?.id || null;
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
  const [taskResponse, memberResponse, activityResponse] = await Promise.all([
    db.from("tasks").select("id,title,details,status,created_by,created_at,updated_at")
      .eq("room_id", room.id).order("created_at", { ascending: false }),
    db.from("room_members").select("user_id,role,added_at").eq("room_id", room.id),
    db.from("activity").select("id,actor_id,action,details,occurred_at")
      .eq("room_id", room.id).order("occurred_at", { ascending: false }).limit(40)
  ]);
  if (request !== roomRequest) return; // A faster room switch has superseded us.
  for (const result of [taskResponse, memberResponse, activityResponse]) {
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
  $("member-form").hidden = !owns(room);
  drawTasks(taskResponse.data || [], editor);
  drawMembers(room, members);
  drawActivity(activityResponse.data || []);
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
  $("setup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    action(() => connect(cleanInput("project-url"), cleanInput("project-key")));
  });
  $("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    action(async () => {
      const { error } = await db.auth.signInWithOtp({
        email: cleanInput("login-email"),
        options: { emailRedirectTo: window.location.origin + window.location.pathname }
      });
      if (error) throw error;
      notice("Check your email for a sign-in link.");
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
  $("room-form").addEventListener("submit", (e) => {
    e.preventDefault();
    action(async () => {
      const { data, error } = await db.from("rooms").insert({
        community_id: $("room-community").value,
        name: cleanInput("room-name"),
        created_by: user.id
      }).select("id").single();
      if (error) throw error;
      currentRoom = data.id;
      $("room-name").value = "";
      await refreshWorkspace();
    });
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
  $("member-form").addEventListener("submit", (e) => {
    e.preventDefault();
    action(async () => {
      const collaborator = cleanInput("invite-user");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collaborator)) {
        throw new Error("Ask the collaborator to copy their full member ID.");
      }
      const { error } = await db.from("room_members").insert({
        room_id: currentRoom, user_id: collaborator, role: $("invite-role").value
      });
      if (error) throw error;
      $("invite-user").value = "";
      await loadRoom();
      notice("Access granted to collaborator");
    });
  });
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
    displaySession();
    notice("Signed out");
  }));
}
async function start() {
  bindForms();
  const url = localStorage.getItem(CONFIG_URL);
  const key = localStorage.getItem(CONFIG_KEY);
  if (url && key) {
    $("project-url").value = url;
    $("project-key").value = key;
    await action(() => connect(url, key));
  } else {
    displaySession();
  }
}
void start();
