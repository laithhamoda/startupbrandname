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

describe('versionsLeft (D-321)', () => {
  it('leaves 10 to a project without versions', () => {
    expect(versionsLeft([])).toBe(10);
    expect(nextVersion([])).toBe(1);
  });

  it('counts down to 10 while the verdict is revise or stop', () => {
    expect(versionsLeft(rows(['stop', 'revise', 'revise']))).toBe(7);
    expect(versionsLeft(rows(Array<string>(10).fill('revise')))).toBe(0);
  });

  it('leaves 5 more after the first go, within the 10', () => {
    expect(versionsLeft(rows(['revise', 'go']))).toBe(5);
    expect(versionsLeft(rows(['revise', 'go', 'go', 'revise']))).toBe(3);
    expect(versionsLeft(rows(['revise', 'go', 'go', 'go', 'go', 'go', 'go']))).toBe(0);
    expect(versionsLeft(rows([...Array<string>(8).fill('stop'), 'go']))).toBe(1);
  });

  it('follows other limits when the settings change', () => {
    expect(versionsLeft(rows(['go']), { max: 3, afterGo: 5 })).toBe(2);
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
