import { AXES, AXIS_NAMES } from '@sbn/question-bank';
import { describe, expect, it } from 'vitest';
import { PLANS } from '@/config/plans';
import {
  AI_CONTEXT_DESCRIPTION,
  AI_CONTEXT_LEAD,
  AI_CONTEXT_SECTIONS,
  STATUS_LABEL,
} from './ai-context';

const text = JSON.stringify([AI_CONTEXT_LEAD, AI_CONTEXT_DESCRIPTION, AI_CONTEXT_SECTIONS]);

describe('the AI context page (D-337)', () => {
  it('has the ten sections in order, each with something to read', () => {
    expect(AI_CONTEXT_SECTIONS.map((section) => section.id)).toEqual([
      'overview',
      'features',
      'journey',
      'audience',
      'business-model',
      'technology',
      'ai',
      'positioning',
      'status',
      'verification',
    ]);
    for (const section of AI_CONTEXT_SECTIONS) {
      const parts = [section.paragraphs, section.bullets, section.features];
      expect(
        parts.some((part) => (part?.length ?? 0) > 0),
        section.id,
      ).toBe(true);
    }
  });

  it('marks every feature as implemented, partly implemented or planned', () => {
    const features = AI_CONTEXT_SECTIONS.flatMap((section) => section.features ?? []);
    expect(features.length).toBeGreaterThan(10);
    for (const feature of features) expect(STATUS_LABEL[feature.status]).toBeTruthy();
    const planned = features.filter((feature) => feature.status === 'planned').map((f) => f.name);
    expect(planned).toContain('Answering without an account');
  });

  it('quotes the package prices and the axis names from the product tables', () => {
    expect(text).toContain(`$${String(PLANS.strategist.priceUsd)}`);
    expect(text).toContain(`$${String(PLANS.commander.priceUsd)}`);
    for (const axis of AXES) expect(text).toContain(AXIS_NAMES[axis].en);
  });

  it('keeps secrets and the private question bank out (D-303, D-304, rule 7)', () => {
    for (const forbidden of [
      /sk-ant/i,
      /sb_secret/i,
      /service[_ -]?role/i,
      /PADDLE_[A-Z_]+/,
      /SUPABASE_[A-Z_]+/,
      /api[_ -]?key/i,
      /password/i,
      /vivarise/i,
    ]) {
      expect(text, String(forbidden)).not.toMatch(forbidden);
    }
  });

  it('does not mention the mentor, which is not published until it is complete (D-339)', () => {
    expect(text).not.toMatch(/mentor/i);
  });
});
