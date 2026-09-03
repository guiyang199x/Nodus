create type public.document_revision_state as enum (
  'UPLOADING', 'QUEUED', 'VALIDATING', 'EXTRACTING', 'CHUNKING',
  'ANALYZING', 'INDEXING', 'READY', 'RETRYING', 'FAILED', 'CANCELLED', 'SUPERSEDED'
);
create type public.upload_session_state as enum ('pending', 'completed', 'aborted', 'expired');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 255),
  uploaded_by uuid not null references public.profiles(id),
  status public.document_revision_state not null default 'UPLOADING',
  current_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  document_id uuid not null,
  version_number integer not null default 1 check (version_number > 0),
  original_name text not null check (char_length(original_name) between 1 and 255),
  declared_mime text not null,
  byte_size bigint not null check (byte_size between 1 and 52428800),
  object_bucket text not null default 'originals' check (object_bucket = 'originals'),
  object_path text not null unique,
  state public.document_revision_state not null default 'UPLOADING',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, document_id, id),
  unique (workspace_id, document_id, version_number),
  foreign key (workspace_id, document_id) references public.documents(workspace_id, id) on delete cascade
);

alter table public.documents add constraint documents_current_revision_fk
  foreign key (workspace_id, id, current_revision_id)
  references public.document_revisions(workspace_id, document_id, id) deferrable initially deferred;

create table public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  document_id uuid not null,
  revision_id uuid not null,
  created_by uuid not null references public.profiles(id),
  object_bucket text not null default 'originals' check (object_bucket = 'originals'),
  object_path text not null unique,
  expected_size bigint not null check (expected_size between 1 and 52428800),
  expected_mime text not null,
  state public.upload_session_state not null default 'pending',
  expires_at timestamptz not null default now() + interval '2 hours',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, document_id) references public.documents(workspace_id, id) on delete cascade,
  foreign key (workspace_id, revision_id) references public.document_revisions(workspace_id, id) on delete cascade,
  foreign key (workspace_id, document_id, revision_id)
    references public.document_revisions(workspace_id, document_id, id) on delete cascade,
  check ((state = 'completed' and completed_at is not null) or (state <> 'completed' and completed_at is null))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('originals', 'originals', false, 52428800, array[
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown', 'text/plain'
]) on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.create_upload_batch(
  target_workspace_id uuid, input_files jsonb, correlation_id uuid
) returns table (
  session_id uuid, workspace_id uuid, document_id uuid, revision_id uuid,
  object_path text, expires_at timestamptz
) language plpgsql security definer set search_path = '' as $$
declare item jsonb; doc_id uuid; rev_id uuid; sess_id uuid; suffix text; fixed_path text; expiration timestamptz;
begin
  perform * from public.assert_workspace_capability(target_workspace_id, 'documents.upload');
  if jsonb_typeof(input_files) <> 'array' or jsonb_array_length(input_files) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'upload batch must contain one to twenty files';
  end if;
  for item in select value from jsonb_array_elements(input_files) loop
    if (item->>'size')::bigint not between 1 and 52428800 then
      raise exception using errcode = '22023', message = 'file size exceeds limit';
    end if;
    suffix := lower(substring(item->>'name' from '(\.[^.]+)$'));
    if not (
      (suffix in ('.jpg', '.jpeg') and item->>'declaredMime' = 'image/jpeg') or
      (suffix = '.png' and item->>'declaredMime' = 'image/png') or
      (suffix = '.webp' and item->>'declaredMime' = 'image/webp') or
      (suffix = '.pdf' and item->>'declaredMime' = 'application/pdf') or
      (suffix = '.docx' and item->>'declaredMime' = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') or
      (suffix = '.md' and item->>'declaredMime' in ('text/markdown', 'text/plain')) or
      (suffix = '.txt' and item->>'declaredMime' = 'text/plain')
    ) then raise exception using errcode = '22023', message = 'unsupported extension and MIME pair'; end if;

    doc_id := gen_random_uuid(); rev_id := gen_random_uuid(); sess_id := gen_random_uuid(); expiration := now() + interval '2 hours';
    -- The object path is generated here and nowhere else. A caller never
    -- supplies it, so it can never be used to reach another workspace.
    fixed_path := format('quarantine/%s/%s/%s/%s%s', target_workspace_id, doc_id, rev_id, gen_random_uuid(), suffix);
    insert into public.documents (id, workspace_id, title, uploaded_by)
    values (doc_id, target_workspace_id, regexp_replace(item->>'name', '\.[^.]+$', ''), auth.uid());
    insert into public.document_revisions (
      id, workspace_id, document_id, original_name, declared_mime, byte_size, object_path, created_by
    ) values (
      rev_id, target_workspace_id, doc_id, item->>'name', item->>'declaredMime', (item->>'size')::bigint, fixed_path, auth.uid()
    );
    insert into public.upload_sessions (
      id, workspace_id, document_id, revision_id, created_by, object_path, expected_size, expected_mime, expires_at
    ) values (
      sess_id, target_workspace_id, doc_id, rev_id, auth.uid(), fixed_path, (item->>'size')::bigint, item->>'declaredMime', expiration
    );
    perform private.write_audit(target_workspace_id, 'document', doc_id, 'file.upload_authorized', 'succeeded', correlation_id,
                                jsonb_build_object('revision_id', rev_id, 'byte_size', (item->>'size')::bigint));
    session_id := sess_id; workspace_id := target_workspace_id; document_id := doc_id;
    revision_id := rev_id; object_path := fixed_path; expires_at := expiration; return next;
  end loop;
end;
$$;

create or replace function public.complete_upload_session(target_session_id uuid, correlation_id uuid)
returns table (document_id uuid, revision_id uuid, status public.document_revision_state)
language plpgsql security definer set search_path = '' as $$
declare session_record public.upload_sessions%rowtype; stored_size bigint; stored_mime text;
begin
  select * into session_record from public.upload_sessions where id = target_session_id for update;
  if session_record.id is null or session_record.created_by <> auth.uid() then
    raise exception using errcode = '42501', message = 'upload session unavailable';
  end if;
  perform * from public.assert_workspace_capability(session_record.workspace_id, 'documents.upload');
  if session_record.state <> 'pending' or session_record.expires_at <= now() then
    raise exception using errcode = '23514', message = 'upload session is not active';
  end if;
  -- The stored object must match what the session authorised, so a signed
  -- token cannot be used to park a different file at the path.
  select (metadata->>'size')::bigint, metadata->>'mimetype' into stored_size, stored_mime
    from storage.objects where bucket_id = session_record.object_bucket and name = session_record.object_path;
  if stored_size is null or stored_size <> session_record.expected_size or stored_mime <> session_record.expected_mime then
    raise exception using errcode = '23514', message = 'uploaded object metadata does not match session';
  end if;
  update public.upload_sessions set state = 'completed', completed_at = now() where id = target_session_id;
  update public.document_revisions set state = 'QUEUED' where workspace_id = session_record.workspace_id and id = session_record.revision_id;
  update public.documents set status = 'QUEUED', updated_at = now() where workspace_id = session_record.workspace_id and id = session_record.document_id;
  perform private.write_audit(session_record.workspace_id, 'document', session_record.document_id, 'file.upload_completed', 'succeeded', correlation_id,
                              jsonb_build_object('revision_id', session_record.revision_id));
  document_id := session_record.document_id; revision_id := session_record.revision_id; status := 'QUEUED'; return next;
end;
$$;

create or replace function public.abort_upload_sessions(target_session_ids uuid[], correlation_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  update public.upload_sessions set state = 'aborted'
   where id = any(target_session_ids) and created_by = auth.uid() and state = 'pending';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

alter table public.documents enable row level security;
alter table public.document_revisions enable row level security;
alter table public.upload_sessions enable row level security;
create policy documents_read_workspace on public.documents for select to authenticated
  using (public.has_workspace_capability(workspace_id, 'documents.read'));
create policy revisions_read_workspace on public.document_revisions for select to authenticated
  using (public.has_workspace_capability(workspace_id, 'documents.read'));
create policy upload_sessions_read_creator on public.upload_sessions for select to authenticated
  using (created_by = auth.uid() and public.has_workspace_capability(workspace_id, 'documents.upload'));
revoke all on public.documents, public.document_revisions, public.upload_sessions from anon, authenticated;
grant select on public.documents, public.document_revisions, public.upload_sessions to authenticated;
grant execute on function public.create_upload_batch(uuid, jsonb, uuid) to authenticated;
grant execute on function public.complete_upload_session(uuid, uuid) to authenticated;
grant execute on function public.abort_upload_sessions(uuid[], uuid) to authenticated;
