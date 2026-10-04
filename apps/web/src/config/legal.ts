/**
 * Versions of the texts a user agrees to, stored with every consent (consent_events.text_version).
 * Change the version whenever the wording of that text changes. Both texts are placeholders
 * until legal review (CLAUDE.md §10).
 *
 * TERMS_VERSION covers the terms of use and the privacy policy that the signup box says the user
 * has read. CROSSBORDER_VERSION covers the cross-border consent; legal.test.ts pins its wording to
 * the version, and the database counts a consent only for a version listed in
 * `consent.crossborder.accepted_versions` (D-147), so a new version needs a migration that lists
 * it. Consents to an earlier text are renewed on the account page.
 */
export const TERMS_VERSION = '2026-10-draft-2';
export const CROSSBORDER_VERSION = '2026-10-draft-2';
