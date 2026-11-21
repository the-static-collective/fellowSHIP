-- Commons 005: reliable authenticated room creation.
-- Scope: isolated Neon fellowSHIP database only.
-- This RPC owns the insert-and-return transaction so the browser never
-- depends on a PostgREST INSERT ... RETURNING representation.
-- SECURITY DEFINER deliberately bypasses table RLS only AFTER explicit
-- identity and community-owner checks; user IDs are never client supplied.

create function public.create_fellowship_room(p_community uuid, p_name text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  actor uuid := private.current_uid();
  cleaned text := pg_catalog.btrim(p_name);
  created uuid;
begin
  if actor is null then
    raise exception 'Sign in to create a project room';
  end if;
  if p_community is null or not exists (
    select 1 from public.communities c
    where c.id = p_community and c.created_by = actor
  ) then
    raise exception 'Only the community founder can create its rooms';
  end if;
  if cleaned is null or pg_catalog.char_length(cleaned) < 2
     or pg_catalog.char_length(cleaned) > 100 then
    raise exception 'Room name must contain 2 to 100 characters';
  end if;

  if exists (
    select 1 from public.rooms r
    where r.community_id = p_community
      and pg_catalog.lower(pg_catalog.btrim(r.name)) = pg_catalog.lower(cleaned)
  ) then
    raise exception 'A room with that name already exists in this community';
  end if;

  insert into public.rooms (community_id, name, created_by)
  values (p_community, cleaned, actor)
  returning id into created;

  return created;
end;
$$;

-- As with other public RPC functions, authenticated alone does not confer
-- permission: each call rechecks the signed-in user's ownership.
revoke all on function public.create_fellowship_room(uuid,text) from public, anonymous;
grant execute on function public.create_fellowship_room(uuid,text) to authenticated;
