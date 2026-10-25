import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOUNDER } from '@/config/founder';
import { ABOUT } from '@/content/about';
import { FOUNDER_ID, founderJsonLd, organizationFounderJsonLd } from './json-ld';

describe('founder structured data (D-308)', () => {
  it('describes the person in the page language and names the other as an alternate', () => {
    expect(founderJsonLd('ar')).toMatchObject({
      '@type': 'Person',
      '@id': FOUNDER_ID,
      name: 'ليث حموده',
      alternateName: 'Laith Hamoda',
      jobTitle: 'مؤسس المنصة',
      url: 'https://startupbrandname.com/ar/about',
    });
    expect(founderJsonLd('en')).toMatchObject({
      name: 'Laith Hamoda',
      alternateName: 'ليث حموده',
      jobTitle: 'Founder',
      url: 'https://startupbrandname.com/en/about',
    });
  });

  it('links the owner’s profile, his city and the organisation, with an absolute photo URL', () => {
    // schema-dts types a Person as a union that includes a string, so read it as plain data.
    const person = JSON.parse(JSON.stringify(founderJsonLd('en'))) as Record<string, unknown>;
    expect(person.sameAs).toEqual(['https://www.linkedin.com/in/laithhamoda']);
    expect(person.image).toBe('https://startupbrandname.com/team/laith-hamoda.webp');
    expect(person.worksFor).toEqual({ '@id': 'https://startupbrandname.com/#organization' });
    expect(JSON.stringify(person.homeLocation)).toContain('Amman');
  });

  it('publishes nothing the owner did not state: no email, phone or birth date', () => {
    const text = JSON.stringify([founderJsonLd('ar'), founderJsonLd('en')]);
    for (const field of ['email', 'telephone', 'birthDate', 'gender', 'alumniOf', 'award']) {
      expect(text).not.toContain(`"${field}"`);
    }
  });

  it('points the organisation at the same person', () => {
    expect(organizationFounderJsonLd()).toMatchObject({
      '@type': 'Organization',
      '@id': 'https://startupbrandname.com/#organization',
      founder: { '@id': FOUNDER_ID },
    });
  });
});

describe('founder photograph and text', () => {
  const file = join(process.cwd(), 'public', FOUNDER.photo.path);

  it('is a small, existing, pre-sized file at the path the page uses', () => {
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(100_000);
    expect(FOUNDER.photo.width / FOUNDER.photo.height).toBeCloseTo(4 / 5, 5);
  });

  it('describes the picture with the name, in both languages', () => {
    expect(ABOUT.ar.founderPhotoAlt).toContain(FOUNDER.name.ar);
    expect(ABOUT.en.founderPhotoAlt).toContain(FOUNDER.name.en);
  });

  it('uses no pronoun for the founder in English, where none was stated', () => {
    expect(ABOUT.en.founderBio).not.toMatch(/\b(he|his|him|she|her|hers)\b/i);
  });
});
