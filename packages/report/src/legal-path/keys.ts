/**
 * The keys of the first country pack (D-264), as constants: the guide rules and the tests name an
 * item by these, never by a string typed twice. The country is a separate column in the table, so
 * a key such as `registration.sole.body` exists once for each country that has it.
 */
export const PACK_KEYS = {
  // Jordan.
  soleRegistration: 'registration.sole.body',
  companyRegistration: 'registration.company.body',
  chamberMembership: 'registration.chamber.membership',
  foodApproval: 'approval.food.body',
  cosmeticsApproval: 'approval.cosmetics.body',
  vocationalLicence: 'licence.vocational.body',
  homeBusinessAmman: 'licence.home_business.amman',
  dataSupportAgency: 'data.support_agency',
  // Algeria.
  autoEntrepreneur: 'registration.auto_entrepreneur.body',
  autoEntrepreneurActivityList: 'registration.auto_entrepreneur.activity_list',
  microImport: 'registration.auto_entrepreneur.micro_import',
  microImportLimits: 'registration.auto_entrepreneur.micro_import_limits',
  ifuRateCeiling: 'tax.ifu.auto_entrepreneur.rate_ceiling',
  ifuPayment: 'tax.ifu.auto_entrepreneur.payment',
  ifuMinimum: 'tax.ifu.auto_entrepreneur.minimum',
  ifuCoverage: 'tax.ifu.coverage',
  commercialRegister: 'registration.commercial_register.body',
  // Both countries.
  socialSecurity: 'social_security.registration.body',
  taxRegistration: 'tax.registration.body',
  dataStatistics: 'data.statistics',
  dataCentralBank: 'data.central_bank',
  currency: 'currency.main',
  taxAuthority: 'official.tax_authority',
} as const;

export type PackKey = (typeof PACK_KEYS)[keyof typeof PACK_KEYS];

/** The countries the first pack covers (D-066, D-068). */
export const PACK_COUNTRIES = ['JO', 'DZ'] as const;
export type PackCountry = (typeof PACK_COUNTRIES)[number];
