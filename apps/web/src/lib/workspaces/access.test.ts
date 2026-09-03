import { describe, expect, it, vi } from 'vitest';

import { requireWorkspaceCapability } from './access';

describe('requireWorkspaceCapability', () => {
  it('maps the database assertion to the stable cross-plan context', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        workspace_id: '21000000-0000-4000-8000-000000000001',
        user_id: '20000000-0000-4000-8000-000000000003',
        role: 'editor',
        kind: 'team',
      },
      error: null,
    });
    const client = { rpc: vi.fn().mockReturnValue({ single }) };
    await expect(
      requireWorkspaceCapability(
        client as never,
        '21000000-0000-4000-8000-000000000001',
        'documents.upload'
      )
    ).resolves.toEqual({
      workspaceId: '21000000-0000-4000-8000-000000000001',
      userId: '20000000-0000-4000-8000-000000000003',
      role: 'editor',
      kind: 'team',
    });
  });

  it('does not replace a database denial with a client-side role guess', async () => {
    const client = {
      rpc: vi.fn().mockReturnValue({
        single: vi
          .fn()
          .mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } }),
      }),
    };
    await expect(
      requireWorkspaceCapability(
        client as never,
        '21000000-0000-4000-8000-000000000001',
        'documents.upload'
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
