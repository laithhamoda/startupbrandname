import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountAccess } from './account-access';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('accountAccess (D-245, D-290)', () => {
  it('opens the full report to nobody by default', () => {
    const { access, previewListValid } = accountAccess('founder@example.test');
    expect(access.fullReportPreview).toBe(false);
    expect(previewListValid).toBe(true);
  });

  it('opens it to an address on the preview list, whatever its case', () => {
    vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', 'Owner@Example.test');
    expect(accountAccess('owner@example.test').access.fullReportPreview).toBe(true);
    expect(accountAccess('someone@example.test').access.fullReportPreview).toBe(false);
  });

  it('opens it to every account, and to one without an address, while early access is on', () => {
    vi.stubEnv('EARLY_ACCESS_FULL_REPORT', 'true');
    expect(accountAccess('someone@example.test').access.fullReportPreview).toBe(true);
    expect(accountAccess(null).access.fullReportPreview).toBe(true);
  });

  it('reads early access as on only for exactly "true"', () => {
    for (const raw of ['yes', 'TRUE', '1', 'false', '']) {
      vi.stubEnv('EARLY_ACCESS_FULL_REPORT', raw);
      expect(accountAccess('someone@example.test').access.fullReportPreview, raw).toBe(false);
    }
  });

  it('tells the caller about a malformed preview list, and early access still stands alone', () => {
    vi.stubEnv('FULL_REPORT_PREVIEW_EMAILS', 'owner@');
    expect(accountAccess('owner@example.test')).toMatchObject({
      previewListValid: false,
      access: { fullReportPreview: false },
    });
    vi.stubEnv('EARLY_ACCESS_FULL_REPORT', 'true');
    expect(accountAccess('owner@example.test')).toMatchObject({
      previewListValid: false,
      access: { fullReportPreview: true },
    });
  });
});
