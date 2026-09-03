import { describe, expect, it } from 'vitest';
import { AI_PACKAGE } from './index';

describe('@knowledge/ai', () => {
  it('exposes a stable package identity for later adapters', () => {
    expect(AI_PACKAGE).toBe('@knowledge/ai');
  });
});
