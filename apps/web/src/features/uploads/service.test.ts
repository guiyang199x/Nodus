import { describe, expect, it, vi } from 'vitest';

import { createUploadSessions } from './service';

vi.mock('@/lib/workspaces/access', () => ({
  requireWorkspaceCapability: vi.fn().mockResolvedValue({
    workspaceId: '41000000-0000-4000-8000-000000000001',
    userId: '40000000-0000-4000-8000-000000000002',
    role: 'editor',
    kind: 'team',
  }),
}));

const dbRow = {
  session_id: '43000000-0000-4000-8000-000000000001',
  workspace_id: '41000000-0000-4000-8000-000000000001',
  document_id: '44000000-0000-4000-8000-000000000001',
  revision_id: '45000000-0000-4000-8000-000000000001',
  object_path:
    'quarantine/41000000-0000-4000-8000-000000000001/44000000-0000-4000-8000-000000000001/45000000-0000-4000-8000-000000000001/random.txt',
  expires_at: '2026-09-02T11:00:00.000Z',
};

describe('createUploadSessions', () => {
  it('signs only database-generated paths', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    const sign = vi.fn().mockResolvedValue({ token: 'scoped-token' });
    const result = await createUploadSessions(
      { rpc } as never,
      { sign },
      {
        workspaceId: '41000000-0000-4000-8000-000000000001',
        files: [{ name: 'readme.txt', size: 12, declaredMime: 'text/plain' }],
      },
      '42000000-0000-4000-8000-000000000001'
    );
    expect(sign).toHaveBeenCalledWith(
      expect.stringContaining('/45000000-0000-4000-8000-000000000001/')
    );
    expect(result[0]?.uploadToken).toBe('scoped-token');
    // The browser never chooses where its bytes land.
    expect(result[0]?.objectPath).toBe(dbRow.object_path);
  });

  it('accepts the timestamp format PostgREST actually returns', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({
        data: [{ ...dbRow, expires_at: '2026-09-02T11:00:00.123456+00:00' }],
        error: null,
      });
    const result = await createUploadSessions(
      { rpc } as never,
      { sign: vi.fn().mockResolvedValue({ token: 't' }) },
      {
        workspaceId: '41000000-0000-4000-8000-000000000001',
        files: [{ name: 'readme.txt', size: 12, declaredMime: 'text/plain' }],
      },
      '42000000-0000-4000-8000-000000000001'
    );
    expect(result).toHaveLength(1);
  });

  it('aborts the database sessions when signing fails, leaving nothing redeemable', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    await expect(
      createUploadSessions(
        { rpc } as never,
        { sign: vi.fn().mockRejectedValue(new Error('storage down')) },
        {
          workspaceId: '41000000-0000-4000-8000-000000000001',
          files: [{ name: 'readme.txt', size: 12, declaredMime: 'text/plain' }],
        },
        '42000000-0000-4000-8000-000000000001'
      )
    ).rejects.toThrow('无法签发上传授权');
    expect(rpc).toHaveBeenLastCalledWith(
      'abort_upload_sessions',
      expect.objectContaining({ target_session_ids: [dbRow.session_id] })
    );
  });
});
