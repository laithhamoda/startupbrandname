import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from './index';

describe('ENGINE_VERSION', () => {
  it('is a semantic version', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is 1.1.0 now that the verdict, confidence and validation plan are in (D-246)', () => {
    expect(ENGINE_VERSION).toBe('1.1.0');
  });
});
