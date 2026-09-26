import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AssumptionNote } from '@/components/ui/assumption-note';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, Drawer } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { KeyNumber } from '@/components/ui/key-number';
import { Money } from '@/components/ui/money';
import { MoneyField } from '@/components/ui/money-field';
import { NumericTable } from '@/components/ui/numeric-table';
import { Progress } from '@/components/ui/progress';
import { ProvenanceTag } from '@/components/ui/provenance-tag';
import { RadioGroup } from '@/components/ui/radio-group';
import { RuleAlert } from '@/components/ui/rule-alert';
import { SelectField } from '@/components/ui/select-field';
import { Tabs } from '@/components/ui/tabs';
import { TextInput } from '@/components/ui/text-input';
import { TextLink } from '@/components/ui/text-link';
import { Tooltip } from '@/components/ui/tooltip';
import { VerdictSlab } from '@/components/ui/verdict-slab';
import { VerifyBadge } from '@/components/ui/verify-badge';
import { getServerEnv } from '@/env/server';

export const metadata: Metadata = {
  title: 'معرض المكوّنات',
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-hairline py-10">
      <h2 className="text-h2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

// Internal page for design review, visual snapshots and accessibility checks. Hidden in production.
export default function DesignGalleryPage() {
  if (getServerEnv().VERCEL_ENV === 'production') notFound();

  return (
    <div className="mx-auto max-w-[75rem] px-4 py-10 sm:px-6">
      <h1 className="text-h1 font-extrabold">معرض المكوّنات</h1>
      <p className="reading mt-2 text-muted">
        كل عنصر هنا مبني بالرموز المعتمدة في خطة التصميم، ويُصوَّر ويُفحص تلقائيًا في الوضعين.
      </p>

      <Section title="الخطوط">
        <div className="grid gap-4">
          <p className="font-display text-display font-extrabold">
            نقطة التعادل في الشهر <bdi className="num">14</bdi>
          </p>
          <p className="font-display text-h1 font-bold">الملخص التنفيذي</p>
          <p className="font-display text-h2 font-bold">التسعير واقتصاديات الوحدة</p>
          <p className="font-display text-h3 font-semibold">المحور F: الأرقام</p>
          <p className="reading text-body-lg">
            تغطي المبيعات المتوقعة التكاليف الثابتة ابتداءً من الشهر الرابع عشر، بشرط ألا تزيد تكلفة
            الوحدة عن <Money value="4.200" currency="JOD" />.
          </p>
          <p>صف فكرتك في جملة واحدة: ماذا تقدّم، ولمن، ولماذا؟</p>
          <p className="text-small font-medium">محفوظ تلقائيًا قبل دقيقة</p>
          <p className="text-caption text-muted">أصغر حجم مسموح به للعربية في الواجهة</p>
        </div>
      </Section>

      <Section title="الأزرار والروابط">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">ابدأ التشخيص</Button>
          <Button>احفظ وتابع لاحقًا</Button>
          <Button variant="quiet">لا أعرف</Button>
          <Button disabled>غير متاح</Button>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <TextLink href="/">الصفحة الرئيسية</TextLink>
          <TextLink href="/" className="inline-flex items-center gap-1">
            التالي
            {/* Directional icon: mirrors in RTL so it points to the next step. */}
            <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
          </TextLink>
        </div>
      </Section>

      <Section title="الحقول">
        <div className="grid max-w-xl gap-6">
          <Field id="idea" label="صف فكرتك في جملة واحدة" hint="40 كلمة على الأكثر.">
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="idea"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                defaultValue="غداء منزلي صحي للأمهات العاملات في عمّان"
              />
            )}
          </Field>
          <Field
            id="customer"
            label="من يدفع لك؟"
            error="الإجابة «الجميع» واسعة جدًا. حدّد أول 10 عملاء."
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="customer"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                defaultValue="الجميع"
              />
            )}
          </Field>
          <MoneyField
            id="price"
            name="price"
            label="سعر البيع للوحدة"
            hint="اكتب السعر الذي تبيع به اليوم."
            defaultAmount="4.500"
          />
          <SelectField
            id="scope"
            name="scope"
            label="النطاق الجغرافي في السنة الأولى"
            placeholder="اختر النطاق"
            options={[
              { value: 'neighbourhood', label: 'الحي' },
              { value: 'city', label: 'المدينة' },
              { value: 'country', label: 'الدولة' },
            ]}
          />
          <RadioGroup
            name="goal"
            label="ما هدفك من المشروع؟"
            defaultValue="main"
            options={[
              { value: 'side', label: 'دخل إضافي' },
              { value: 'main', label: 'دخل رئيسي' },
              { value: 'scale', label: 'شركة قابلة للنمو' },
            ]}
          />
          <Checkbox
            id="crossborder"
            name="crossborder"
            label="أوافق على معالجة بياناتي لدى مزوّدي الخدمة خارج بلدي كما هو موضّح في سياسة الخصوصية."
          />
        </div>
      </Section>

      <Section title="التبويبات والتلميحات والنوافذ">
        <Tabs
          label="عرض اللوحة"
          tabs={[
            {
              value: 'bmc',
              title: 'نموذج العمل',
              content: <p>لوحة نموذج العمل بخلاياها التسع.</p>,
            },
            {
              value: 'lean',
              title: 'Lean Canvas',
              content: <p>اللوحة المختصرة للمشاريع الناشئة.</p>,
            },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip content="نقطة التعادل: الشهر الذي تغطي فيه الإيرادات كل التكاليف.">
            <Button>ما نقطة التعادل؟</Button>
          </Tooltip>
          <Dialog
            trigger={<Button>افتح نافذة</Button>}
            title="احفظ وتابع لاحقًا"
            description="ستجد إجاباتك محفوظة عند عودتك."
          >
            <p>يمكنك إغلاق الصفحة الآن.</p>
          </Dialog>
          <Drawer trigger={<Button>اسأل المرشد</Button>} title="المرشد">
            <p>
              حسب إجابتك في F3، تكلفة الوحدة <Money value="3.200" currency="JOD" />. ما الذي يمنع
              منافسك من البيع بسعر أقل غدًا؟
            </p>
          </Drawer>
        </div>
      </Section>

      <Section title="التقدّم والجداول">
        <div className="grid max-w-xl gap-4">
          <Progress value={46} label="اكتمال التشخيص" />
        </div>
        <NumericTable
          caption="التدفق النقدي (مثال)"
          columns={[
            { key: 'item', header: 'البند' },
            { key: 'm1', header: 'الشهر 1', numeric: true },
            { key: 'm6', header: 'الشهر 6', numeric: true },
            { key: 'm12', header: 'الشهر 12', numeric: true },
          ]}
          rows={[
            {
              id: 'revenue',
              cells: {
                item: 'الإيرادات',
                m1: <Money value="1,250.000" currency="JOD" />,
                m6: <Money value="6,480.500" currency="JOD" />,
                m12: <Money value="11,920.000" currency="JOD" />,
              },
            },
            {
              id: 'cogs',
              cells: {
                item: 'تكلفة البضاعة',
                m1: <Money value="525.000" currency="JOD" />,
                m6: <Money value="2,721.810" currency="JOD" />,
                m12: <Money value="5,006.400" currency="JOD" />,
              },
            },
            {
              id: 'cash',
              cells: {
                item: 'صافي التدفق النقدي',
                m1: <Money value="−2,310.000" currency="JOD" />,
                m6: <Money value="−240.300" currency="JOD" />,
                m12: <Money value="1,904.600" currency="JOD" />,
              },
            },
          ]}
        />
      </Section>

      <Section title="المصادر والتنبيهات">
        <div className="flex flex-wrap gap-2">
          <ProvenanceTag source="user" />
          <ProvenanceTag source="assumption" />
          <ProvenanceTag source="external" />
        </div>
        <VerifyBadge lastVerified="2026-05-14" />
        <RuleAlert message="المشروع الذي يستهدف الجميع لا يصل إلى أحد.">
          من أول 10 عملاء سيدفعون لك؟ مثال: أمهات عاملات في عمّان، بين 28 و40 سنة.
        </RuleAlert>
        <AssumptionNote />
      </Section>

      <Section title="الحكم والأرقام الأساسية">
        <div className="grid gap-6 md:grid-cols-2">
          <VerdictSlab
            verdict={{
              kind: 'revise',
              summary: 'المشروع قابل للتنفيذ بعد خفض تكلفة الوحدة وتأجيل التوظيف الأول.',
            }}
          />
          <VerdictSlab
            verdict={{
              kind: 'stop',
              changes: [
                'خفض تكلفة الوحدة إلى أقل من سعر البيع.',
                'تحديد شريحة عملاء أضيق من «الجميع».',
                'تأمين رأس مال يغطي ستة أشهر من التكاليف الثابتة.',
              ],
            }}
          />
        </div>
        <div className="flex flex-wrap gap-10">
          <KeyNumber label="الحاجة إلى التمويل" value="18,500" unit="د.أ" />
          <KeyNumber label="نقطة التعادل (Break-even)" value="14" unit="الشهر" unitFirst />
          <KeyNumber label="ربح السنة الأولى" value="−4,200" unit="د.أ" />
        </div>
      </Section>
    </div>
  );
}
