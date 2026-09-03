create type public.app_capability as enum (
  'documents.read', 'documents.upload', 'documents.trash', 'documents.delete',
  'jobs.reprocess', 'knowledge.write', 'comments.write', 'qa.publish',
  'members.manage_basic', 'members.manage_admin', 'workspace.delete'
);

create or replace function private.workspace_role_for(target_workspace_id uuid, target_user_id uuid)
returns public.workspace_role language sql stable security definer set search_path = '' as $$
  select m.role from public.memberships m
  join public.workspaces w on w.id = m.workspace_id and w.state = 'ACTIVE'
   where m.workspace_id = target_workspace_id and m.user_id = target_user_id and m.status = 'active'
$$;

create or replace function private.is_workspace_member(target_workspace_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.workspace_role_for(target_workspace_id, target_user_id) is not null
$$;

create or replace function private.shares_workspace(left_user_id uuid, right_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships a join public.memberships b using (workspace_id)
     where a.user_id = left_user_id and b.user_id = right_user_id
       and a.status = 'active' and b.status = 'active'
  )
$$;

create or replace function public.has_workspace_capability(
  target_workspace_id uuid,
  requested_capability public.app_capability
) returns boolean language sql stable security definer set search_path = '' as $$
  select case private.workspace_role_for(target_workspace_id, auth.uid())
    when 'owner' then true
    when 'admin' then requested_capability = any(array[
      'documents.read', 'documents.upload', 'documents.trash', 'documents.delete',
      'jobs.reprocess', 'knowledge.write', 'comments.write', 'qa.publish',
      'members.manage_basic'
    ]::public.app_capability[])
    when 'editor' then requested_capability = any(array[
      'documents.read', 'documents.upload', 'documents.trash',
      'knowledge.write', 'comments.write', 'qa.publish'
    ]::public.app_capability[])
    when 'viewer' then requested_capability = 'documents.read'
    else false
  end
$$;

create or replace function public.assert_workspace_capability(
  target_workspace_id uuid,
  requested_capability public.app_capability
) returns table (workspace_id uuid, user_id uuid, role public.workspace_role, kind public.workspace_kind)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_workspace_capability(target_workspace_id, requested_capability) then
    raise exception using errcode = '42501', message = 'workspace capability denied';
  end if;
  return query
    select w.id, auth.uid(), private.workspace_role_for(w.id, auth.uid()), w.kind
      from public.workspaces w
     where w.id = target_workspace_id and w.state = 'ACTIVE';
  if not found then raise exception using errcode = '42501', message = 'workspace unavailable'; end if;
end;
$$;

create or replace function private.write_audit(
  target_workspace_id uuid, target_kind text, target_uuid uuid,
  event_action text, event_result text, correlation_id uuid, event_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events (
    workspace_id, actor_user_id, actor_kind, initiator_user_id,
    target_type, target_id, action, result, request_id, metadata
  ) values (
    target_workspace_id, auth.uid(), 'user', auth.uid(),
    target_kind, target_uuid, event_action, event_result, correlation_id, event_metadata
  );
end;
$$;

create or replace function public.resolve_entry_workspace()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare resolved uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select p.last_workspace_id into resolved
    from public.profiles p join public.workspaces w on w.id = p.last_workspace_id
   where p.id = auth.uid() and w.state = 'ACTIVE'
     and private.is_workspace_member(w.id, auth.uid());
  if resolved is null then
    select w.id into resolved from public.workspaces w
     where w.kind = 'personal' and w.owner_user_id = auth.uid() and w.state = 'ACTIVE';
  end if;
  return resolved;
end;
$$;

create or replace function public.set_last_workspace(target_workspace_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform * from public.assert_workspace_capability(target_workspace_id, 'documents.read');
  update public.profiles set last_workspace_id = target_workspace_id, updated_at = now() where id = auth.uid();
end;
$$;

create or replace function public.create_team_workspace(
  workspace_name text, workspace_slug text, correlation_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare created_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  if char_length(trim(workspace_name)) not between 1 and 80
     or lower(workspace_slug) !~ '^[a-z0-9][a-z0-9-]{2,62}$' then
    raise exception using errcode = '22023', message = 'invalid workspace name or slug';
  end if;
  insert into public.workspaces (id, kind, name, slug, owner_user_id, created_by)
  values (created_id, 'team', trim(workspace_name), lower(workspace_slug), auth.uid(), auth.uid());
  insert into public.memberships (workspace_id, user_id, role, status, joined_at)
  values (created_id, auth.uid(), 'owner', 'active', now());
  update public.profiles set last_workspace_id = created_id, updated_at = now() where id = auth.uid();
  perform private.write_audit(created_id, 'workspace', created_id, 'workspace.created', 'succeeded', correlation_id);
  return created_id;
end;
$$;

create or replace function public.create_invitation(
  target_workspace_id uuid, target_email text, target_role public.workspace_role, correlation_id uuid
) returns table (invitation_id uuid, raw_token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare caller_role public.workspace_role; generated_token text := encode(extensions.gen_random_bytes(32), 'hex'); created_id uuid;
begin
  select role into caller_role from public.assert_workspace_capability(
    target_workspace_id,
    case when target_role = 'admin' then 'members.manage_admin'::public.app_capability else 'members.manage_basic'::public.app_capability end
  );
  if (select kind from public.workspaces where id = target_workspace_id) <> 'team' or target_role = 'owner' then
    raise exception using errcode = '23514', message = 'invitation role or workspace is invalid';
  end if;
  insert into public.invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
  values (target_workspace_id, lower(trim(target_email)), target_role,
          extensions.digest(convert_to(generated_token, 'utf8'), 'sha256'), auth.uid(), now() + interval '7 days')
  returning id, invitations.expires_at into created_id, expires_at;
  perform private.write_audit(target_workspace_id, 'invitation', created_id, 'invitation.created', 'succeeded', correlation_id,
                              jsonb_build_object('role', target_role));
  invitation_id := created_id; raw_token := generated_token; return next;
end;
$$;

create or replace function public.accept_invitation(raw_token text, correlation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invite public.invitations%rowtype; account_email text;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select * into invite from public.invitations
   where token_hash = extensions.digest(convert_to(raw_token, 'utf8'), 'sha256') for update;
  select lower(email) into account_email from auth.users where id = auth.uid();
  if invite.id is null then raise exception using errcode = 'P0002', message = 'invitation not found'; end if;
  if invite.accepted_at is not null or invite.revoked_at is not null or invite.expires_at <= now() then
    raise exception using errcode = '23514', message = 'invitation is no longer valid';
  end if;
  if lower(invite.email::text) <> account_email then
    raise exception using errcode = '42501', message = 'invitation email does not match';
  end if;
  insert into public.memberships (workspace_id, user_id, role, status, joined_at)
  values (invite.workspace_id, auth.uid(), invite.role, 'active', now())
  on conflict (workspace_id, user_id) do update
    set role = excluded.role, status = 'active', joined_at = now(), removed_at = null, updated_at = now()
    where memberships.status = 'removed';
  if not found then raise exception using errcode = '23505', message = 'user is already a member'; end if;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = invite.id;
  update public.profiles set last_workspace_id = invite.workspace_id, updated_at = now() where id = auth.uid();
  perform private.write_audit(invite.workspace_id, 'invitation', invite.id, 'invitation.accepted', 'succeeded', correlation_id);
  return invite.workspace_id;
end;
$$;

create or replace function public.revoke_invitation(
  target_workspace_id uuid, target_invitation_id uuid, correlation_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare invite_role public.workspace_role;
begin
  select role into invite_role from public.invitations
   where workspace_id = target_workspace_id and id = target_invitation_id and accepted_at is null and revoked_at is null;
  if invite_role is null then raise exception using errcode = 'P0002', message = 'active invitation not found'; end if;
  perform * from public.assert_workspace_capability(
    target_workspace_id,
    case when invite_role = 'admin' then 'members.manage_admin'::public.app_capability else 'members.manage_basic'::public.app_capability end
  );
  update public.invitations set revoked_at = now() where workspace_id = target_workspace_id and id = target_invitation_id;
  perform private.write_audit(target_workspace_id, 'invitation', target_invitation_id, 'invitation.revoked', 'succeeded', correlation_id);
end;
$$;

create or replace function public.change_member_role(
  target_workspace_id uuid, target_user_id uuid, new_role public.workspace_role, correlation_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare caller_role public.workspace_role := private.workspace_role_for(target_workspace_id, auth.uid()); old_role public.workspace_role;
begin
  select role into old_role from public.memberships
   where workspace_id = target_workspace_id and user_id = target_user_id and status = 'active' for update;
  if old_role is null then raise exception using errcode = 'P0002', message = 'active member not found'; end if;
  if old_role = 'owner' or new_role = 'owner' then raise exception using errcode = '23514', message = 'use ownership transfer'; end if;
  if caller_role = 'admin' and (target_user_id = auth.uid() or old_role = 'admin' or new_role = 'admin') then
    raise exception using errcode = '42501', message = 'admin cannot modify this membership';
  end if;
  perform * from public.assert_workspace_capability(
    target_workspace_id,
    case when old_role = 'admin' or new_role = 'admin' then 'members.manage_admin'::public.app_capability else 'members.manage_basic'::public.app_capability end
  );
  update public.memberships set role = new_role, updated_at = now()
   where workspace_id = target_workspace_id and user_id = target_user_id;
  perform private.write_audit(target_workspace_id, 'membership', null, 'membership.role_changed', 'succeeded', correlation_id,
                              jsonb_build_object('user_id', target_user_id, 'from', old_role, 'to', new_role));
end;
$$;

create or replace function public.remove_member(
  target_workspace_id uuid, target_user_id uuid, correlation_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare caller_role public.workspace_role := private.workspace_role_for(target_workspace_id, auth.uid()); target_role public.workspace_role;
begin
  select role into target_role from public.memberships
   where workspace_id = target_workspace_id and user_id = target_user_id and status = 'active' for update;
  if target_role is null then raise exception using errcode = 'P0002', message = 'active member not found'; end if;
  if target_role = 'owner' then raise exception using errcode = '23514', message = 'last owner cannot be removed'; end if;
  if caller_role = 'admin' and (target_role = 'admin' or target_user_id = auth.uid()) then
    raise exception using errcode = '42501', message = 'admin cannot remove this member';
  end if;
  perform * from public.assert_workspace_capability(
    target_workspace_id,
    case when target_role = 'admin' then 'members.manage_admin'::public.app_capability else 'members.manage_basic'::public.app_capability end
  );
  update public.memberships set status = 'removed', removed_at = now(), updated_at = now()
   where workspace_id = target_workspace_id and user_id = target_user_id;
  perform private.write_audit(target_workspace_id, 'membership', null, 'member.removed', 'succeeded', correlation_id,
                              jsonb_build_object('user_id', target_user_id, 'role', target_role));
end;
$$;

create or replace function public.leave_workspace(target_workspace_id uuid, correlation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare own_role public.workspace_role := private.workspace_role_for(target_workspace_id, auth.uid());
begin
  if own_role is null then raise exception using errcode = 'P0002', message = 'active membership not found'; end if;
  if own_role = 'owner' then raise exception using errcode = '23514', message = 'owner must transfer or delete the workspace'; end if;
  update public.memberships set status = 'removed', removed_at = now(), updated_at = now()
   where workspace_id = target_workspace_id and user_id = auth.uid();
  perform private.write_audit(target_workspace_id, 'membership', null, 'member.left', 'succeeded', correlation_id);
end;
$$;

create or replace function public.transfer_workspace_ownership(
  target_workspace_id uuid, new_owner_user_id uuid, correlation_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform * from public.assert_workspace_capability(target_workspace_id, 'members.manage_admin');
  if (select kind from public.workspaces where id = target_workspace_id) <> 'team'
     or (select owner_user_id from public.workspaces where id = target_workspace_id) <> auth.uid() then
    raise exception using errcode = '42501', message = 'only the team owner can transfer ownership';
  end if;
  if not private.is_workspace_member(target_workspace_id, new_owner_user_id) then
    raise exception using errcode = 'P0002', message = 'new owner must be an active member';
  end if;
  update public.memberships set role = 'admin', updated_at = now()
   where workspace_id = target_workspace_id and user_id = auth.uid() and role = 'owner';
  update public.memberships set role = 'owner', updated_at = now()
   where workspace_id = target_workspace_id and user_id = new_owner_user_id and status = 'active';
  update public.workspaces set owner_user_id = new_owner_user_id, updated_at = now() where id = target_workspace_id;
  perform private.write_audit(target_workspace_id, 'workspace', target_workspace_id, 'workspace.ownership_transferred', 'succeeded', correlation_id,
                              jsonb_build_object('previous_owner', auth.uid(), 'new_owner', new_owner_user_id));
end;
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read_self_or_teammate on public.profiles for select to authenticated
using (id = auth.uid() or private.shares_workspace(id, auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());
create policy workspaces_read_member on public.workspaces for select to authenticated
using (state = 'ACTIVE' and private.is_workspace_member(id, auth.uid()));
create policy memberships_read_member on public.memberships for select to authenticated
using (private.is_workspace_member(workspace_id, auth.uid()));
create policy invitations_read_manager on public.invitations for select to authenticated
using (public.has_workspace_capability(
  workspace_id,
  case when role = 'admin' then 'members.manage_admin'::public.app_capability else 'members.manage_basic'::public.app_capability end
));
create policy audits_read_manager on public.audit_events for select to authenticated
using (public.has_workspace_capability(workspace_id, 'members.manage_basic'));

revoke all on public.profiles, public.workspaces, public.memberships, public.invitations, public.audit_events from anon, authenticated;
grant select on public.profiles, public.workspaces, public.memberships to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.invitations, public.audit_events to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;

-- RLS policy expressions are evaluated as the querying role, so the two helpers
-- named directly in a policy need EXECUTE even though the blanket revoke above
-- removed it. `usage` on schema private stays revoked, so `authenticated` still
-- cannot reach them by name through PostgREST.
grant execute on function private.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function private.shares_workspace(uuid, uuid) to authenticated;
revoke all on function public.has_workspace_capability(uuid, public.app_capability) from public, anon;
revoke all on function public.assert_workspace_capability(uuid, public.app_capability) from public, anon;
grant execute on function public.has_workspace_capability(uuid, public.app_capability) to authenticated;
grant execute on function public.assert_workspace_capability(uuid, public.app_capability) to authenticated;
grant execute on function public.resolve_entry_workspace() to authenticated;
grant execute on function public.set_last_workspace(uuid) to authenticated;
grant execute on function public.create_team_workspace(text, text, uuid) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.workspace_role, uuid) to authenticated;
grant execute on function public.accept_invitation(text, uuid) to authenticated;
grant execute on function public.revoke_invitation(uuid, uuid, uuid) to authenticated;
grant execute on function public.change_member_role(uuid, uuid, public.workspace_role, uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid, uuid) to authenticated;
grant execute on function public.leave_workspace(uuid, uuid) to authenticated;
grant execute on function public.transfer_workspace_ownership(uuid, uuid, uuid) to authenticated;
