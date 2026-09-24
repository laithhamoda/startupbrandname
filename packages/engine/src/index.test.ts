import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from './index';

describe('ENGINE_VERSION', () => {
  it('is a semantic version', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
