import { describe, expect, it } from 'vitest';
import { nextVersion, summariesOf, versionsLeft, type VersionRow } from './versions';

function rows(verdicts: readonly string[]): VersionRow[] {
  return verdicts.map((verdict, index) => ({
    number: index + 1,
    verdict,
    input_hash: String(index + 1).padStart(64, '0'),
    created_at: `2026-10-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
  }));
}

const OLD_LIMITS = { max: 10, afterGo: 5 } as const;

describe('versionsLeft (D-321)', () => {
  it('leaves 10 to a project without versions', () => {
    expect(versionsLeft([], OLD_LIMITS)).toBe(10);
    expect(nextVersion([])).toBe(1);
  });

  it('counts down to 10 while the verdict is revise or stop', () => {
    expect(versionsLeft(rows(['stop', 'revise', 'revise']), OLD_LIMITS)).toBe(7);
    expect(versionsLeft(rows(Array<string>(10).fill('revise')), OLD_LIMITS)).toBe(0);
  });

  it('leaves 5 more after the first go, within the 10', () => {
    expect(versionsLeft(rows(['revise', 'go']), OLD_LIMITS)).toBe(5);
    expect(versionsLeft(rows(['revise', 'go', 'go', 'revise']), OLD_LIMITS)).toBe(3);
    expect(versionsLeft(rows(['revise', 'go', 'go', 'go', 'go', 'go', 'go']), OLD_LIMITS)).toBe(0);
    expect(versionsLeft(rows([...Array<string>(8).fill('stop'), 'go']), OLD_LIMITS)).toBe(1);
  });

  it('follows other limits when the settings change', () => {
    expect(versionsLeft(rows(['go']), { max: 3, afterGo: 5 })).toBe(2);
  });

  it('is null, no limit, with the settings of today (D-343)', () => {
    expect(versionsLeft([])).toBeNull();
    expect(versionsLeft(rows(Array<string>(30).fill('go')))).toBeNull();
  });

  it('limits only the side that has a number', () => {
    expect(versionsLeft(rows(['revise', 'revise']), { max: 5, afterGo: null })).toBe(3);
    expect(versionsLeft(rows(['go', 'go']), { max: null, afterGo: 5 })).toBe(4);
    expect(versionsLeft(rows(['revise', 'revise']), { max: null, afterGo: 5 })).toBeNull();
  });
});

describe('summariesOf', () => {
  it('orders the versions and names an unknown verdict as revise', () => {
    const [unknown] = rows(['x']);
    const shuffled = [
      ...rows(['go', 'stop']).reverse(),
      ...(unknown ? [{ ...unknown, number: 3 }] : []),
    ];
    expect(summariesOf(shuffled).map((version) => [version.number, version.verdict])).toEqual([
      [1, 'go'],
      [2, 'stop'],
      [3, 'revise'],
    ]);
    expect(nextVersion(shuffled)).toBe(4);
  });
});
