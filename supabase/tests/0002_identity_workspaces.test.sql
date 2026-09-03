begin;
select extensions.plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'owner-a@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{"display_name":"Owner A"}', now(), now()
);

select extensions.is(
  (select count(*)::integer from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  1,
  'a profile is created for an auth user'
);
select extensions.is(
  (select count(*)::integer from public.workspaces where owner_user_id = '10000000-0000-4000-8000-000000000001' and kind = 'personal'),
  1,
  'a private personal workspace is created'
);
select extensions.is(
  (select count(*)::integer from public.memberships where user_id = '10000000-0000-4000-8000-000000000001' and role = 'owner' and status = 'active'),
  1,
  'the user is the sole active owner'
);
select extensions.ok(
  (select last_workspace_id is not null from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  'the personal workspace is the initial landing workspace'
);
select extensions.throws_ok(
  $$insert into public.memberships (workspace_id, user_id, role, status, joined_at)
    select id, '10000000-0000-4000-8000-000000000002', 'viewer', 'active', now()
    from public.workspaces where owner_user_id = '10000000-0000-4000-8000-000000000001'$$,
  '23503', null,
  'membership requires an existing auth user'
);
select extensions.is(
  (select count(*)::integer from public.audit_events where action = 'workspace.created'),
  1,
  'personal workspace creation is audited without content'
);
select extensions.ok(
  (select bool_and(workspace_id is not null) from public.audit_events),
  'workspace business rows carry workspace_id'
);

-- The owner guards are deferred constraint triggers, so they never fire in a
-- test that ends in rollback. `set constraints all immediate` forces them.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000009',
  'authenticated', 'authenticated', 'second@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{"display_name":"Second"}', now(), now()
);

select extensions.throws_ok(
  $$insert into public.memberships (workspace_id, user_id, role, status, joined_at)
    select id, '10000000-0000-4000-8000-000000000009', 'owner', 'active', now()
    from public.workspaces where owner_user_id = '10000000-0000-4000-8000-000000000001'$$,
  '23505', null,
  'a workspace cannot hold a second active owner'
);
select extensions.throws_ok(
  $$delete from public.memberships
     where user_id = '10000000-0000-4000-8000-000000000001' and role = 'owner';
    set constraints all immediate$$,
  '23514', null,
  'the deferred owner guard rejects a workspace left without its owner'
);

select * from extensions.finish();
rollback;
