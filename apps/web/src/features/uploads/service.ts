import type { SupabaseClient } from '@supabase/supabase-js';

import {
  UploadSessionSchema,
  parseUploadBatch,
  type CreateUploadSessionsInput,
  type Database,
  type UploadSession,
} from '@knowledge/domain';

import { requireWorkspaceCapability } from '@/lib/workspaces/access';

export type UploadSigner = { sign(objectPath: string): Promise<{ token: string }> };

/**
 * The browser proposes file names, sizes and types. It never proposes a
 * destination: the database mints every object path, and only those paths are
 * ever signed. If signing fails, the sessions are aborted so no half-authorised
 * path is left redeemable.
 */
export async function createUploadSessions(
  client: SupabaseClient<Database>,
  signer: UploadSigner,
  rawInput: CreateUploadSessionsInput,
  requestId: string
): Promise<UploadSession[]> {
  const input = parseUploadBatch(rawInput);
  await requireWorkspaceCapability(client, input.workspaceId, 'documents.upload');
  const { data, error } = await client.rpc('create_upload_batch', {
    target_workspace_id: input.workspaceId,
    input_files: input.files,
    correlation_id: requestId,
  });
  if (error || !data) throw new Error('无法创建上传会话');

  try {
    return await Promise.all(
      data.map(async (row) =>
        UploadSessionSchema.parse({
          id: row.session_id,
          workspaceId: row.workspace_id,
          documentId: row.document_id,
          revisionId: row.revision_id,
          objectPath: row.object_path,
          uploadToken: (await signer.sign(row.object_path)).token,
          expiresAt: row.expires_at,
        })
      )
    );
  } catch (cause) {
    await client.rpc('abort_upload_sessions', {
      target_session_ids: data.map((row) => row.session_id),
      correlation_id: requestId,
    });
    throw new Error('无法签发上传授权', { cause });
  }
}

export async function completeUploadSession(
  client: SupabaseClient<Database>,
  sessionId: string,
  requestId: string
) {
  const { data, error } = await client.rpc('complete_upload_session', {
    target_session_id: sessionId,
    correlation_id: requestId,
  });
  const row = data?.[0];
  if (error || !row) throw new Error('上传对象校验失败');
  return { documentId: row.document_id, revisionId: row.revision_id, status: 'QUEUED' as const };
}
