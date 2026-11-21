-- fellowSHIP Commons 002b — durable per-person room check-ins.
-- A "catch me up" cursor belongs to each person, not a device.

create table public.room_checkins (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references neon_auth."user"(id),
  seen_at timestamptz not null default now(),
  primary key(room_id,user_id)
);

create function private.protect_room_checkin()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and
    (new.room_id is distinct from old.room_id
      or new.user_id is distinct from old.user_id) then
    raise exception 'Cannot reassign a room check-in';
  end if;
  new.seen_at = now();
  return new;
end;
$$;

revoke all on function private.protect_room_checkin() from public;
create trigger protect_room_checkin
before insert or update on public.room_checkins
for each row execute function private.protect_room_checkin();

alter table public.room_checkins enable row level security;

create policy "read only my room checkins"
on public.room_checkins for select to authenticated
using (
  user_id = (select private.current_uid())
  and private.room_can_read(room_id)
);

create policy "insert my room checkins"
on public.room_checkins for insert to authenticated
with check (
  user_id = (select private.current_uid())
  and private.room_can_read(room_id)
);

create policy "update only my room checkins"
on public.room_checkins for update to authenticated
using (
  user_id = (select private.current_uid())
  and private.room_can_read(room_id)
)
with check (
  user_id = (select private.current_uid())
  and private.room_can_read(room_id)
);

revoke all on public.room_checkins from public, anonymous, authenticated;
grant select, insert, update on public.room_checkins to authenticated;
