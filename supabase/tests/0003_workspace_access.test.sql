begin;
select extensions.plan(17);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from (values
  ('20000000-0000-4000-8000-000000000001'::uuid, 'owner@example.test'),
  ('20000000-0000-4000-8000-000000000002'::uuid, 'admin@example.test'),
  ('20000000-0000-4000-8000-000000000003'::uuid, 'editor@example.test'),
  ('20000000-0000-4000-8000-000000000004'::uuid, 'viewer@example.test'),
  ('20000000-0000-4000-8000-000000000005'::uuid, 'outsider@example.test')
) as fixture(id, email);

insert into public.workspaces (id, kind, name, slug, owner_user_id, created_by) values
  ('21000000-0000-4000-8000-000000000001', 'team', 'Team One', 'team-one', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('21000000-0000-4000-8000-000000000002', 'team', 'Team Two', 'team-two', '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005');
insert into public.memberships (workspace_id, user_id, role, status, joined_at) values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'owner', 'active', now()),
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'admin', 'active', now()),
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'editor', 'active', now()),
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'viewer', 'active', now()),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005', 'owner', 'active', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select extensions.is((select count(*)::integer from public.workspaces where id = '21000000-0000-4000-8000-000000000001'), 1, 'viewer sees own team');
select extensions.is((select count(*)::integer from public.workspaces where id = '21000000-0000-4000-8000-000000000002'), 0, 'viewer cannot see another team');
select extensions.ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'documents.read'), 'viewer can read');
select extensions.ok(not public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'documents.upload'), 'viewer cannot upload');
select extensions.throws_ok(
  $$select * from public.assert_workspace_capability('21000000-0000-4000-8000-000000000001', 'documents.upload')$$,
  '42501', null, 'viewer upload is rejected by the database'
);

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select extensions.ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'documents.upload'), 'editor can upload');
select extensions.ok(not public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'documents.delete'), 'editor cannot permanently delete');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select extensions.ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'members.manage_basic'), 'admin manages basic roles');
select extensions.ok(not public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'members.manage_admin'), 'admin cannot manage admins');
select extensions.throws_ok(
  $$select public.change_member_role('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'editor', gen_random_uuid())$$,
  '42501', null, 'admin cannot change their own role'
);

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select extensions.ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'members.manage_admin'), 'owner manages admins');
select extensions.ok(public.has_workspace_capability('21000000-0000-4000-8000-000000000001', 'workspace.delete'), 'owner can delete workspace');
select extensions.throws_ok(
  $$select public.remove_member('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', gen_random_uuid())$$,
  '23514', null, 'owner cannot remove the last owner'
);

select public.remove_member('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', gen_random_uuid());
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select extensions.is((select count(*)::integer from public.workspaces where id = '21000000-0000-4000-8000-000000000001'), 0, 'removed member loses access on the next query');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select * from public.create_invitation('21000000-0000-4000-8000-000000000001', 'new@example.test', 'owner', gen_random_uuid())$$,
  '23514', null, 'owner role cannot be invited'
);
select extensions.is(
  (select count(*)::integer from public.audit_events where workspace_id = '21000000-0000-4000-8000-000000000001' and action = 'member.removed'),
  1,
  'member removal is audited'
);
select public.set_last_workspace('21000000-0000-4000-8000-000000000001');
select extensions.is(public.resolve_entry_workspace(), '21000000-0000-4000-8000-000000000001'::uuid, 'entry resolver returns the last accessible workspace');

select * from extensions.finish();
rollback;
