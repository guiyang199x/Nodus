import { describe, expect, it } from 'vitest';
import { UploadSessionSchema, parseUploadBatch } from './uploads';

describe('upload contract', () => {
  it('accepts a supported batch and rejects masqueraded or oversized input', () => {
    expect(
      parseUploadBatch({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        files: [{ name: 'notes.md', size: 12, declaredMime: 'text/markdown' }],
      }).files
    ).toHaveLength(1);
    expect(() =>
      parseUploadBatch({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        files: [{ name: 'payload.exe', size: 12, declaredMime: 'text/plain' }],
      })
    ).toThrow('不支持此文件格式');
    expect(() =>
      parseUploadBatch({
        workspaceId: '11111111-1111-4111-8111-111111111111',
        files: [{ name: 'large.pdf', size: 52_428_801, declaredMime: 'application/pdf' }],
      })
    ).toThrow('单文件不能超过 50 MB');
  });
});

describe('upload session contract', () => {
  it('accepts the timestamp format PostgREST returns for timestamptz', () => {
    const session = {
      id: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      documentId: '33333333-3333-4333-8333-333333333333',
      revisionId: '44444444-4444-4444-8444-444444444444',
      objectPath: 'quarantine/a/b/c/d.txt',
      uploadToken: 'token',
      expiresAt: '2026-09-02T11:00:00.123456+00:00',
    };
    expect(UploadSessionSchema.parse(session).expiresAt).toBe(session.expiresAt);
    expect(
      UploadSessionSchema.parse({ ...session, expiresAt: '2026-09-02T11:00:00.000Z' }).expiresAt
    ).toBe('2026-09-02T11:00:00.000Z');
  });
});
