// The registration guide T17 and the pack labels as pure rules over the country pack (M5 step 4,
// D-263 to D-266). Imported as "@sbn/report/legal-path", so the browser never loads the PDF
// renderer of the package's main entry. The report's own wording is step 5.
export {
  officialLinks,
  registrationGuide,
  type GuideInput,
  type GuideRole,
  type GuideStep,
  type OfficialLink,
  type RegistrationGuide,
} from './guide';
export { PACK_KEYS, PACK_COUNTRIES, type PackCountry, type PackKey } from './keys';
export { PACK_STALE_AFTER_DAYS, packLabel, type PackLabel } from './label';
export {
  PACK_STATUSES,
  evidenceSchema,
  figureSchema,
  isIsoDate,
  packItemSchema,
  packValueSchema,
  textPairSchema,
  type Evidence,
  type Figure,
  type PackItem,
  type PackStatus,
  type PackValue,
  type TextPair,
} from './schema';
