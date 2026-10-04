/**
 * The text of app/global-error.tsx, which cannot use next-intl (the root layout failed) and is
 * loaded on every page, so importing the catalogues would ship them all to every visitor.
 * The source of truth stays messages/*.json (`errors`); global-error.test.ts checks each string.
 */
export const GLOBAL_ERROR_TEXT = {
  ar: {
    title: 'حدث خطأ غير متوقّع',
    body: 'تعذّر عرض هذه الصفحة. كل ما حفظته في أمان. حاول مرة أخرى، أو عُد بعد دقائق.',
    retry: 'حاول مرة أخرى',
    home: 'العودة إلى الصفحة الرئيسية',
    reference: 'رقم المرجع:',
  },
  en: {
    title: 'Something went wrong',
    body: 'This page could not be shown. Everything you saved is safe. Try again, or come back in a few minutes.',
    retry: 'Try again',
    home: 'Back to the home page',
    reference: 'Reference:',
  },
} as const;
