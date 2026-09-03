create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.workspace_kind as enum ('personal', 'team');
create type public.workspace_state as enum ('ACTIVE', 'DELETION_SCHEDULED', 'PURGING', 'PURGED');
create type public.membership_status as enum ('active', 'removed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  last_workspace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  kind public.workspace_kind not null,
  state public.workspace_state not null default 'ACTIVE',
  name text not null check (char_length(name) between 1 and 80),
  slug extensions.citext not null unique check (slug::text ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  owner_user_id uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, kind)
);

alter table public.profiles
  add constraint profiles_last_workspace_fk
  foreign key (last_workspace_id) references public.workspaces(id) on delete set null;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null,
  status public.membership_status not null default 'active',
  joined_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, user_id),
  check ((status = 'active' and joined_at is not null and removed_at is null)
      or (status = 'removed' and removed_at is not null))
);

create unique index memberships_one_active_owner
  on public.memberships(workspace_id)
  where role = 'owner' and status = 'active';

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email extensions.citext not null,
  role public.workspace_role not null check (role <> 'owner'),
  token_hash bytea not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (expires_at <= created_at + interval '7 days'),
  check (not (accepted_at is not null and revoked_at is not null))
);

create unique index invitations_one_open_per_email
  on public.invitations(workspace_id, email)
  where accepted_at is null and revoked_at is null;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_kind text not null check (actor_kind in ('user', 'system')),
  initiator_user_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id uuid,
  action text not null,
  result text not null check (result in ('succeeded', 'denied', 'failed')),
  request_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create or replace function private.assert_single_workspace_owner(target_workspace_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target public.workspaces%rowtype;
  active_count integer;
  owner_count integer;
  active_owner uuid;
begin
  select * into target from public.workspaces where id = target_workspace_id;
  if not found or target.state <> 'ACTIVE' then return; end if;

  select count(*), count(*) filter (where role = 'owner'),
         max(user_id) filter (where role = 'owner')
    into active_count, owner_count, active_owner
    from public.memberships
   where workspace_id = target_workspace_id and status = 'active';

  if owner_count <> 1 or active_owner <> target.owner_user_id then
    raise exception using errcode = '23514', message = 'workspace must have exactly one matching owner';
  end if;
  if target.kind = 'personal' and active_count <> 1 then
    raise exception using errcode = '23514', message = 'personal workspace must contain only its owner';
  end if;
end;
$$;

create or replace function private.check_owner_from_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.assert_single_workspace_owner(coalesce(new.id, old.id)); return null; end;
$$;

create or replace function private.check_owner_from_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.assert_single_workspace_owner(coalesce(new.workspace_id, old.workspace_id)); return null; end;
$$;

create constraint trigger workspace_owner_guard
after insert or update of owner_user_id, kind, state on public.workspaces
deferrable initially deferred for each row execute function private.check_owner_from_workspace();

create constraint trigger membership_owner_guard
after insert or update or delete on public.memberships
deferrable initially deferred for each row execute function private.check_owner_from_membership();

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare personal_workspace_id uuid := gen_random_uuid();
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), '新用户'));
  insert into public.workspaces (id, kind, name, slug, owner_user_id, created_by)
  values (personal_workspace_id, 'personal', '我的空间',
          'personal-' || replace(new.id::text, '-', ''), new.id, new.id);
  insert into public.memberships (workspace_id, user_id, role, status, joined_at)
  values (personal_workspace_id, new.id, 'owner', 'active', now());
  update public.profiles set last_workspace_id = personal_workspace_id where id = new.id;
  insert into public.audit_events (
    workspace_id, actor_user_id, actor_kind, initiator_user_id,
    target_type, target_id, action, result, request_id
  ) values (
    personal_workspace_id, new.id, 'system', new.id,
    'workspace', personal_workspace_id, 'workspace.created', 'succeeded', gen_random_uuid()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function private.handle_new_user();
