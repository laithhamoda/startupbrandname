-- M5 step 4: the first country pack, for Jordan (JO) and Algeria (DZ), and the list of official
-- domains the pack may be read from (CLAUDE.md rules 8 and 9, D-233, D-263 to D-266).
--
-- Every row was read on its official page on 2026-10-12 (last_verified); the evidence sentences
-- inside "value" are the page's own words. Nothing here comes from memory or from the SPEC.
-- docs/data/country-pack-review.md lists each item, its page, what the pages said and what could
-- not be confirmed. No tax_rules row is written (D-266): the Algerian IFU values are all confirmed,
-- but the engine pays the tax of a year in the next year, while the IFU is paid on the forecast
-- turnover by 30 June of the same year, so a rule would misstate the cash flow.
--
-- Expand only: plain inserts that skip a row already there, so the file can be applied again.
-- A later review changes a row through the admin (M8), not by editing this file.

-- ---------------------------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------------------------

-- Registrable domains (a host matches itself and every subdomain). Government portals and public
-- agencies only; the review file gives the reason for each (D-263).
insert into public.settings (key, value) values (
  'pack.allowed_domains',
  '["mit.gov.jo", "ccd.gov.jo", "jfda.jo", "ammancity.gov.jo", "istd.gov.jo", "ssc.gov.jo", "dos.gov.jo", "cbj.gov.jo", "jedco.gov.jo", "anae.dz", "mfdgi.gov.dz", "mf.gov.dz", "joradp.dz", "cnrc.dz", "casnos.dz", "ons.dz", "bank-of-algeria.dz"]'::jsonb
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Jordan
-- ---------------------------------------------------------------------------------------------

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'registration.sole.body',
  $json${
    "name": {
      "ar": "وزارة الصناعة والتجارة والتموين: تسجيل المؤسسات الفردية والأسماء التجارية",
      "en": "Ministry of Industry, Trade and Supply: registration of sole proprietorships and trade names"
    },
    "description": {
      "ar": "تُسجَّل المؤسسة الفردية لدى مديرية السجل التجاري في الوزارة، ويتم التسجيل عبر خدمات الوزارة الإلكترونية بعد تفعيل الهوية الإلكترونية وتطبيق سند.",
      "en": "A sole proprietorship is registered with the Commercial Registry Directorate of the Ministry, through the Ministry's online services, after activating the electronic identity and the Sanad app."
    },
    "evidence": [
      {
        "text": "لتسجيل المؤسسات الفردية والأسماء التجارية، اضغط هنا",
        "lang": "ar",
        "url": "https://www.mit.gov.jo/Ar/Pages/%D8%A7%D9%84%D9%85%D8%A4%D8%B3%D8%B3%D8%A7%D8%AA_%D8%A7%D9%84%D9%81%D8%B1%D8%AF%D9%8A%D8%A9_%D9%88%D8%A7%D9%84%D8%A3%D8%B3%D9%85%D8%A7%D8%A1_%D8%A7%D9%84%D8%AA%D8%AC%D8%A7%D8%B1%D9%8A%D8%A9"
      },
      {
        "text": "يرجى تفعيل الهوية الالكترونية وتحميل تطبيق سند",
        "lang": "ar",
        "url": "https://www.mit.gov.jo/AR/Pages/%D8%AA%D8%B3%D8%AC%D9%8A%D9%84_%D8%A7%D9%84%D8%A7%D8%B3%D9%85%D8%A7%D8%A1_%D8%A7%D9%84%D8%AA%D8%AC%D8%A7%D8%B1%D9%8A%D8%A9_%D9%88%D8%A7%D9%84%D9%85%D8%A4%D8%B3%D8%B3%D8%A7%D8%AA_%D8%A7%D9%84%D9%81%D8%B1%D8%AF%D9%8A%D8%A9"
      },
      {
        "text": "إن الخطوة الأولى هي قيام أصحاب الأعمال الراغبين في مزاولة عملهم من المنزل بتسجيل مؤسسة فردية لدى مديرية السجل التجاري في وزارة الصناعة والتجارة والتموين أو شركة في دائرة مراقبة الشركات.",
        "lang": "ar",
        "url": "https://www.ammancity.gov.jo/site_doc/HBBsBook.pdf"
      }
    ]
  }$json$::jsonb,
  'https://www.mit.gov.jo/Ar/Pages/%D8%A7%D9%84%D9%85%D8%A4%D8%B3%D8%B3%D8%A7%D8%AA_%D8%A7%D9%84%D9%81%D8%B1%D8%AF%D9%8A%D8%A9_%D9%88%D8%A7%D9%84%D8%A3%D8%B3%D9%85%D8%A7%D8%A1_%D8%A7%D9%84%D8%AA%D8%AC%D8%A7%D8%B1%D9%8A%D8%A9',
  'www.mit.gov.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'registration.company.body',
  $json${
    "name": {
      "ar": "دائرة مراقبة الشركات",
      "en": "Companies Control Department"
    },
    "description": {
      "ar": "تُسجَّل الشركات لدى دائرة مراقبة الشركات، وتقدّم الدائرة خدمات إلكترونية للشركات القائمة تشمل التعديلات القانونية والتصفية والشطب والإيداعات المالية. ويذكر دليل الأعمال المنزلية أن من يعمل من منزله يسجّل مؤسسة فردية لدى مديرية السجل التجاري في وزارة الصناعة والتجارة والتموين أو شركة في دائرة مراقبة الشركات.",
      "en": "Companies are registered with the Companies Control Department, whose online services for existing companies cover legal amendments, liquidation and striking off, and financial filings. The home-business guide says that someone working from home registers either a sole proprietorship with the Commercial Registry Directorate of the Ministry of Industry, Trade and Supply, or a company with the Companies Control Department."
    },
    "evidence": [
      {
        "text": "خدمات الشركات القائمة وتشمل: (التعديلات القانونية ، التصفية والشطب، التعديلات والإيداعات المالية)",
        "lang": "ar",
        "url": "https://www.ccd.gov.jo/Default/Ar"
      },
      {
        "text": "إن الخطوة الأولى هي قيام أصحاب الأعمال الراغبين في مزاولة عملهم من المنزل بتسجيل مؤسسة فردية لدى مديرية السجل التجاري في وزارة الصناعة والتجارة والتموين أو شركة في دائرة مراقبة الشركات.",
        "lang": "ar",
        "url": "https://www.ammancity.gov.jo/site_doc/HBBsBook.pdf"
      }
    ]
  }$json$::jsonb,
  'https://www.ccd.gov.jo/Default/Ar',
  'www.ccd.gov.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'registration.chamber.membership',
  $json${
    "name": {
      "ar": "الانتساب إلى غرفة التجارة أو غرفة الصناعة",
      "en": "Membership of a chamber of commerce or a chamber of industry"
    },
    "description": {
      "ar": "بحسب دليل الوزارة، إذا وقع العمل تحت مظلة القطاعات الصناعية فالجهة غرفة الصناعة، وإذا وقع تحت مظلة قطاعات التجارة فالجهة غرفة التجارة. ويذكر دليل الأعمال المنزلية شهادة الانتساب إلى الغرف الصناعية أو التجارية ضمن وثائق رخصة المهن «إذا تطلب الأمر ذلك».",
      "en": "According to the Ministry's guide, a business under the industrial sectors joins the chamber of industry, and one under the trade sectors joins the chamber of commerce. The home-business guide lists the chamber membership certificate among the documents for the professions licence \"if required\"."
    },
    "evidence": [
      {
        "text": "اذا وقع عملك تحت مظلة القطاعات الصناعية المذكورة ادناه، فعليك التوجه الى غرفة الصناعة",
        "lang": "ar",
        "url": "https://mit.gov.jo/EBV4.0/Root_Storage/AR/EB_UsefullLinks/%D8%A7%D9%84%D8%A7%D9%86%D8%AA%D8%B3%D8%A7%D8%A8_%D9%84%D8%BA%D8%B1%D9%81_%D8%A7%D9%84%D8%AA%D8%AC%D8%A7%D8%B1%D8%A9_%D9%88%D8%A7%D9%84%D8%B5%D9%86%D8%A7%D8%B9%D8%A9.pdf"
      },
      {
        "text": "اذا وقع عملك تحت مظلة قطاعات التجارة المذكورة ادناه، فعليك التوجه الى غرفة التجارة",
        "lang": "ar",
        "url": "https://mit.gov.jo/EBV4.0/Root_Storage/AR/EB_UsefullLinks/%D8%A7%D9%84%D8%A7%D9%86%D8%AA%D8%B3%D8%A7%D8%A8_%D9%84%D8%BA%D8%B1%D9%81_%D8%A7%D9%84%D8%AA%D8%AC%D8%A7%D8%B1%D8%A9_%D9%88%D8%A7%D9%84%D8%B5%D9%86%D8%A7%D8%B9%D8%A9.pdf"
      }
    ]
  }$json$::jsonb,
  'https://mit.gov.jo/EBV4.0/Root_Storage/AR/EB_UsefullLinks/%D8%A7%D9%84%D8%A7%D9%86%D8%AA%D8%B3%D8%A7%D8%A8_%D9%84%D8%BA%D8%B1%D9%81_%D8%A7%D9%84%D8%AA%D8%AC%D8%A7%D8%B1%D8%A9_%D9%88%D8%A7%D9%84%D8%B5%D9%86%D8%A7%D8%B9%D8%A9.pdf',
  'mit.gov.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'approval.food.body',
  $json${
    "name": {
      "ar": "المؤسسة العامة للغذاء والدواء: الرقابة على المنشآت الغذائية",
      "en": "Jordan Food and Drug Administration: control of food establishments"
    },
    "description": {
      "ar": "تتولى مديرية المناطق في المؤسسة الرقابة والتفتيش على الغذاء المتداول في المنشآت الغذائية لغايات الترخيص. ويورد دليل الأعمال المنزلية أن بعض المهن الغذائية المنزلية، كتحضير المخبوزات، تحتاج إلى موافقة المؤسسة مسبقاً قبل رخصة البلدية.",
      "en": "The Regions Directorate of the Administration inspects and controls food in food establishments for licensing purposes. The home-business guide says that some home food professions, such as baking, need the Administration's prior approval before the municipal licence."
    },
    "evidence": [
      {
        "text": "مهام الرقابة والتفتيش على الغذاء المتداول في المنشآت الغذائية في المنطقة المستهدفة لكل منها لغايات الترخيص، والمتابعة الدورية ولمتابعة الشكاوى واتخاذ الاجراءات القانونية بحق المخالفين .",
        "lang": "ar",
        "url": "https://www.jfda.jo/Ar/Pages/%D9%85%D8%AF%D9%8A%D8%B1%D9%8A%D8%A9_%D8%A7%D9%84%D9%85%D9%86%D8%A7%D8%B7%D9%82"
      }
    ]
  }$json$::jsonb,
  'https://www.jfda.jo/Ar/Pages/%D9%85%D8%AF%D9%8A%D8%B1%D9%8A%D8%A9_%D8%A7%D9%84%D9%85%D9%86%D8%A7%D8%B7%D9%82',
  'www.jfda.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'approval.cosmetics.body',
  $json${
    "name": {
      "ar": "المؤسسة العامة للغذاء والدواء: مديرية الأجهزة الطبية والمستلزمات (مواد التجميل)",
      "en": "Jordan Food and Drug Administration: Medical Devices and Supplies Directorate (cosmetics)"
    },
    "description": {
      "ar": "تتولى المديرية تسجيل مواد التجميل المستوردة والمنتجة محلياً ومراقبتها، وإجازة تداولها.",
      "en": "The Directorate registers and controls imported and locally produced cosmetics and licenses their circulation."
    },
    "evidence": [
      {
        "text": "تسجيل مواد التجميل المستوردة والمنتجة محلياً ومراقبتها بناء على أسس وتعليمات إجازة تداول مواد التجميل والمستحضرات التجميلية الصيدلانية لسنة 2016.",
        "lang": "ar",
        "url": "https://www.jfda.jo/Ar/Pages/%D9%85%D8%AF%D9%8A%D8%B1%D9%8A%D8%A9_%D8%A7%D9%84%D8%A7%D8%AC%D9%87%D8%B2%D8%A9_%D8%A7%D9%84%D8%B7%D8%A8%D9%8A%D8%A9_%D9%88%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D9%84%D8%B2%D9%85%D8%A7%D8%AA"
      }
    ]
  }$json$::jsonb,
  'https://www.jfda.jo/Ar/Pages/%D9%85%D8%AF%D9%8A%D8%B1%D9%8A%D8%A9_%D8%A7%D9%84%D8%A7%D8%AC%D9%87%D8%B2%D8%A9_%D8%A7%D9%84%D8%B7%D8%A8%D9%8A%D8%A9_%D9%88%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D9%84%D8%B2%D9%85%D8%A7%D8%AA',
  'www.jfda.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'licence.vocational.body',
  $json${
    "name": {
      "ar": "أمانة عمان الكبرى: نظام رخص المهن",
      "en": "Greater Amman Municipality: professions licensing system"
    },
    "description": {
      "ar": "بعد تسجيل المؤسسة أو الشركة يتقدّم صاحب العمل إلى البلدية أو أمانة عمان الكبرى بطلب رخصة مهن. وتتيح الأمانة نظاماً إلكترونياً لرخص المهن في بوابة خدماتها الإلكترونية.",
      "en": "After the business is registered, the owner applies for a professions licence to the municipality or Greater Amman Municipality. The Municipality offers an online professions licensing system in its e-services portal."
    },
    "evidence": [
      {
        "text": "نظام رخص المهن",
        "lang": "ar",
        "url": "https://www.ammancity.gov.jo/ar/gameservices/eservices.aspx"
      },
      {
        "text": "ومن ثم التقدم إلى البلدية / أمانة عمان الكبرى للحصول على رخصة مهن للبدء بممارسة عملهم من المنزل",
        "lang": "ar",
        "url": "https://www.ammancity.gov.jo/site_doc/HBBsBook.pdf"
      }
    ]
  }$json$::jsonb,
  'https://www.ammancity.gov.jo/ar/gameservices/eservices.aspx',
  'www.ammancity.gov.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'licence.home_business.amman',
  $json${
    "name": {
      "ar": "ترخيص مزاولة العمل من المنزل في أمانة عمان الكبرى",
      "en": "Licence to work from home in Greater Amman Municipality"
    },
    "description": {
      "ar": "تسمح التعليمات بترخيص قائمة محددة من المهن من داخل المنزل، بشرط ألا تشكل المهنة أثراً يتجاوز الاستخدام السكني المعتاد. الخطوة الأولى تسجيل المؤسسة الفردية أو الشركة، ثم طلب رخصة المهن من الأمانة أو البلدية. بعض المهن تحتاج موافقة مسبقة من جهة قطاعية، وتحتاج المهن الغذائية المنزلية موافقة المؤسسة العامة للغذاء والدواء.",
      "en": "The instructions allow a defined list of professions to be licensed from inside the home, as long as the profession has no effect beyond the usual residential use. The first step is to register the sole proprietorship or company, then to apply for the professions licence at the Municipality. Some professions need a prior approval from a sector authority, and home food professions need the approval of the Jordan Food and Drug Administration."
    },
    "note": {
      "ar": "الدليل الرسمي يستند إلى تعليمات سنة 2017، بينما يشير خبر لاحق على موقع الأمانة إلى تعليمات سنة 2020 وتعديلاتها عام 2021؛ تحقّق من الصيغة السارية لدى الأمانة.",
      "en": "The official guide rests on the instructions of 2017, while a later news item on the Municipality's site refers to instructions of 2020 amended in 2021; check which version applies with the Municipality."
    },
    "evidence": [
      {
        "text": "وترسخ تعليمات ممارسة المهن من داخل المنزل لسنة 2020 وتعديلاتها عام 2021 ثقافة الإنتاج والاعتماد على الذات عبر إنشاء مشاريع منزلية صغيرة تساهم بالتخفيف من البطالة وتحفز عجلة الاقتصاد .",
        "lang": "ar",
        "url": "https://media.ammancity.gov.jo/Ar/NewsDetails/%D8%A7%D9%84%D8%A3%D9%85%D8%A7%D9%86%D8%A9_%D8%AA%D9%86%D9%81%D8%B0_%D8%A8%D8%B1%D8%A7%D9%85%D8%AC_%D8%AA%D9%88%D8%B9%D9%88%D9%8A%D8%A9_%D9%84%D9%84%D8%AA%D8%B9%D8%B1%D9%8A%D9%81_%D8%A8%D8%AA%D8%B9%D9%84%D9%8A%D9%85%D8%A7%D8%AA_%D9%85%D9%85%D8%A7%D8%B1%D8%B3%D8%A9_%D8%A7%D9%84%D9%85%D9%87%D9%86_%D8%AF%D8%A7%D8%AE%D9%84_%D8%A7%D9%84%D9%85%D9%86%D8%A7%D8%B2%D9%84_"
      }
    ]
  }$json$::jsonb,
  'https://www.ammancity.gov.jo/site_doc/HBBsBook.pdf',
  'www.ammancity.gov.jo',
  '2026-10-12',
  'under_review'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'tax.registration.body',
  $json${
    "name": {
      "ar": "وزارة المالية: دائرة ضريبة الدخل والمبيعات",
      "en": "Ministry of Finance: Income and Sales Tax Department"
    },
    "description": {
      "ar": "دائرة ضريبة الدخل والمبيعات هي الجهة الضريبية، وتقدّم خدماتها عبر برنامج الحكومة الإلكترونية، ومن أبرزها تقديم الإقرارات الضريبية للأفراد والشركات.",
      "en": "The Income and Sales Tax Department is the tax authority; its e-government programme offers services, chiefly the filing of tax returns by individuals and companies."
    },
    "evidence": [
      {
        "text": "العديد من الخدمات التي أبرزها تقديم الاقرارات والتي تشمل الموظفين الأفراد والشركات العادية والشركات المساهمة",
        "lang": "ar",
        "url": "https://www.istd.gov.jo/AR/Pages/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA_%D8%A7%D9%84%D8%AD%D9%83%D9%88%D9%85%D8%A9_%D8%A7%D9%84%D8%A7%D9%84%D9%83%D8%AA%D8%B1%D9%88%D9%86%D9%8A%D8%A9"
      }
    ]
  }$json$::jsonb,
  'https://www.istd.gov.jo/AR/Pages/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA_%D8%A7%D9%84%D8%AD%D9%83%D9%88%D9%85%D8%A9_%D8%A7%D9%84%D8%A7%D9%84%D9%83%D8%AA%D8%B1%D9%88%D9%86%D9%8A%D8%A9',
  'www.istd.gov.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'social_security.registration.body',
  $json${
    "name": {
      "ar": "المؤسسة العامة للضمان الاجتماعي",
      "en": "Social Security Corporation"
    },
    "description": {
      "ar": "تتيح المؤسسة خدمة إلكترونية لشمول المنشآت بالضمان الاجتماعي وخدمات لأصحاب العمل عبر بوابتها الإلكترونية.",
      "en": "The Corporation offers an online service for enrolling establishments in social security, and services for employers, through its portal."
    },
    "evidence": [
      {
        "text": "شمول منشأة",
        "lang": "ar",
        "url": "https://www.ssc.gov.jo/"
      }
    ],
    "url": "https://eservices.ssc.gov.jo/corporateRegisteration"
  }$json$::jsonb,
  'https://www.ssc.gov.jo/',
  'www.ssc.gov.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'data.statistics',
  $json${
    "name": {
      "ar": "دائرة الإحصاءات العامة",
      "en": "Department of Statistics"
    },
    "description": {
      "ar": "المصدر الرسمي للإحصاءات الوطنية: النشرات الإحصائية والكتب السنوية وتقارير تحليلية.",
      "en": "The official source of national statistics: statistical bulletins, yearbooks and analytical reports."
    }
  }$json$::jsonb,
  'https://dosweb.dos.gov.jo/ar/',
  'dosweb.dos.gov.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'data.central_bank',
  $json${
    "name": {
      "ar": "البنك المركزي الأردني",
      "en": "Central Bank of Jordan"
    },
    "description": {
      "ar": "المصدر الرسمي للإحصاءات النقدية والمصرفية وأسعار الصرف والتقارير الاقتصادية.",
      "en": "The official source of monetary and banking statistics, exchange rates and economic reports."
    }
  }$json$::jsonb,
  'https://www.cbj.gov.jo/',
  'www.cbj.gov.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'data.support_agency',
  $json${
    "name": {
      "ar": "المؤسسة الأردنية لتطوير المشاريع الاقتصادية (JEDCO)",
      "en": "Jordan Enterprise Development Corporation (JEDCO)"
    },
    "description": {
      "ar": "ذراع حكومي لدعم القطاع الخاص في الأردن، وله البوابة الوطنية للمنشآت الصغيرة والمتوسطة.",
      "en": "A government arm supporting the private sector in Jordan; it runs the national portal for small and medium enterprises."
    },
    "evidence": [
      {
        "text": "كذراع حكومي لدعم القطاع الخاص في الأردن ليصبح قادرًا على المنافسة في الأسواق العالمية",
        "lang": "ar",
        "url": "https://www.jedco.gov.jo/"
      }
    ]
  }$json$::jsonb,
  'https://www.jedco.gov.jo/',
  'www.jedco.gov.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'currency.main',
  $json${
    "name": {
      "ar": "الدينار الأردني",
      "en": "Jordanian dinar"
    },
    "description": {
      "ar": "يربط البنك المركزي سعر صرف الدينار بالدولار الأمريكي، ويعدّ هذا النظام الركيزة الاسمية للسياسة النقدية.",
      "en": "The Central Bank fixes the dinar's exchange rate to the US dollar and treats this system as the nominal pillar of monetary policy."
    },
    "code": "JOD",
    "evidence": [
      {
        "text": "The system of the fixed exchange rate with the US Dollar is the nominal pillar of the monetary policy.",
        "lang": "en",
        "url": "https://www.cbj.gov.jo/En/Pages/Operational_Framework"
      }
    ]
  }$json$::jsonb,
  'https://www.cbj.gov.jo/En/Pages/Operational_Framework',
  'www.cbj.gov.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'JO',
  'official.tax_authority',
  $json${
    "name": {
      "ar": "دائرة ضريبة الدخل والمبيعات",
      "en": "Income and Sales Tax Department"
    },
    "description": {
      "ar": "الموقع الرسمي للجهة الضريبية في الأردن.",
      "en": "The official site of the tax authority in Jordan."
    },
    "url": "https://www.istd.gov.jo/Default/Ar"
  }$json$::jsonb,
  'https://www.istd.gov.jo/Default/Ar',
  'www.istd.gov.jo',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Algeria
-- ---------------------------------------------------------------------------------------------

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'registration.auto_entrepreneur.body',
  $json${
    "name": {
      "ar": "الوكالة الوطنية للمقاول الذاتي (ANAE)",
      "en": "National Agency for the Auto-Entrepreneur (ANAE)"
    },
    "description": {
      "ar": "التسجيل في السجل الوطني للمقاول الذاتي، وطلب بطاقة المقاول الذاتي، يتمان عبر موقع الوكالة. ويخضع التسجيل لثلاثة شروط أساسية: بلوغ السن القانونية للعمل؛ الجنسية الجزائرية والإقامة بالجزائر (أو أجنبي مقيم وفقاً للتشريع والتنظيم)؛ وممارسة نشاط مدرج ضمن قائمة النشاطات المؤهلة.",
      "en": "Registration in the national register of auto-entrepreneurs, and the request for the auto-entrepreneur card, are made on the Agency's site. Registration has three basic conditions: reaching the legal working age; Algerian nationality and residence in Algeria (or a foreign resident under the legislation and regulations); and carrying out an activity on the list of eligible activities."
    },
    "evidence": [
      {
        "text": "التسجيل في السجل الوطني للمقاول الذاتي يخضع لثلاثة شروط اساسية",
        "lang": "ar",
        "url": "https://www.anae.dz/"
      },
      {
        "text": "بلوغ السن القانونية للعمل",
        "lang": "ar",
        "url": "https://www.anae.dz/"
      },
      {
        "text": "أن يكون من جنسـية جزائرية ومقيمــا بالجزائر أو أجنبـيا مقيما وفقا للتشريع والتنظيم المعمول بهما",
        "lang": "ar",
        "url": "https://www.anae.dz/"
      },
      {
        "text": "أن يمارس نشاطا مدرجا ضمن قائمة النشاطات المؤهلة للاستفادة من القانون الأساسي للمقاول الذاتي",
        "lang": "ar",
        "url": "https://www.anae.dz/"
      }
    ],
    "url": "https://anae.dz/user/ae/register"
  }$json$::jsonb,
  'https://www.anae.dz/',
  'www.anae.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'registration.auto_entrepreneur.activity_list',
  $json${
    "name": {
      "ar": "قائمة النشاطات المؤهلة لصفة المقاول الذاتي",
      "en": "List of activities eligible for the auto-entrepreneur status"
    },
    "description": {
      "ar": "تنشر الوكالة القائمة المرجعية للنشاطات مرتبة بحسب الميادين، ويتعين على كل شخص يطلب تسجيله في السجل الوطني للمقاول الذاتي أن يستعمل هذه القائمة وجوباً.",
      "en": "The Agency publishes the reference list of activities, grouped by field, and every person asking to be registered in the national register of auto-entrepreneurs must use this list."
    },
    "evidence": [
      {
        "text": "يتعين على كل شخص يطلب تسجيله في السجل الوطنــي للمقــاول الذاتــي، أن يستعمل وجوبا قائمة هذه النشاطات المرجعية",
        "lang": "ar",
        "url": "https://www.anae.dz/"
      }
    ],
    "url": "https://activities.anae.dz/"
  }$json$::jsonb,
  'https://activities.anae.dz/',
  'activities.anae.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'registration.auto_entrepreneur.micro_import',
  $json${
    "name": {
      "ar": "نشاط الاستيراد المصغر",
      "en": "Micro-import activity"
    },
    "description": {
      "ar": "يمارس نشاط الاستيراد المصغر الأشخاص الطبيعيون الحائزون على صفة المقاول الذاتي. يصرّح المستورد المصغر بقائمة السلع عبر المنصة قبل وصولها للإقليم الجمركي. وتخضع عمليات الاستيراد لتخفيض الحقوق الجمركية إلى 5%، ولضريبة جزافية وحيدة بمعدل 0,5% تُدفع لدى الجمارك. النص المرجعي هو المرسوم التنفيذي رقم 25-170.",
      "en": "The micro-import activity is carried out by individuals holding the auto-entrepreneur status. The micro-importer declares the list of goods on the platform before they reach the customs territory. Imports bear a reduced customs duty of 5% and a single flat-rate tax of 0.5% paid at customs. The reference text is Executive Decree 25-170."
    },
    "figures": [
      {
        "id": "customs_duty_rate",
        "text": "5%",
        "evidence": [
          {
            "text": "مع دفع نسبة إجمالية مقدرة بنسبة 05 % من قيمة السلع المستوردة كحقوق ورسوم جمركية.",
            "lang": "ar",
            "url": "https://www.anae.dz/micro-importer/guide"
          },
          {
            "text": "sont soumises au taux réduit de 5% des droits de douane",
            "lang": "fr",
            "url": "https://www.mf.gov.dz/images/pdf/loidefinance/Loi_de_Finances_2026_FR.pdf",
            "cite": "Journal Officiel N° 88 (31 décembre 2025), loi de finances pour 2026, art. 143"
          }
        ]
      },
      {
        "id": "ifu_rate_at_customs",
        "text": "0,5 %",
        "evidence": [
          {
            "text": "à l’impôt forfaitaire unique fixé au taux de 0,5 % libératoire, calculé sur la base de la valeur en douane, augmentée des droits de douane et d’une marge forfaitaire de 30%",
            "lang": "fr",
            "url": "https://www.mf.gov.dz/images/pdf/loidefinance/Loi_de_Finances_2026_FR.pdf",
            "cite": "Journal Officiel N° 88 (31 décembre 2025), loi de finances pour 2026, art. 143"
          },
          {
            "text": "le montant de l'impôt est acquitté auprès des services des douanes au moment de la mise à la consommation des marchandises.",
            "lang": "fr",
            "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu",
            "cite": "Art.143/LF 2026, as cited by the DGI page"
          }
        ]
      }
    ],
    "evidence": [
      {
        "text": "يمارس نشاط الاستيراد المصغر من طرف الأشخاص الطبيعيين الحائزين على صفة المقاول الذاتي",
        "lang": "ar",
        "url": "https://www.anae.dz/micro-importer/guide"
      },
      {
        "text": "المرسوم التنفيذي رقم 25-170 المؤرخ في 28 جوان 2025",
        "lang": "ar",
        "url": "https://www.anae.dz/micro-importer/guide"
      },
      {
        "text": "يتعين على المستورد المصغر التصريح بقائمة السلع عبر المنصة قبل وصولها للإقليم الجمركي، ويتضمن التصريح:",
        "lang": "ar",
        "url": "https://www.anae.dz/micro-importer/guide"
      },
      {
        "text": "les contribuables exerçant l’activité de micro-importation définie par la législation et la réglementation en vigueur, sont éligibles au statut d’auto-entrepreneur",
        "lang": "fr",
        "url": "https://www.mf.gov.dz/images/pdf/loidefinance/Loi_de_Finances_2026_FR.pdf",
        "cite": "Journal Officiel N° 88 (31 décembre 2025), loi de finances pour 2026, art. 143"
      }
    ],
    "url": "https://www.anae.dz/micro-importer/guide"
  }$json$::jsonb,
  'https://www.anae.dz/micro-importer/guide',
  'www.anae.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'registration.auto_entrepreneur.micro_import_limits',
  $json${
    "name": {
      "ar": "سقف الاستيراد المصغر",
      "en": "Micro-import limits"
    },
    "description": {
      "ar": "يحدّد الدليل الرسمي للوكالة قيمة السلع المستوردة في كل تنقّل بمليون وثمانمائة ألف دينار جزائري (1.800.000 دج) على الأكثر، وبتنقّلين (2) في الشهر على الأكثر. لم تُقرأ هذه الأرقام إلا في هذا الدليل، ولم يُقرأ المرسوم التنفيذي رقم 25-170 نفسه؛ فتحقّق من النص المرجعي قبل الاعتماد عليها.",
      "en": "The Agency's official guide sets the value of goods imported on each trip at no more than one million eight hundred thousand Algerian dinars (1,800,000 DA), and at most two (2) trips a month. These figures were read only in this guide, and Executive Decree 25-170 itself was not read; check the reference text before relying on them."
    },
    "figures": [
      {
        "id": "value_per_trip",
        "text": "1.800.000 دج",
        "evidence": [
          {
            "text": "لكميات محدودة لا تتجاوز قيمتها مليون وثمانمائة ألف دينار جزائري (1.800.000 دج) لكل تنقّل",
            "lang": "ar",
            "url": "https://www.anae.dz/micro-importer/guide"
          }
        ]
      },
      {
        "id": "trips_per_month",
        "text": "2",
        "evidence": [
          {
            "text": "لكل تنقّل، في حدود تنقّلين (2) في الشهر.",
            "lang": "ar",
            "url": "https://www.anae.dz/micro-importer/guide"
          }
        ]
      }
    ],
    "url": "https://www.anae.dz/micro-importer/guide"
  }$json$::jsonb,
  'https://www.anae.dz/micro-importer/guide',
  'www.anae.dz',
  '2026-10-12',
  'unverified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'tax.ifu.auto_entrepreneur.rate_ceiling',
  $json${
    "name": {
      "ar": "الضريبة الجزافية الوحيدة (IFU) للمقاول الذاتي: المعدل والسقف",
      "en": "Single flat-rate tax (IFU) for auto-entrepreneurs: rate and ceiling"
    },
    "description": {
      "ar": "تطبّق الضريبة الجزافية الوحيدة على الأشخاص الطبيعيين الذين يمارسون نشاطاً بصفة مقاول ذاتي ما دام رقم أعمالهم السنوي لا يتجاوز السقف، بمعدل خاص بأنشطة المقاول الذاتي. إذا تجاوز المقاول الذاتي السقف عدة سنوات متتالية وجب عليه التسجيل في السجل التجاري إن أراد مواصلة نشاطه.",
      "en": "The single flat-rate tax applies to individuals working as auto-entrepreneurs as long as their annual turnover does not exceed the ceiling, at a rate specific to auto-entrepreneur activities. An auto-entrepreneur who exceeds the ceiling for several years in a row must register in the commercial register to continue the activity."
    },
    "figures": [
      {
        "id": "rate",
        "text": "0,5 %",
        "evidence": [
          {
            "text": "0,5 %, pour les activités exercées par les activités sous le statut auto-entrepreneur ; (Art. 282sexies du CIDTA/ Art.18 LF 2024)",
            "lang": "fr",
            "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu"
          },
          {
            "text": "0,5٪، للأنشطة الممارسة في إطار نظام المقاول الذاتي؛ (المادة 282 مكرر4 من قانون الضرائب المباشرة والرسوم المماثلة/ المادة 18 من ق.م 2024)",
            "lang": "ar",
            "url": "https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar"
          },
          {
            "text": "Toutefois, les activités exercées sous le statut d’auto-entrepreneur sont soumises au taux de 0,5%",
            "lang": "fr",
            "url": "https://www.mf.gov.dz/images/pdf/loidefinance/FLFin.pdf",
            "cite": "Journal Officiel N° 86 (31 décembre 2023), loi de finances pour 2024, art. 18 (art. 282 sexies du CIDTA)"
          }
        ]
      },
      {
        "id": "turnover_ceiling",
        "text": "5.000.000 DA",
        "evidence": [
          {
            "text": "Personnes physiques exerçant une activité sous le statut d'auto-entrepreneur lorsque leur chiffre d'affaires annuel n'excède pas cinq millions de dinars algériens (5.000.000 DA) ; (Art. 282ter du CIDTA et Art. 51 LF 2023)",
            "lang": "fr",
            "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu"
          },
          {
            "text": "الأشخاص الطبيعيون الذين يمارسون نشاطا في إطار نظام المقاول الذاتي عندما لا يتجاوز رقم أعمالهم السنوي خمسة ملايين دينار جزائري (5.000.000,00 دج)؛ (المادتين 282 مكرر4 من قانون الضرائب المباشرة والرسوم المماثلة و51 من قانون المالية لسنة 2023)",
            "lang": "ar",
            "url": "https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar"
          },
          {
            "text": "sont éligibles au statut d’auto-entrepreneur, les contribuables réalisant un chiffre d’affaires annuel n’excédant pas cinq millions de dinars algériens (5.000.000 DA)",
            "lang": "fr",
            "url": "https://www.mf.gov.dz/images/pdf/loidefinancecomplementaire/F2022089.pdf",
            "cite": "Journal Officiel N° 89 (29 décembre 2022), loi de finances pour 2023, art. 51"
          }
        ]
      },
      {
        "id": "years_above_ceiling",
        "text": "3",
        "evidence": [
          {
            "text": "Pour l'auto entrepreneur ayant réalisé un chiffre d'affaires annuel dépassant le seuil de 5.000.000 DA, durant trois (03) années de suite, de s'inscrire au registre du commerce, s'il souhaite poursuivre l'exercice de son activité. Dans ce cas, il sera soumis au régime fiscal approprié conformément à la législation fiscale en vigueur. (Art.14 de la loi n° 22-23 du 18 décembre 2022 portant statut de l'auto-entrepreneur - J.O.N°85)",
            "lang": "fr",
            "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu"
          },
          {
            "text": "بالنسبة للمقاول الذاتي الذي حقق رقم أعمال سنوي يتجاوز عتبة 5.000.000 دج، خلال ثلاث (03) سنوات متتالية، يجب عليه التسجيل في السجل التجاري، إذا كان يرغب في مواصلة ممارسة نشاطه. في هذه الحالة، يخضع للنظام الضريبي المناسب وفقًا للتشريع الضريبي المعمول به. (المادة 14 من القانون رقم 22-23 المؤرخ في 18 ديسمبر سنة 2022 - الجريدة الرسمية رقم 85)",
            "lang": "ar",
            "url": "https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar"
          },
          {
            "text": "En cas de dépassement du chiffre d’affaires annuel défini par la législation en vigueur durant trois (3) années de suite, l’auto-entrepreneur est tenu de s’inscrire au registre du commerce, s’il souhaite poursuivre l’exercice de son activité.",
            "lang": "fr",
            "url": "https://www.joradp.dz/FTP/JO-FRANCAIS/2022/F2022085.pdf",
            "cite": "Journal Officiel N° 85 (19 décembre 2022), loi n° 22-23 portant statut de l'auto-entrepreneur, art. 13 (la page de la DGI cite l'art. 14)"
          }
        ]
      }
    ]
  }$json$::jsonb,
  'https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu',
  'www.mfdgi.gov.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'tax.ifu.auto_entrepreneur.payment',
  $json${
    "name": {
      "ar": "الضريبة الجزافية الوحيدة (IFU): التصريح التقديري والدفع",
      "en": "Single flat-rate tax (IFU): the provisional declaration and payment"
    },
    "description": {
      "ar": "يكتتب المكلف التصريح التقديري برقم أعماله (سلسلة ج رقم 12) في أجل أقصاه 30 جوان من كل سنة، ويدفع الضريبة بإحدى طريقتين: الدفع الكلي عند إيداع التصريح، أو الدفع بالأقساط: 50% عند إيداعه، و25% من 1 إلى 15 سبتمبر، و25% من 1 إلى 15 ديسمبر. من لم يكتتب التصريح في أجله يفقد الدفع بالأقساط. المستورد المصغر بصفة مقاول ذاتي يدفع الضريبة لدى مصالح الجمارك.",
      "en": "The taxpayer files the provisional declaration of turnover (series G no. 12) by 30 June of each year and pays the tax in one of two ways: in full when filing, or by instalments: 50% when filing, 25% from 1 to 15 September and 25% from 1 to 15 December. A taxpayer who misses the filing deadline loses the instalment option. A micro-importer working as an auto-entrepreneur pays the tax at customs."
    },
    "figures": [
      {
        "id": "provisional_declaration_deadline",
        "text": "30 juin",
        "evidence": [
          {
            "text": "Lors du dépôt de la déclaration prévisionnelle (G n°12) (au plus tard le 30 juin de chaque année), les contribuables procèdent au paiement total de l'impôt forfaitaire unique correspondant au chiffre d'affaires prévisionnel déclaré.",
            "lang": "fr",
            "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu"
          },
          {
            "text": "عند تقديم التصريح التقديري ج رقم 12 (في أجل لا يتجاوز 30 جوان من كل سنة)، يقوم المكلفون بالضريبة بدفع إجمالي الضريبة الجزافية الوحيدة الموافقة لرقم الأعمال التقديري المصرح به لدى قابض الضرائب الذي يتبعه مكان ممارسة النشاط.",
            "lang": "ar",
            "url": "https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar"
          }
        ]
      },
      {
        "id": "instalments",
        "text": "50% + 25% + 25%",
        "evidence": [
          {
            "text": "Dans ce cas, ils doivent s'acquitter, lors du dépôt de la déclaration prévisionnelle (G n°12) (au plus tard le 30 juin de chaque année), de 50% du montant de l'impôt forfaitaire unique (IFU).",
            "lang": "fr",
            "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu"
          },
          {
            "text": "25%, du 1er au 15 septembre",
            "lang": "fr",
            "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu"
          },
          {
            "text": "25%, du 1er au 15 décembre.",
            "lang": "fr",
            "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu"
          },
          {
            "text": "في هذه الحالة، يتعين عليهم دفع عند إيداع التصريح التقديري \"ج رقم 12\" (في أجل لا يتجاوز 30 جوان من كل سنة)، 50% من مبلغ الضريبة الجزافية الوحيدة.",
            "lang": "ar",
            "url": "https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar"
          }
        ]
      }
    ]
  }$json$::jsonb,
  'https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu',
  'www.mfdgi.gov.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'tax.ifu.auto_entrepreneur.minimum',
  $json${
    "name": {
      "ar": "الضريبة الجزافية الوحيدة (IFU): الحد الأدنى للمقاول الذاتي",
      "en": "Single flat-rate tax (IFU): the minimum for auto-entrepreneurs"
    },
    "description": {
      "ar": "لا يقل مبلغ الضريبة الجزافية الوحيدة عن 30.000 دج عن كل سنة، ويُحدَّد هذا الحد بـ 10.000 دج للأنشطة الممارسة تحت صفة المقاول الذاتي. ويُدفع الحد الأدنى كاملًا في أجل أقصاه 30 جوان من السنة المعنية.",
      "en": "The single flat-rate tax cannot be less than 30,000 DA for a year; for activities carried out under the auto-entrepreneur status that minimum is fixed at 10,000 DA. The minimum is paid in full by 30 June of the year concerned."
    },
    "figures": [
      {
        "id": "minimum_auto_entrepreneur",
        "text": "10.000 DA",
        "evidence": [
          {
            "text": "Sauf pour les activités exercées sous le statut d'auto entrepreneur, ce montant est fixé à 10.000 DA.",
            "lang": "fr",
            "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu"
          },
          {
            "text": "باستثناء الأنشطة الممارسة تحت صفة المقاول الذاتي، يُحدد هذا المبلغ بـ 10.000 دج.",
            "lang": "ar",
            "url": "https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar"
          },
          {
            "text": "Toutefois, pour les activités exercées sous le statut d’autoentrepreneur, ce montant est fixé à 10.000 DA.",
            "lang": "fr",
            "url": "https://www.mf.gov.dz/images/pdf/loidefinance/Loi_de_finance_2025_FR.pdf",
            "cite": "Journal Officiel N° 84 (26 décembre 2024), loi de finances pour 2025, art. 29 (art. 365 bis du CIDTA)"
          }
        ]
      },
      {
        "id": "minimum_general",
        "text": "30.000 DA",
        "evidence": [
          {
            "text": "Le montant de l'IFU ne peut être inférieur à 30.000 DA.",
            "lang": "fr",
            "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu"
          },
          {
            "text": "Le montant dû au titre de l’impôt forfaitaire unique ne peut être inférieur, pour chaque exercice et quel que soit le chiffre d’affaires imposable, à 30.000 DA.",
            "lang": "fr",
            "url": "https://www.mf.gov.dz/images/pdf/loidefinance/Loi_de_finance_2025_FR.pdf",
            "cite": "Journal Officiel N° 84 (26 décembre 2024), loi de finances pour 2025, art. 29 (art. 365 bis du CIDTA)"
          }
        ]
      },
      {
        "id": "payment_deadline",
        "text": "30 juin",
        "evidence": [
          {
            "text": "Le minimum d’imposition doit être acquitté intégralement au plus tard le 30 juin de l’année concernée.",
            "lang": "fr",
            "url": "https://www.mf.gov.dz/images/pdf/loidefinance/Loi_de_finance_2025_FR.pdf",
            "cite": "Journal Officiel N° 84 (26 décembre 2024), loi de finances pour 2025, art. 29 (art. 365 bis du CIDTA)"
          }
        ]
      }
    ],
    "note": {
      "ar": "صياغة صفحة المديرية العامة للضرائب مختصرة (باستثناء الأنشطة الممارسة تحت صفة المقاول الذاتي، يُحدد هذا المبلغ بـ 10.000 دج)؛ ونص المادة 29 من قانون المالية 2025 في الجريدة الرسمية واضح: 30.000 دج عامةً و10.000 دج للمقاول الذاتي.",
      "en": "The wording on the tax directorate's page is elliptical; the text of article 29 of the 2025 finance law in the Journal Officiel is clear: 30,000 DA in general and 10,000 DA for auto-entrepreneurs."
    }
  }$json$::jsonb,
  'https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu',
  'www.mfdgi.gov.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'tax.ifu.coverage',
  $json${
    "name": {
      "ar": "ما تشمله الضريبة الجزافية الوحيدة (IFU)",
      "en": "What the single flat-rate tax (IFU) covers"
    },
    "description": {
      "ar": "الضريبة الجزافية الوحيدة ضريبة مبسطة تجمع الرسم المحلي للتضامن (TLS) والرسم على القيمة المضافة (TVA) والضريبة على الدخل الإجمالي (IRG).",
      "en": "The single flat-rate tax is a simplified tax that groups the local solidarity tax (TLS), value added tax (VAT) and the overall income tax (IRG)."
    },
    "evidence": [
      {
        "text": "L'impôt forfaitaire unique « IFU » est un impôt simplifié qui regroupe la taxe Locale de Solidarité (TLS), la taxe sur la valeur ajoutée (TVA) et l'impôt sur le revenu global (IRG). (Art. 282bis du CIDTA/ Art. 79LF/2024)",
        "lang": "fr",
        "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu"
      },
      {
        "text": "الضريبة الجزافية الوحيدة هي ضريبة مبسطة تجمع ما بين الرسم المحلي للتضامن (TLS) والرسم على القيمة المضافة (TVA) والضريبة على الدخل الإجمالي (IRG). (المادة 282 مكرر من قانون الضرائب المباشرة والرسوم المماثلة/ المادة 79 ق.م 2024)",
        "lang": "ar",
        "url": "https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar"
      }
    ]
  }$json$::jsonb,
  'https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu',
  'www.mfdgi.gov.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'registration.commercial_register.body',
  $json${
    "name": {
      "ar": "المركز الوطني للسجل التجاري (CNRC)",
      "en": "National Centre of the Commercial Register (CNRC)"
    },
    "description": {
      "ar": "يتم التسجيل في السجل التجاري لدى المركز الوطني للسجل التجاري، وللأشخاص الطبيعيين استمارة وطلب وثائق يوضحها موقع المركز، ويمكن بدء التسجيل عبر بوابته على الإنترنت. من شروط الشخص الطبيعي التمتع بالأهلية القانونية والحقوق المدنية، ولا يمارس القاصر غير المرشَّد التجارة.",
      "en": "Registration in the commercial register is made with the National Centre of the Commercial Register; for individuals, the Centre's site lists an application form and required documents, and registration can be started on its web portal. For an individual, the conditions include legal capacity and civil rights, and an unemancipated minor cannot carry out trade."
    },
    "evidence": [
      {
        "text": "They should enjoy their legal capacity and civil rights.",
        "lang": "en",
        "url": "https://sidjilcom.cnrc.dz/en/web/sidjilcom/-/conditions-et-modalites/2.6"
      },
      {
        "text": "The unemancipated minor cannot carry out trade.",
        "lang": "en",
        "url": "https://sidjilcom.cnrc.dz/en/web/sidjilcom/-/conditions-et-modalites/2.6"
      },
      {
        "text": "A signed application form provided by the National Center of the Trade Register ;",
        "lang": "en",
        "url": "https://sidjilcom.cnrc.dz/en/web/sidjilcom/-/dossier-a-fournir/1.8"
      }
    ],
    "url": "https://sidjilcom.cnrc.dz/"
  }$json$::jsonb,
  'https://sidjilcom.cnrc.dz/en/web/sidjilcom/-/conditions-et-modalites/2.6',
  'sidjilcom.cnrc.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'social_security.registration.body',
  $json${
    "name": {
      "ar": "الصندوق الوطني للضمان الاجتماعي لغير الأجراء (CASNOS)",
      "en": "National Social Security Fund for Non-Salaried Workers (CASNOS)"
    },
    "description": {
      "ar": "على من يمارس لحسابه الخاص نشاطاً مهنياً أو تجارياً أو حرفياً أو حراً، ومنهم المقاول الذاتي، أن يوجّه إلى الصندوق تصريحاً بالنشاط في أجل أقصاه عشرة أيام من بداية النشاط. الصندوق مرتبط بالوكالة الوطنية للمقاول الذاتي ويستقي بيانات المقاول الذاتي منها.",
      "en": "A person working on their own account in a professional, commercial, craft or liberal activity, including an auto-entrepreneur, must send the Fund a declaration of activity within ten days of starting. The Fund is linked to the National Agency for the Auto-Entrepreneur and takes the auto-entrepreneur's details from it."
    },
    "figures": [
      {
        "id": "affiliation_deadline_days",
        "text": "10",
        "evidence": [
          {
            "text": "Les personnes exerçant pour leur propre compte une activité professionnelle, industrielle, commerciale, agricole, artisanale, auto-entrepreneur, libérale ou dans toute autre branche ou secteur d’activité sont tenues d’adresser à la caisse une déclaration d’activité dans les dix (10) jours qui suivent le début d’exercice de l’activité, munies du dossier suivant, selon l’activité exercée :",
            "lang": "fr",
            "url": "https://www.casnos.dz/affiliation"
          }
        ]
      }
    ],
    "evidence": [
      {
        "text": "La CASNOS est reliée à l’ANAE (Agence nationale de l’auto-entrepreneur) et récupère directement vos informations auprès de l’Agence.",
        "lang": "fr",
        "url": "https://www.casnos.dz/affiliation"
      }
    ]
  }$json$::jsonb,
  'https://www.casnos.dz/affiliation',
  'www.casnos.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'tax.registration.body',
  $json${
    "name": {
      "ar": "المديرية العامة للضرائب (DGI)",
      "en": "General Directorate of Taxes (DGI)"
    },
    "description": {
      "ar": "يكتتب المكلف الخاضع للضريبة الجزافية الوحيدة تصريحاً بالوجود لدى مفتشية الضرائب أو مركز الجواري للضرائب (CPI) التابع له، في غضون ثلاثين يوماً من بداية النشاط.",
      "en": "A taxpayer under the single flat-rate tax files a declaration of existence with the tax inspection or the proximity tax centre (CPI) they depend on, within thirty days of starting the activity."
    },
    "figures": [
      {
        "id": "existence_declaration_days",
        "text": "30",
        "evidence": [
          {
            "text": "Les contribuables doivent souscrire une déclaration d'existence, dans les trente (30) jours du début de leur activité auprès de l'inspection des impôts ou du centre de proximité des impôts (CPI) dont ils dépendent.",
            "lang": "fr",
            "url": "https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu"
          },
          {
            "text": "يتعين على المكلفين بالضريبة اكتتاب التصريح بالوجود، في غضون ثلاثين (30) يوما من بداية نشاطهم مع مفتشية الضرائب أو مركز الجواري للضرائب (CPI) التابعين لهم.",
            "lang": "ar",
            "url": "https://www.mfdgi.gov.dz/professionnels-ar/identifier-regime-fiscal-ar/regime-forfaitaire-unique-ar/ifu-ar"
          }
        ]
      }
    ]
  }$json$::jsonb,
  'https://www.mfdgi.gov.dz/fr/professionnels/services-pro/regime-forfaitaire-unique/ifu',
  'www.mfdgi.gov.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'data.statistics',
  $json${
    "name": {
      "ar": "الديوان الوطني للإحصائيات (ONS)",
      "en": "National Office of Statistics (ONS)"
    },
    "description": {
      "ar": "المصدر الرسمي للإحصاءات: مؤشرات الأسعار والحسابات الوطنية ومؤشرات التجارة الخارجية والمنشورات.",
      "en": "The official source of statistics: price indices, national accounts, foreign trade indices and publications."
    }
  }$json$::jsonb,
  'https://www.ons.dz/',
  'www.ons.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'data.central_bank',
  $json${
    "name": {
      "ar": "بنك الجزائر",
      "en": "Bank of Algeria"
    },
    "description": {
      "ar": "المصدر الرسمي للإحصائيات النقدية والمصرفية وسعر صرف الدينار الجزائري والمنشورات.",
      "en": "The official source of monetary and banking statistics, the dinar exchange rate and publications."
    }
  }$json$::jsonb,
  'https://www.bank-of-algeria.dz/',
  'www.bank-of-algeria.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'currency.main',
  $json${
    "name": {
      "ar": "الدينار الجزائري",
      "en": "Algerian dinar"
    },
    "description": {
      "ar": "ينشر بنك الجزائر سعر صرف الدينار الجزائري مقابل العملات الرئيسية في سوق الصرف بين البنوك.",
      "en": "The Bank of Algeria publishes the exchange rate of the Algerian dinar against the main currencies on the interbank foreign exchange market."
    },
    "code": "DZD",
    "evidence": [
      {
        "text": "Cette rubrique comporte le cours du dinar algérien contre les principales devises sur le marché interbancaire des changes.",
        "lang": "fr",
        "url": "https://www.bank-of-algeria.dz/taux-de-change-3/"
      }
    ]
  }$json$::jsonb,
  'https://www.bank-of-algeria.dz/taux-de-change-3/',
  'www.bank-of-algeria.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;

insert into public.country_pack_items
  (country_code, key, value, source_url, source_domain, last_verified, status)
values (
  'DZ',
  'official.tax_authority',
  $json${
    "name": {
      "ar": "المديرية العامة للضرائب",
      "en": "General Directorate of Taxes"
    },
    "description": {
      "ar": "الموقع الرسمي للمديرية العامة للضرائب في الجزائر.",
      "en": "The official site of the General Directorate of Taxes in Algeria."
    },
    "url": "https://www.mfdgi.gov.dz/"
  }$json$::jsonb,
  'https://www.mfdgi.gov.dz/',
  'www.mfdgi.gov.dz',
  '2026-10-12',
  'verified'
)
on conflict (country_code, key) do nothing;
