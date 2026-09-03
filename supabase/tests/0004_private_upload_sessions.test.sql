begin;
select extensions.plan(11);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from (values
  ('40000000-0000-4000-8000-000000000001'::uuid, 'upload-owner@example.test'),
  ('40000000-0000-4000-8000-000000000002'::uuid, 'upload-editor@example.test'),
  ('40000000-0000-4000-8000-000000000003'::uuid, 'upload-viewer@example.test'),
  ('40000000-0000-4000-8000-000000000004'::uuid, 'other-owner@example.test')
) as fixture(id, email);
insert into public.workspaces (id, kind, name, slug, owner_user_id, created_by) values
  ('41000000-0000-4000-8000-000000000001', 'team', 'Upload Team', 'upload-team', '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
  ('41000000-0000-4000-8000-000000000002', 'team', 'Other Team', 'other-upload-team', '40000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004');
insert into public.memberships (workspace_id, user_id, role, status, joined_at) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'owner', 'active', now()),
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'editor', 'active', now()),
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'viewer', 'active', now()),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004', 'owner', 'active', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select extensions.throws_ok(
  $$select * from public.create_upload_batch('41000000-0000-4000-8000-000000000001', '[{"name":"readme.txt","size":12,"declaredMime":"text/plain"}]', gen_random_uuid())$$,
  '42501', null, 'viewer cannot create upload sessions'
);

select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
create temporary table created_upload as
select * from public.create_upload_batch(
  '41000000-0000-4000-8000-000000000001',
  '[{"name":"readme.txt","size":12,"declaredMime":"text/plain"}]',
  '42000000-0000-4000-8000-000000000001'
);
select extensions.is((select count(*)::integer from created_upload), 1, 'editor creates one session');
select extensions.alike((select object_path from created_upload), 'quarantine/41000000-0000-4000-8000-000000000001/%', 'path is fixed inside the workspace prefix');
select extensions.is((select count(*)::integer from public.documents where workspace_id = '41000000-0000-4000-8000-000000000001'), 1, 'document is pre-created');
select extensions.is((select count(*)::integer from public.document_revisions where workspace_id = '41000000-0000-4000-8000-000000000001' and state = 'UPLOADING'), 1, 'immutable revision is pre-created');
select extensions.is((select count(*)::integer from storage.objects where bucket_id = 'originals'), 0, 'authenticated users cannot list private originals');
select extensions.throws_ok(
  $$select * from public.create_upload_batch('41000000-0000-4000-8000-000000000002', '[{"name":"readme.txt","size":12,"declaredMime":"text/plain"}]', gen_random_uuid())$$,
  '42501', null, 'editor cannot target another workspace'
);
select extensions.throws_ok(
  $$select * from public.create_upload_batch('41000000-0000-4000-8000-000000000001',
    (select jsonb_agg(jsonb_build_object('name', 'f-' || n || '.txt', 'size', 1, 'declaredMime', 'text/plain')) from generate_series(1, 21) n), gen_random_uuid())$$,
  '22023', null, 'database rejects batches over twenty'
);

reset role;
insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'originals', object_path, '40000000-0000-4000-8000-000000000002', '{"size":12,"mimetype":"text/plain"}'::jsonb from created_upload;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select * from public.complete_upload_session((select session_id from created_upload), '42000000-0000-4000-8000-000000000002');
select extensions.is((select state::text from public.document_revisions where id = (select revision_id from created_upload)), 'QUEUED', 'verified upload advances to queued');
select extensions.is((select count(*)::integer from public.upload_sessions where state = 'completed'), 1, 'session is single-use completed');

-- Audit rows are only readable by a member manager, so this reads as the owner.
-- Asserting it as the uploading editor would always see zero, whether or not
-- the row was ever written.
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select extensions.is((select count(*)::integer from public.audit_events where action = 'file.upload_completed' and workspace_id = '41000000-0000-4000-8000-000000000001'), 1, 'completion is audited');

select * from extensions.finish();
rollback;
