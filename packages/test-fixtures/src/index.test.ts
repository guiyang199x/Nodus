import { describe, expect, it } from 'vitest';
import { SYNTHETIC_FIXTURES_ONLY } from './index';

describe('@knowledge/test-fixtures', () => {
  it('only allows synthetic fixtures', () => {
    expect(SYNTHETIC_FIXTURES_ONLY).toBe(true);
  });
});
