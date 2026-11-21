-- fellowSHIP Commons 004 — require verified email for email-bound invites.
-- Applies after db/002_room_invites.sql and Neon Auth email verification.
-- A registered email is not proof of mailbox ownership without emailVerified.

create or replace function public.redeem_room_invite(p_token text)
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
    and (
      i.target_email is null or
      exists (
        select 1 from neon_auth."user" u
        where u.id = me
          and lower(u.email) = i.target_email
          and u."emailVerified" is true
      )
    )
  returning i.room_id, i.role into claimed;

  if not found then
    raise exception 'Invalid, expired or restricted invitation; verify your email';
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

revoke all on function public.redeem_room_invite(text) from public, anonymous;
grant execute on function public.redeem_room_invite(text) to authenticated;
