import { describe, expect, it } from 'vitest';
import { stepFromSlug, stepPath, stepSlug } from './steps';

describe('step URLs (D-117)', () => {
  it('write follow-ups without a dot, and read them back', () => {
    expect(stepSlug('G4.1')).toBe('G4-1');
    expect(stepFromSlug('G4-1')).toBe('G4.1');
    expect(stepFromSlug('A1')).toBe('A1');
    expect(stepPath('p', 'F6.1')).toBe('/projects/p/q/F6-1');
  });

  it('know no other step', () => {
    expect(stepFromSlug('Z9')).toBeNull();
    expect(stepFromSlug('A1-9')).toBeNull();
    expect(stepFromSlug('G4')).toBe('G4');
  });
});
