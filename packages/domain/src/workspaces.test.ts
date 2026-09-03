import { describe, expect, it } from 'vitest';
import { CAPABILITIES, hasCapability } from './workspaces';

describe('workspace capability matrix', () => {
  it('gives owner every capability and viewer read only', () => {
    expect(CAPABILITIES.every((capability) => hasCapability('owner', capability))).toBe(true);
    expect(hasCapability('viewer', 'documents.read')).toBe(true);
    expect(hasCapability('viewer', 'documents.upload')).toBe(false);
    expect(hasCapability('admin', 'members.manage_admin')).toBe(false);
    expect(hasCapability('editor', 'documents.trash')).toBe(true);
    expect(hasCapability('editor', 'documents.delete')).toBe(false);
  });
});
