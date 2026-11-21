-- fellowSHIP Commons 001 — isolated bootstrap for a NEW Neon project.
-- Run once AFTER provisioning Managed Better Auth and the Neon Data API.
-- Do NOT apply to an unrelated or existing production schema.
-- Public Data API tables use RLS. No privileged frontend secret is required.

create schema if not exists private;
grant usage on schema public to authenticated;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Neon owns the managed auth schema. Do not grant its schema to app roles.
-- A narrow definer wrapper exposes only the *current verified JWT subject*.
create function private.current_uid()
returns uuid language sql stable security definer set search_path = ''
as $ select auth.uid(); $;
revoke all on function private.current_uid() from public;
grant execute on function private.current_uid() to authenticated;

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  created_by uuid not null references neon_auth."user"(id),
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  created_by uuid not null references neon_auth."user"(id),
  created_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references neon_auth."user"(id),
  role text not null check (role in ('viewer', 'editor')),
  added_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  details text not null default '' check (char_length(details) <= 5000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  created_by uuid not null references neon_auth."user"(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id),
  task_id uuid references public.tasks(id),
  actor_id uuid references neon_auth."user"(id),
  action text not null check (action in ('task_created', 'task_updated')),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index room_members_user on public.room_members(user_id, room_id);
create index rooms_community on public.rooms(community_id);
create index tasks_room on public.tasks(room_id, created_at desc);
create index activity_room on public.activity(room_id, occurred_at desc);

-- These narrow SECURITY DEFINER *read helpers* avoid circular RLS policies.
-- The private helper wraps Neon Data API's auth.uid() for restricted roles.
-- The caller is still identified with private.current_uid(); helpers are in an
-- unexposed schema with fixed search_path. Never accept arbitrary user IDs.
create function private.room_can_read(p_room uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select private.current_uid()) is not null and (
    exists (
      select 1 from public.rooms r
      where r.id = p_room and r.created_by = (select private.current_uid())
    ) or exists (
      select 1 from public.room_members m
      where m.room_id = p_room and m.user_id = (select private.current_uid())
    )
  );
$$;

create function private.room_is_owner(p_room uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select private.current_uid()) is not null and exists (
    select 1 from public.rooms r
    where r.id = p_room and r.created_by = (select private.current_uid())
  );
$$;

create function private.room_can_edit(p_room uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.room_is_owner(p_room) or exists (
    select 1 from public.room_members m
    where m.room_id = p_room
      and m.user_id = (select private.current_uid())
      and m.role = 'editor'
  );
$$;

create function private.community_can_read(p_community uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select private.current_uid()) is not null and (
    exists (
      select 1 from public.communities c
      where c.id = p_community and c.created_by = (select private.current_uid())
    ) or exists (
      select 1 from public.rooms r
      where r.community_id = p_community and (
        r.created_by = (select private.current_uid()) or exists (
          select 1 from public.room_members m
          where m.room_id = r.id and m.user_id = (select private.current_uid())
        )
      )
    )
  );
$$;

revoke all on function private.room_can_read(uuid) from public;
revoke all on function private.room_is_owner(uuid) from public;
revoke all on function private.room_can_edit(uuid) from public;
revoke all on function private.community_can_read(uuid) from public;
grant execute on function private.room_can_read(uuid) to authenticated;
grant execute on function private.room_is_owner(uuid) to authenticated;
grant execute on function private.room_can_edit(uuid) to authenticated;
grant execute on function private.community_can_read(uuid) to authenticated;

alter table public.communities enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.tasks enable row level security;
alter table public.activity enable row level security;

create policy "community visible to participating people"
on public.communities for select to authenticated
using (private.community_can_read(id));

create policy "authenticated people may found a community"
on public.communities for insert to authenticated
with check (created_by = (select private.current_uid()));

create policy "room visible to its participants"
on public.rooms for select to authenticated
using (private.room_can_read(id));

create policy "community founder creates its rooms"
on public.rooms for insert to authenticated
with check (
  created_by = (select private.current_uid())
  and exists (
    select 1 from public.communities c
    where c.id = community_id and c.created_by = (select private.current_uid())
  )
);

create policy "room membership visible within room"
on public.room_members for select to authenticated
using (private.room_can_read(room_id));

create policy "only room owner adds collaborators"
on public.room_members for insert to authenticated
with check (
  private.room_is_owner(room_id)
  and user_id <> (select private.current_uid())
);

create policy "only room owner changes collaborators"
on public.room_members for update to authenticated
using (private.room_is_owner(room_id))
with check (private.room_is_owner(room_id));

create policy "owner can revoke and member can leave"
on public.room_members for delete to authenticated
using (private.room_is_owner(room_id) or user_id = (select private.current_uid()));

create policy "room participants read tasks"
on public.tasks for select to authenticated
using (private.room_can_read(room_id));

create policy "room editors create tasks"
on public.tasks for insert to authenticated
with check (
  created_by = (select private.current_uid())
  and private.room_can_edit(room_id)
);

create policy "room editors change tasks"
on public.tasks for update to authenticated
using (private.room_can_edit(room_id))
with check (private.room_can_edit(room_id));

create policy "room participants read activity"
on public.activity for select to authenticated
using (private.room_can_read(room_id));

create function private.protect_task_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.room_id is distinct from old.room_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'task room, author and created_at are immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function private.log_task_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity(room_id, task_id, actor_id, action, details)
    values (
      new.room_id, new.id, (select private.current_uid()),
      'task_created', jsonb_build_object('title', new.title, 'status', new.status)
    );
  elsif new.title is distinct from old.title
     or new.details is distinct from old.details
     or new.status is distinct from old.status then
    insert into public.activity(room_id, task_id, actor_id, action, details)
    values (
      new.room_id, new.id, (select private.current_uid()),
      'task_updated', jsonb_build_object(
        'title', new.title, 'previous_status', old.status, 'status', new.status
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function private.protect_task_update() from public;
revoke all on function private.log_task_change() from public;

create trigger protect_task_update before update on public.tasks
for each row execute function private.protect_task_update();

create trigger record_task_change after insert or update on public.tasks
for each row execute function private.log_task_change();

-- Data API privileges are separate from row-level policies.
revoke all on public.communities, public.rooms, public.room_members,
  public.tasks, public.activity from anonymous;
revoke all on public.communities, public.rooms, public.room_members,
  public.tasks, public.activity from authenticated;

grant select, insert on public.communities to authenticated;
grant select, insert on public.rooms to authenticated;
grant select, insert, update, delete on public.room_members to authenticated;
grant select, insert, update on public.tasks to authenticated;
grant select on public.activity to authenticated;

-- Intentionally no client UPDATE/DELETE of communities, rooms, tasks (delete),
-- or historical activity events. The radio federation gets separate gates.

-- Neon Data API grants use 'authenticated' and 'anonymous', not Supabase 'anon'.
