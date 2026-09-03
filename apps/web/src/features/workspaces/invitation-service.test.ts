import { describe, expect, it, vi } from 'vitest';

import { inviteMember } from './invitation-service';

describe('inviteMember', () => {
  it('sends the one-time token but never returns it to the browser', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          invitation_id: '31000000-0000-4000-8000-000000000001',
          raw_token: 'secret-one-time-token',
          expires_at: '2026-09-09T09:00:00.000Z',
        },
      ],
      error: null,
    });
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await inviteMember(
      { rpc } as never,
      { send },
      {
        workspaceId: '21000000-0000-4000-8000-000000000001',
        workspaceName: 'Team One',
        inviterName: 'Owner',
        email: 'new@example.test',
        role: 'editor',
        appUrl: 'https://app.example.test',
        requestId: '32000000-0000-4000-8000-000000000001',
      }
    );
    expect(result).toEqual({
      ok: true,
      data: {
        invitationId: '31000000-0000-4000-8000-000000000001',
        expiresAt: '2026-09-09T09:00:00.000Z',
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret-one-time-token');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.test',
        acceptUrl: 'https://app.example.test/invite/secret-one-time-token',
      })
    );
  });

  it('revokes the database invitation when email delivery fails', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            invitation_id: '31000000-0000-4000-8000-000000000001',
            raw_token: 'token',
            expires_at: '2026-09-09T09:00:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });
    const result = await inviteMember(
      { rpc } as never,
      { send: vi.fn().mockRejectedValue(new Error('mail down')) },
      {
        workspaceId: '21000000-0000-4000-8000-000000000001',
        workspaceName: 'Team One',
        inviterName: 'Owner',
        email: 'new@example.test',
        role: 'viewer',
        appUrl: 'https://app.example.test',
        requestId: '32000000-0000-4000-8000-000000000001',
      }
    );
    expect(result).toEqual({
      ok: false,
      error: { code: 'DEPENDENCY_FAILED', message: '邀请邮件发送失败，邀请已撤销' },
    });
    expect(rpc).toHaveBeenLastCalledWith(
      'revoke_invitation',
      expect.objectContaining({
        target_invitation_id: '31000000-0000-4000-8000-000000000001',
      })
    );
  });

  it('does not send mail when the database refuses to create the invitation', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } });
    const send = vi.fn();
    const result = await inviteMember(
      { rpc } as never,
      { send },
      {
        workspaceId: '21000000-0000-4000-8000-000000000001',
        workspaceName: 'Team One',
        inviterName: 'Admin',
        email: 'new@example.test',
        role: 'admin',
        appUrl: 'https://app.example.test',
        requestId: '32000000-0000-4000-8000-000000000001',
      }
    );
    expect(result).toEqual({ ok: false, error: { code: 'FORBIDDEN', message: '无法创建此邀请' } });
    expect(send).not.toHaveBeenCalled();
  });
});
