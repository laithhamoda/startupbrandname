import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from './index';

describe('ENGINE_VERSION', () => {
  it('is a semantic version', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is 1.0.0 now that the engine of M4 is complete (D-221)', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
  });
});
