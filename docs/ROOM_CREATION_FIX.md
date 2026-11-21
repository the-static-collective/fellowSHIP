# Room creation repair — 2026-11-21

## Report

User successfully signed into `https://fellowship.abundent.org`, founded the `fellowship` community, selected it and entered a room name, but the **Create room** button produced no visible room.

Read-only Neon inspection confirmed:
- Exactly one existing community and one verified user, matching the screenshot's account.
- No rooms had been created.
- The previous frontend used `from("rooms").insert(...).select("id").single()`, whose returned representation also depends on row-level SELECT access.
- The form's error was only displayed in the top masthead (off-screen in the screenshot). **The original server error was not captured**, so the exact failure mechanism is unproven. Do not claim the old insert/returning path definitely caused it.

## Repair

- Installed `db/005_create_room_rpc.sql` on the isolated `fellowship` Neon database. It defines `public.create_fellowship_room(p_community uuid,p_name text)` as a restricted SECURITY DEFINER function with explicit signed-in identity, community-founder authorization, name validation, and server-generated room ID. It cannot be called anonymously.
- The frontend now uses `db.rpc("create_fellowship_room", ...)` instead of a REST insert followed by `.single()`.
- Added a local progress/error/success message under **Create room** and disables the button during a request. On failure, user input stays in place and the exact server-reported message appears next to the form.
- Neon Data API schema cache refreshed for the new RPC.

## Verification

- JavaScript syntax validation passes; all frontend element IDs referenced by JavaScript exist.
- Database privileges: `authenticated` may execute the RPC; `anonymous` may not.
- Restricted role with no JWT was rejected with `Sign in to create a project room`.
- No room was inserted by the negative authorization tests.
- A genuine user-authenticated room creation still requires a click-through test; **do not describe it as verified until a real room appears in Neon**.

## Deployment

Source branch: `feat/commons-foundation-001`, draft PR #1. Static site on the dedicated `gh-pages` branch is redeployed from these source files only. Keep GitHub Pages and `fellowship.abundent.org`; no Vercel changes.
