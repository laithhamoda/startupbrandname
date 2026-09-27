import type { Option, Text } from './types';

function option(value: string, ar: string, en: string): Option {
  return { value, label: { ar, en } };
}

/**
 * Sectors: ISIC Rev.4 sections (D-106), without O (public administration), T (households as
 * employers) and U (extraterritorial bodies), which no founder starts.
 */
export const SECTORS: readonly Option[] = [
  option('A', 'الزراعة والحراجة وصيد الأسماك', 'Agriculture, forestry and fishing'),
  option('B', 'التعدين واستغلال المحاجر', 'Mining and quarrying'),
  option('C', 'الصناعة التحويلية', 'Manufacturing'),
  option(
    'D',
    'إمدادات الكهرباء والغاز والبخار وتكييف الهواء',
    'Electricity, gas, steam and air conditioning supply',
  ),
  option(
    'E',
    'إمدادات المياه والصرف الصحي وإدارة النفايات ومعالجتها',
    'Water supply, sewerage, waste management and remediation',
  ),
  option('F', 'التشييد', 'Construction'),
  option(
    'G',
    'تجارة الجملة والتجزئة وإصلاح المركبات',
    'Wholesale and retail trade; repair of vehicles',
  ),
  option('H', 'النقل والتخزين', 'Transportation and storage'),
  option('I', 'أنشطة الإقامة والخدمات الغذائية', 'Accommodation and food service activities'),
  option('J', 'المعلومات والاتصالات', 'Information and communication'),
  option('K', 'الأنشطة المالية وأنشطة التأمين', 'Financial and insurance activities'),
  option('L', 'الأنشطة العقارية', 'Real estate activities'),
  option(
    'M',
    'الأنشطة المهنية والعلمية والتقنية',
    'Professional, scientific and technical activities',
  ),
  option(
    'N',
    'أنشطة الخدمات الإدارية وخدمات الدعم',
    'Administrative and support service activities',
  ),
  option('P', 'التعليم', 'Education'),
  option('Q', 'أنشطة الصحة البشرية والعمل الاجتماعي', 'Human health and social work activities'),
  option('R', 'الفنون والترفيه والتسلية', 'Arts, entertainment and recreation'),
  option('S', 'أنشطة الخدمات الأخرى', 'Other service activities'),
];

export const AGE_BANDS: readonly Option[] = [
  option('under_18', 'أقل من 18', 'Under 18'),
  option('18_24', 'من 18 إلى 24', '18 to 24'),
  option('25_34', 'من 25 إلى 34', '25 to 34'),
  option('35_44', 'من 35 إلى 44', '35 to 44'),
  option('45_54', 'من 45 إلى 54', '45 to 54'),
  option('55_64', 'من 55 إلى 64', '55 to 64'),
  option('65_plus', '65 فأكثر', '65 and over'),
];

/** Relative to the customer's own country: no amounts, so nothing to go stale. */
export const INCOME_BANDS: readonly Option[] = [
  option('low', 'منخفض', 'Low'),
  option('lower_middle', 'أدنى من المتوسط', 'Lower middle'),
  option('middle', 'متوسط', 'Middle'),
  option('upper_middle', 'أعلى من المتوسط', 'Upper middle'),
  option('high', 'مرتفع', 'High'),
];

/** Business size by number of employees. */
export const COMPANY_SIZES: readonly Option[] = [
  option('micro', 'متناهية الصغر (1 إلى 9 موظفين)', 'Micro (1 to 9 employees)'),
  option('small', 'صغيرة (10 إلى 49 موظفًا)', 'Small (10 to 49 employees)'),
  option('medium', 'متوسطة (50 إلى 249 موظفًا)', 'Medium (50 to 249 employees)'),
  option('large', 'كبيرة (250 موظفًا فأكثر)', 'Large (250 employees or more)'),
];

export const MONTHS: readonly Text[] = [
  { ar: 'يناير', en: 'January' },
  { ar: 'فبراير', en: 'February' },
  { ar: 'مارس', en: 'March' },
  { ar: 'أبريل', en: 'April' },
  { ar: 'مايو', en: 'May' },
  { ar: 'يونيو', en: 'June' },
  { ar: 'يوليو', en: 'July' },
  { ar: 'أغسطس', en: 'August' },
  { ar: 'سبتمبر', en: 'September' },
  { ar: 'أكتوبر', en: 'October' },
  { ar: 'نوفمبر', en: 'November' },
  { ar: 'ديسمبر', en: 'December' },
];

export { option };
