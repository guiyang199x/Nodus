import { UploadSessionSchema, parseUploadBatch, type UploadSession } from '@knowledge/domain';

export type BrowserUploadGateway = {
  upload(session: UploadSession, file: File): Promise<void>;
};

export type UploadProgress = {
  fileName: string;
  state: 'authorizing' | 'uploading' | 'verifying' | 'queued' | 'failed';
  message?: string;
};

export type QueuedUpload = { documentId: string; revisionId: string; status: 'QUEUED' };

/**
 * The same batch limits the database enforces are applied here first, so an
 * obviously invalid batch never becomes a server round trip. The destination
 * always comes from the server response; nothing here invents a path.
 */
export async function performUploadBatch(input: {
  workspaceId: string;
  files: File[];
  gateway: BrowserUploadGateway;
  fetcher?: typeof fetch;
  onProgress(progress: UploadProgress): void;
}): Promise<QueuedUpload[]> {
  const fetcher = input.fetcher ?? fetch;
  const parsed = parseUploadBatch({
    workspaceId: input.workspaceId,
    files: input.files.map((file) => ({
      name: file.name,
      size: file.size,
      declaredMime: file.type || 'text/plain',
    })),
  });
  parsed.files.forEach((file) => input.onProgress({ fileName: file.name, state: 'authorizing' }));

  const response = await fetcher('/api/uploads/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error((await response.json()).error ?? '无法创建上传会话');
  const payload = (await response.json()) as { sessions: unknown[] };
  const sessions = payload.sessions.map((session) => UploadSessionSchema.parse(session));
  if (sessions.length !== input.files.length) throw new Error('上传会话数量不匹配');

  return Promise.all(
    sessions.map(async (session, index) => {
      const file = input.files[index]!;
      try {
        input.onProgress({ fileName: file.name, state: 'uploading' });
        await input.gateway.upload(session, file);
        input.onProgress({ fileName: file.name, state: 'verifying' });
        const completed = await fetcher(`/api/uploads/sessions/${session.id}/complete`, {
          method: 'POST',
          cache: 'no-store',
        });
        if (!completed.ok) throw new Error('上传对象校验失败');
        const queued = (await completed.json()) as QueuedUpload;
        input.onProgress({ fileName: file.name, state: 'queued' });
        return queued;
      } catch (error) {
        input.onProgress({
          fileName: file.name,
          state: 'failed',
          message: error instanceof Error ? error.message : '上传失败',
        });
        throw error;
      }
    })
  );
}
