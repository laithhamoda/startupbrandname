import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

// Holding page until the public site is built in milestone M2b (docs/DECISIONS.md D-054).
export default function HomePage() {
  return (
    <div className="mx-auto grid max-w-[75rem] gap-6 px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="text-display font-extrabold">حوّل فكرتك إلى نموذج عمل بأرقام محسوبة</h1>
      <p className="reading text-body-lg text-ink-2">
        المنصة قيد الإنشاء. ستوفّر تشخيصًا منظّمًا لفكرة مشروعك، وتقريرًا عربيًا بأرقام محسوبة وحكم
        واضح، ومرشدًا ذكيًا يطرح عليك الأسئلة الصعبة قبل أن يطرحها السوق.
      </p>
    </div>
  );
}
