import { describe, expect, it } from 'vitest';
import { OBSERVABILITY_PACKAGE } from './index';

describe('@knowledge/observability', () => {
  it('exposes a stable package identity for later telemetry', () => {
    expect(OBSERVABILITY_PACKAGE).toBe('@knowledge/observability');
  });
});
