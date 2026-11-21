-- Commons 006: server-side email invitation authorization / rate limiting.
-- Additive only. Run on isolated Neon fellowship database after Commons 002.
-- Never store plaintext link tokens, send secrets or untrusted email addresses.
alter table public.room_invites
  add column email_attempts integer not null default 0
    check (email_attempts between 0 and 3),
  add column last_email_attempt_at timestamptz;

-- Called by the isolated sender function with the *authenticated human's JWT*
-- forwarded through Neon Data API. The function must NOT trust a recipient
-- address in its JSON request; this returns the database-bound email only.
create function public.reserve_room_invite_email(p_token text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := private.current_uid();
  target record;
  recent integer;
begin
  if me is null then
    raise exception 'Sign in before requesting email delivery';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid invitation';
  end if;
  -- Validate the owner identity, the invitation and the destination in the DB.
  select i.id, i.room_id, i.role, i.target_email, i.email_attempts,
         i.last_email_attempt_at, r.name as room_name
    into target
  from public.room_invites i
  join public.rooms r on r.id = i.room_id
  join neon_auth."user" owner on owner.id = i.invited_by
  where i.token_sha256 = public.digest(p_token,'sha256')
    and i.invited_by = me
    and owner."emailVerified" is true
    and i.target_email is not null
    and i.revoked_at is null and i.redeemed_at is null
    and i.expires_at > now()
    and private.room_is_owner(i.room_id)
  for update of i;
  if not found then
    raise exception 'This invitation cannot be emailed; create a restricted invitation';
  end if;
  if target.email_attempts >= 3 or
    (target.last_email_attempt_at is not null
     and target.last_email_attempt_at > now() - interval '2 minutes') then
    raise exception 'Email limit reached. Use the prepared email draft instead';
  end if;
  select coalesce(sum(i.email_attempts), 0)::integer into recent
  from public.room_invites i
  where i.invited_by = me and i.last_email_attempt_at > now() - interval '1 hour';
  if recent >= 12 then
    raise exception 'Hourly invitation email limit reached';
  end if;

  update public.room_invites i
  set email_attempts = i.email_attempts + 1,
      last_email_attempt_at = now()
  where i.id = target.id;

  return jsonb_build_object(
    'invite_id', target.id,
    'recipient', target.target_email,
    'room_name', target.room_name,
    'role', target.role
  );
end;
$$;

revoke all on function public.reserve_room_invite_email(text) from public, anonymous;
grant execute on function public.reserve_room_invite_email(text) to authenticated;
