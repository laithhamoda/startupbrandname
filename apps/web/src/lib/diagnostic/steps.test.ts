import { FOLLOW_UPS, QUESTIONS } from '@sbn/question-bank';
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

  // The proxy skips any path with a dot, so no step may keep one in its URL.
  it.each([...QUESTIONS, ...FOLLOW_UPS].map((step) => step.id))(
    'take %s to a URL without a dot and back',
    (id) => {
      const slug = stepSlug(id);
      expect(slug).not.toContain('.');
      expect(stepFromSlug(slug)).toBe(id);
      expect(stepPath('p', id)).toBe(`/projects/p/q/${slug}`);
    },
  );

  it.each(['', 'a1', 'A9', 'A1.1', 'A1-1', 'A2-1-1', 'A2--1', 'A2-x', 'Z9-1'])(
    'read no step from "%s"',
    (slug) => {
      expect(stepFromSlug(slug)).toBeNull();
    },
  );

  it('also read a follow-up written with its dot, as saveAnswer receives it', () => {
    expect(stepFromSlug('F6.1')).toBe('F6.1');
  });
});
