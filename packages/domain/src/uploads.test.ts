import { describe, expect, it } from 'vitest';
import { parseUploadBatch } from './uploads';

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
