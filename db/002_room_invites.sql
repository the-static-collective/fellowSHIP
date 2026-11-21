-- fellowSHIP Commons 002 — additive secure room invites.
-- Apply only to isolated Neon fellowSHIP database after Commons 001.
-- Never store the raw bearer token; tokens expire after 48 hours and are single-use.

create extension if not exists pgcrypto;

create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  token_sha256 bytea not null unique,
  role text not null check (role in ('viewer','editor')),
  target_email text,
  invited_by uuid not null references neon_auth."user"(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  redeemed_at timestamptz,
  redeemed_by uuid references neon_auth."user"(id),
  revoked_at timestamptz,
  constraint invite_email_valid check (
    target_email is null or
    (length(target_email) <= 254 and
      target_email = lower(btrim(target_email)) and
      target_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
  ),
  constraint invite_redemption_consistent check (
    (redeemed_at is null and redeemed_by is null) or
    (redeemed_at is not null and redeemed_by is not null)
  )
);
create index room_invites_room_active on public.room_invites(room_id, expires_at desc);

alter table public.room_invites enable row level security;
-- Never allow browser clients direct read/write, even on their own invitations.
revoke all on public.room_invites from public, anonymous, authenticated;

-- Only a room owner can issue an invite. Raw token is returned once and never persisted.
create function public.issue_room_invite(p_room uuid, p_role text, p_target_email text default null)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := private.current_uid();
  token text;
  intended text := nullif(lower(btrim(p_target_email)), '');
begin
  if me is null or not private.room_is_owner(p_room) then
    raise exception 'Not authorized to invite people to this room';
  end if;
  if p_role not in ('viewer','editor') or p_role is null then
    raise exception 'Invalid room role';
  end if;
  if intended is not null and
     (length(intended) > 254 or
      intended !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then
    raise exception 'Invalid recipient email';
  end if;
  if (select count(*) from public.room_invites i
      where i.room_id = p_room and i.redeemed_at is null
        and i.revoked_at is null and i.expires_at > now()) >= 20 then
    raise exception 'Too many open invitations; revoke or allow some to expire';
  end if;
  token := pg_catalog.encode(public.gen_random_bytes(32), 'hex');
  insert into public.room_invites
    (room_id, token_sha256, role, target_email, invited_by)
  values (p_room, public.digest(token,'sha256'), p_role, intended, me);
  return token;
end;
$$;

-- Single atomic claim: a forwarded link is not an invitation to browse.
-- Optional target_email binds the bearer link to the actual signed-in person.
create function public.redeem_room_invite(p_token text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := private.current_uid();
  claimed record;
begin
  if me is null then
    raise exception 'Sign in before accepting the invitation';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid or expired invitation';
  end if;

  update public.room_invites i
  set redeemed_by = me, redeemed_at = now()
  where i.token_sha256 = public.digest(p_token, 'sha256')
    and i.redeemed_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and not private.room_is_owner(i.room_id)
    and (i.target_email is null or i.target_email =
      (select lower(u.email) from neon_auth."user" u where u.id = me))
  returning i.room_id, i.role into claimed;

  if not found then
    raise exception 'Invalid or expired invitation, or wrong recipient';
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (claimed.room_id, me, claimed.role)
  on conflict (room_id, user_id) do update
    set role = case
      when public.room_members.role = 'editor' then 'editor'
      else excluded.role end;
  return claimed.room_id;
end;
$$;

create function public.list_room_invites(p_room uuid)
returns table(
  invite_id uuid, invite_role text, recipient_email text,
  created_at timestamptz, expires_at timestamptz,
  redeemed_at timestamptz, revoked_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.current_uid() is null or not private.room_is_owner(p_room) then
    raise exception 'Not authorized to view invitations';
  end if;
  return query
    select i.id, i.role, i.target_email, i.created_at, i.expires_at,
      i.redeemed_at, i.revoked_at
    from public.room_invites i
    where i.room_id = p_room
      and i.created_at > now() - interval '7 days'
    order by i.created_at desc
    limit 50;
end;
$$;

create function public.revoke_room_invite(p_invite uuid)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if private.current_uid() is null then
    raise exception 'Sign in to revoke an invitation';
  end if;
  update public.room_invites i set revoked_at = now()
  where i.id = p_invite and i.redeemed_at is null and i.revoked_at is null
    and private.room_is_owner(i.room_id);
  return found;
end;
$$;

-- Functions in public are callable only by authenticated accounts,
-- and each definer function still enforces a scoped authorization check.
revoke all on function public.issue_room_invite(uuid,text,text) from public, anonymous;
revoke all on function public.redeem_room_invite(text) from public, anonymous;
revoke all on function public.list_room_invites(uuid) from public, anonymous;
revoke all on function public.revoke_room_invite(uuid) from public, anonymous;
grant execute on function public.issue_room_invite(uuid,text,text) to authenticated;
grant execute on function public.redeem_room_invite(text) to authenticated;
grant execute on function public.list_room_invites(uuid) to authenticated;
grant execute on function public.revoke_room_invite(uuid) to authenticated;
