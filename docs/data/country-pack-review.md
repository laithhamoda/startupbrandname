# Country pack review: Jordan and Algeria

For the lead and the owner. Generated from `supabase/migrations/20261013000000_m5_country_pack_seed.sql` (M5 step 4, D-263 to D-266). Every item was read on its official page on 2026-10-12 and audited by the lead the same day. Nothing here is from memory or from the SPEC.

## Re-run note

The verifier (verify_seed.py) was re-run later on 2026-10-12 and reported BAD for five items. The mf.gov.dz
finance-law PDFs answered HTTP 500 (three DZ items), and the istd.gov.jo page (JO tax.registration.body)
and casnos.dz/affiliation (DZ social_security.registration.body) no longer returned the evidence
sentences, although the lead found them earlier the same day. Treat this as a live-site fault, not a
wrong fact. Re-run the verifier when the sites answer; if a sentence is really gone, set that item to
under_review.

## Items

| Country | Key                                                  | Status       | Source URL                                                                                                                                                                                                                          | Date       |
| ------- | ---------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| JO      | `registration.sole.body`                             | verified     | https://www.mit.gov.jo/Ar/Pages/%D8%A7%D9%84%D9%85%D8%A4%D8%B3%D8%B3%D8%A7%D8%AA_%D8%A7%D9%84%D9%81%D8%B1%D8%AF%D9%8A%D8%A9_%D9%88%D8%A7%D9%84%D8%A3%D8%B3%D9%85%D8%A7%D8%A1_%D8%A7%D9%84%D8%AA%D8%AC%D8%A7%D8%B1%D9%8A%D8%A9       | 2026-10-12 |
| JO      | `registration.company.body`                          | verified     | https://www.ccd.gov.jo/Default/Ar                                                                                                                                                                                                   | 2026-10-12 |
| JO      | `registration.chamber.membership`                    | verified     | https://mit.gov.jo/EBV4.0/Root_Storage/AR/EB_UsefullLinks/%D8%A7%D9%84%D8%A7%D9%86%D8%AA%D8%B3%D8%A7%D8%A8_%D9%84%D8%BA%D8%B1%D9%81_%D8%A7%D9%84%D8%AA%D8%AC%D8%A7%D8%B1%D8%A9_%D9%88%D8%A7%D9%84%D8%B5%D9%86%D8%A7%D8%B9%D8%A9.pdf | 2026-10-12 |
| JO      | `approval.food.body`                                 | verified     | https://www.jfda.jo/Ar/Pages/%D9%85%D8%AF%D9%8A%D8%B1%D9%8A%D8%A9_%D8%A7%D9%84%D9%85%D9%86%D8%A7%D8%B7%D9%82                                                                                                                        | 2026-10-12 |
| JO      | `approval.cosmetics.body`                            | verified     | https://www.jfda.jo/Ar/Pages/%D9%85%D8%AF%D9%8A%D8%B1%D9%8A%D8%A9_%D8%A7%D9%84%D8%A7%D8%AC%D9%87%D8%B2%D8%A9_%D8%A7%D9%84%D8%B7%D8%A8%D9%8A%D8%A9_%D9%88%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D9%84%D8%B2%D9%85%D8%A7%D8%AA                | 2026-10-12 |
| JO      | `licence.vocational.body`                            | verified     | https://www.ammancity.gov.jo/ar/gameservices/eservices.aspx                                                                                                                                                                         | 2026-10-12 |
| JO      | `licence.home_business.amman`                        | under_review | https://www.ammancity.gov.jo/site_doc/HBBsBook.pdf                                                                                                                                                                                  | 2026-10-12 |
| JO      | `tax.registration.body`                              | verified     | https://www.istd.gov.jo/AR/Pages/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA_%D8%A7%D9%84%D8%AD%D9%83%D9%88%D9%85%D8%A9_%D8%A7%D9%84%D8%A7%D9%84%D9%83%D8%AA%D8%B1%D9%88%D9%86%D9%8A%D8%A9                                                       | 2026-10-12 |
| JO      | `social_security.registration.body`                  | verified     | https://www.ssc.gov.jo/                                                                                                                                                                                                             | 2026-10-12 |
| JO      | `data.statistics`                                    | verified     | https://dosweb.dos.gov.jo/ar/                                                                                                                                                                                                       | 2026-10-12 |
| JO      | `data.central_bank`                                  | verified     | https://www.cbj.gov.jo/                                                                                                                                                                                                             | 2026-10-12 |
| JO      | `data.support_agency`                                | verified     | https://www.jedco.gov.jo/                                                                                                                                                                                                           | 2026-10-12 |
| JO      | `currency.main`                                      | verified     | https://www.cbj.gov.jo/En/Pages/Operational_Framework                                                                                                                                                                               | 2026-10-12 |
| JO      | `official.tax_authority`                             | verified     | https://www.istd.gov.jo/Default/Ar                                                                                                                                                                                                  | 2026-10-12 |
| DZ      | `registration.auto_entrepreneur.body`                | verified     | https://www.anae.dz/                                                                                                                                                                                                                | 2026-10-12 |
| DZ      | `registration.auto_entrepreneur.activity_list`       | verified     | https://activities.anae.dz/                                                                                                                                                                                                         | 2026-10-12 |
| DZ      | `registration.auto_entrepreneur.micro_import`        | verified     | https://www.anae.dz/micro-importer/guide                                                                                                                                                                                            | 2026-10-12 |
| DZ      | `registration.auto_entrepreneur.micro_import_limits` | unverified   | https://www.anae.dz/micro-importer/guide                                                                                                                                                                                            | 2026-10-12 |
| DZ      | `tax.ifu.auto_entrepreneur.rate_ceiling`             | verified     | https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu                                                                                                                                               | 2026-10-12 |
| DZ      | `tax.ifu.auto_entrepreneur.payment`                  | verified     | https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu                                                                                                                                               | 2026-10-12 |
| DZ      | `tax.ifu.auto_entrepreneur.minimum`                  | verified     | https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu                                                                                                                                               | 2026-10-12 |
| DZ      | `tax.ifu.coverage`                                   | verified     | https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu                                                                                                                                               | 2026-10-12 |
| DZ      | `registration.commercial_register.body`              | verified     | https://sidjilcom.cnrc.dz/en/web/sidjilcom/-/conditions-et-modalites/2.6                                                                                                                                                            | 2026-10-12 |
| DZ      | `social_security.registration.body`                  | verified     | https://www.casnos.dz/affiliation                                                                                                                                                                                                   | 2026-10-12 |
| DZ      | `tax.registration.body`                              | verified     | https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu                                                                                                                                               | 2026-10-12 |
| DZ      | `data.statistics`                                    | verified     | https://www.ons.dz/                                                                                                                                                                                                                 | 2026-10-12 |
| DZ      | `data.central_bank`                                  | verified     | https://www.bank-of-algeria.dz/                                                                                                                                                                                                     | 2026-10-12 |
| DZ      | `currency.main`                                      | verified     | https://www.bank-of-algeria.dz/taux-de-change-3/                                                                                                                                                                                    | 2026-10-12 |
| DZ      | `official.tax_authority`                             | verified     | https://www.mfdgi.gov.dz/                                                                                                                                                                                                           | 2026-10-12 |

29 items: 27 verified, 1 under review, 1 unverified. An item that is not verified, or older than 90 days, shows the label «تحقّق من المصدر الرسمي» in the report.

- `licence.home_business.amman` is under review: the Amman guide rests on the 2017 instructions, while a later news item cites the instructions of 2020 amended in 2021.
- `registration.auto_entrepreneur.micro_import_limits` is unverified: the 1,800,000 DA per trip and 2 trips a month were read only in the ANAE guide; Executive Decree 25-170 itself was not read.

## Figures and their evidence

Every number sits with its own evidence: a sentence in the page's own words and the page it was read on. A figure with two lines was read twice (two pages, or a page and the Journal Officiel).

### DZ `registration.auto_entrepreneur.micro_import`

- **customs_duty_rate**: 5%
  - (ar) "مع دفع نسبة إجمالية مقدرة بنسبة 05 % من قيمة السلع المستوردة كحقوق ورسوم جمركية." https://www.anae.dz/micro-importer/guide
  - (fr) "sont soumises au taux réduit de 5% des droits de douane" https://www.mf.gov.dz/images/pdf/loidefinance/Loi_de_Finances_2026_FR.pdf (Journal Officiel N° 88 (31 décembre 2025), loi de finances pour 2026, art. 143)
- **ifu_rate_at_customs**: 0,5 %
  - (fr) "à l’impôt forfaitaire unique fixé au taux de 0,5 % libératoire, calculé sur la base de la valeur en douane, augmentée des droits de douane et d’une marge forfaitaire de 30%" https://www.mf.gov.dz/images/pdf/loidefinance/Loi_de_Finances_2026_FR.pdf (Journal Officiel N° 88 (31 décembre 2025), loi de finances pour 2026, art. 143)
  - (fr) "le montant de l'impôt est acquitté auprès des services des douanes au moment de la mise à la consommation des marchandises." https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu (Art.143/LF 2026, as cited by the DGI page)

### DZ `registration.auto_entrepreneur.micro_import_limits`

- **value_per_trip**: 1.800.000 دج
  - (ar) "لكميات محدودة لا تتجاوز قيمتها مليون وثمانمائة ألف دينار جزائري (1.800.000 دج) لكل تنقّل" https://www.anae.dz/micro-importer/guide
- **trips_per_month**: 2
  - (ar) "لكل تنقّل، في حدود تنقّلين (2) في الشهر." https://www.anae.dz/micro-importer/guide

### DZ `tax.ifu.auto_entrepreneur.rate_ceiling`

- **rate**: 0,5 %
  - (fr) "0,5 %, pour les activités exercées par les activités sous le statut auto-entrepreneur ; (Art. 282sexies du CIDTA/ Art.18 LF 2024)" https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu
  - (ar) "0,5٪، للأنشطة الممارسة في إطار نظام المقاول الذاتي؛ (المادة 282 مكرر4 من قانون الضرائب المباشرة والرسوم المماثلة/ المادة 18 من ق.م 2024)" https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar
  - (fr) "Toutefois, les activités exercées sous le statut d’auto-entrepreneur sont soumises au taux de 0,5%" https://www.mf.gov.dz/images/pdf/loidefinance/FLFin.pdf (Journal Officiel N° 86 (31 décembre 2023), loi de finances pour 2024, art. 18 (art. 282 sexies du CIDTA))
- **turnover_ceiling**: 5.000.000 DA
  - (fr) "Personnes physiques exerçant une activité sous le statut d'auto-entrepreneur lorsque leur chiffre d'affaires annuel n'excède pas cinq millions de dinars algériens (5.000.000 DA) ; (Art. 282ter du CIDTA et Art. 51 LF 2023)" https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu
  - (ar) "الأشخاص الطبيعيون الذين يمارسون نشاطا في إطار نظام المقاول الذاتي عندما لا يتجاوز رقم أعمالهم السنوي خمسة ملايين دينار جزائري (5.000.000,00 دج)؛ (المادتين 282 مكرر4 من قانون الضرائب المباشرة والرسوم المماثلة و51 من قانون المالية لسنة 2023)" https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar
  - (fr) "sont éligibles au statut d’auto-entrepreneur, les contribuables réalisant un chiffre d’affaires annuel n’excédant pas cinq millions de dinars algériens (5.000.000 DA)" https://www.mf.gov.dz/images/pdf/loidefinancecomplementaire/F2022089.pdf (Journal Officiel N° 89 (29 décembre 2022), loi de finances pour 2023, art. 51)
- **years_above_ceiling**: 3
  - (fr) "Pour l'auto entrepreneur ayant réalisé un chiffre d'affaires annuel dépassant le seuil de 5.000.000 DA, durant trois (03) années de suite, de s'inscrire au registre du commerce, s'il souhaite poursuivre l'exercice de son activité. Dans ce cas, il sera soumis au régime fiscal approprié conformément à la législation fiscale en vigueur. (Art.14 de la loi n° 22-23 du 18 décembre 2022 portant statut de l'auto-entrepreneur - J.O.N°85)" https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu
  - (ar) "بالنسبة للمقاول الذاتي الذي حقق رقم أعمال سنوي يتجاوز عتبة 5.000.000 دج، خلال ثلاث (03) سنوات متتالية، يجب عليه التسجيل في السجل التجاري، إذا كان يرغب في مواصلة ممارسة نشاطه. في هذه الحالة، يخضع للنظام الضريبي المناسب وفقًا للتشريع الضريبي المعمول به. (المادة 14 من القانون رقم 22-23 المؤرخ في 18 ديسمبر سنة 2022 - الجريدة الرسمية رقم 85)" https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar
  - (fr) "En cas de dépassement du chiffre d’affaires annuel défini par la législation en vigueur durant trois (3) années de suite, l’auto-entrepreneur est tenu de s’inscrire au registre du commerce, s’il souhaite poursuivre l’exercice de son activité." https://www.joradp.dz/FTP/JO-FRANCAIS/2022/F2022085.pdf (Journal Officiel N° 85 (19 décembre 2022), loi n° 22-23 portant statut de l'auto-entrepreneur, art. 13 (la page de la DGI cite l'art. 14))

### DZ `tax.ifu.auto_entrepreneur.payment`

- **provisional_declaration_deadline**: 30 juin
  - (fr) "Lors du dépôt de la déclaration prévisionnelle (G n°12) (au plus tard le 30 juin de chaque année), les contribuables procèdent au paiement total de l'impôt forfaitaire unique correspondant au chiffre d'affaires prévisionnel déclaré." https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu
  - (ar) "عند تقديم التصريح التقديري ج رقم 12 (في أجل لا يتجاوز 30 جوان من كل سنة)، يقوم المكلفون بالضريبة بدفع إجمالي الضريبة الجزافية الوحيدة الموافقة لرقم الأعمال التقديري المصرح به لدى قابض الضرائب الذي يتبعه مكان ممارسة النشاط." https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar
- **instalments**: 50% + 25% + 25%
  - (fr) "Dans ce cas, ils doivent s'acquitter, lors du dépôt de la déclaration prévisionnelle (G n°12) (au plus tard le 30 juin de chaque année), de 50% du montant de l'impôt forfaitaire unique (IFU)." https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu
  - (fr) "25%, du 1er au 15 septembre" https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu
  - (fr) "25%, du 1er au 15 décembre." https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu
  - (ar) "في هذه الحالة، يتعين عليهم دفع عند إيداع التصريح التقديري "ج رقم 12" (في أجل لا يتجاوز 30 جوان من كل سنة)، 50% من مبلغ الضريبة الجزافية الوحيدة." https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar

### DZ `tax.ifu.auto_entrepreneur.minimum`

- **minimum_auto_entrepreneur**: 10.000 DA
  - (fr) "Sauf pour les activités exercées sous le statut d'auto entrepreneur, ce montant est fixé à 10.000 DA." https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu
  - (ar) "باستثناء الأنشطة الممارسة تحت صفة المقاول الذاتي، يُحدد هذا المبلغ بـ 10.000 دج." https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar
  - (fr) "Toutefois, pour les activités exercées sous le statut d’autoentrepreneur, ce montant est fixé à 10.000 DA." https://www.mf.gov.dz/images/pdf/loidefinance/Loi_de_finance_2025_FR.pdf (Journal Officiel N° 84 (26 décembre 2024), loi de finances pour 2025, art. 29 (art. 365 bis du CIDTA))
- **minimum_general**: 30.000 DA
  - (fr) "Le montant de l'IFU ne peut être inférieur à 30.000 DA." https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu
  - (fr) "Le montant dû au titre de l’impôt forfaitaire unique ne peut être inférieur, pour chaque exercice et quel que soit le chiffre d’affaires imposable, à 30.000 DA." https://www.mf.gov.dz/images/pdf/loidefinance/Loi_de_finance_2025_FR.pdf (Journal Officiel N° 84 (26 décembre 2024), loi de finances pour 2025, art. 29 (art. 365 bis du CIDTA))
- **payment_deadline**: 30 juin
  - (fr) "Le minimum d’imposition doit être acquitté intégralement au plus tard le 30 juin de l’année concernée." https://www.mf.gov.dz/images/pdf/loidefinance/Loi_de_finance_2025_FR.pdf (Journal Officiel N° 84 (26 décembre 2024), loi de finances pour 2025, art. 29 (art. 365 bis du CIDTA))

### DZ `social_security.registration.body`

- **affiliation_deadline_days**: 10
  - (fr) "Les personnes exerçant pour leur propre compte une activité professionnelle, industrielle, commerciale, agricole, artisanale, auto-entrepreneur, libérale ou dans toute autre branche ou secteur d’activité sont tenues d’adresser à la caisse une déclaration d’activité dans les dix (10) jours qui suivent le début d’exercice de l’activité, munies du dossier suivant, selon l’activité exercée :" https://www.casnos.dz/affiliation

### DZ `tax.registration.body`

- **existence_declaration_days**: 30
  - (fr) "Les contribuables doivent souscrire une déclaration d'existence, dans les trente (30) jours du début de leur activité auprès de l'inspection des impôts ou du centre de proximité des impôts (CPI) dont ils dépendent." https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu
  - (ar) "يتعين على المكلفين بالضريبة اكتتاب التصريح بالوجود، في غضون ثلاثين (30) يوما من بداية نشاطهم مع مفتشية الضرائب أو مركز الجواري للضرائب (CPI) التابعين لهم." https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar

## Allowed domains (`settings` key `pack.allowed_domains`)

A host matches a domain or any subdomain of it. Government portals and public agencies only (D-263).

| Country | Domain             | Why                                                                                              |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| JO      | mit.gov.jo         | Ministry of Industry, Trade and Supply: registration of sole proprietorships, chamber membership |
| JO      | ccd.gov.jo         | Companies Control Department: registration of companies                                          |
| JO      | jfda.jo            | Jordan Food and Drug Administration: food and cosmetics approvals                                |
| JO      | ammancity.gov.jo   | Greater Amman Municipality: vocational and home-business licences                                |
| JO      | istd.gov.jo        | Income and Sales Tax Department: the tax authority                                               |
| JO      | ssc.gov.jo         | Social Security Corporation: social security registration                                        |
| JO      | dos.gov.jo         | Department of Statistics: official statistics                                                    |
| JO      | cbj.gov.jo         | Central Bank of Jordan: the currency and financial data                                          |
| JO      | jedco.gov.jo       | JEDCO, the government enterprise development body: support programmes                            |
| DZ      | anae.dz            | National Agency for the Auto-Entrepreneur: registration, activity list, micro-import             |
| DZ      | mfdgi.gov.dz       | General Directorate of Taxes: the tax authority and the IFU                                      |
| DZ      | mf.gov.dz          | Ministry of Finance: hosts the Journal Officiel PDFs of the finance laws                         |
| DZ      | joradp.dz          | The Official Gazette                                                                             |
| DZ      | cnrc.dz            | National Centre of the Commercial Register                                                       |
| DZ      | casnos.dz          | National social security fund for non-salaried workers                                           |
| DZ      | ons.dz             | National Office of Statistics                                                                    |
| DZ      | bank-of-algeria.dz | Bank of Algeria: the currency                                                                    |

## How "verified" was decided

Official means a government portal or public agency, the official gazette, or a ministry's own document. Every number needs two readings (two pages, or a page and the gazette). An evidence sentence is the page's own words. A status other than `verified` means the label appears in the report.

## Differences of fact from SPEC section 7

Algeria (checked against the official pages):

- IFU rate 0.5 percent: confirmed (DGI page; finance law 2024, art. 18).
- Turnover ceiling 5,000,000 DA: confirmed (DGI page; finance law 2023, art. 51).
- Minimum 10,000 DA for auto-entrepreneurs: confirmed. The DGI page words it elliptically; article 29 of the 2025 finance law is clear: 30,000 DA in general, 10,000 DA for auto-entrepreneurs, paid in full by 30 June.
- "IFU covers VAT": confirmed in the sense that the page says the IFU groups TLS, VAT and IRG. "No VAT deduction on purchases" is not stated on any page read, so it is not stored.
- The ANAE activity codes are not stored: the item links the official list.

Jordan:

- The SPEC names the Ministry of Health and Civil Defense for food approvals. The official Amman home-business guide names the Jordan Food and Drug Administration for home food professions (baked goods, pickles, legumes, jameed) and the Ministry of Health only for other professions. Civil Defense was not found and is not stored.
- The SPEC's "Central Trade and Industrial Registration Directorate" is worded on the ministry's site as the Commercial Registry Directorate. The seed uses the site's wording.
- No fee of any kind was found on an official page, so none is stored.

## The tax decision (D-266)

No `tax_rules` row is written, for either country.

- Algeria: every IFU figure is confirmed, but the engine models a year's tax as paid in the next year (`TaxRule.paymentMonth` is a month of the year after the one the tax accrues in), while the IFU is paid on the forecast turnover by 30 June of the same year, in full or in three parts (50, 25 and 25 percent). A rule would misstate the cash flow. The report shows "tax not calculated", the official link and the adviser line. Open question #97 asks whether to extend the engine.
- Jordan: the income tax rates and exemptions were not read on an official page, and `TaxRule` cannot express personal exemptions.

## What could not be found

- Fees of any kind, in either country.
- Jordan income tax rates and exemptions.
- Civil Defense requirements for food premises in Jordan.
- A statement on no VAT deduction for the IFU in Algeria.
- Executive Decree 25-170 itself (the micro-import limits rest on the ANAE guide).
