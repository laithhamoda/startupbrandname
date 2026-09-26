import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
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
import { currentLocale } from '@/i18n/locale';
import { galleryContent } from './content';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return { title: galleryContent[locale].title, robots: { index: false, follow: false } };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-hairline py-10">
      <h2 className="text-h2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

// Internal page for design review, visual snapshots and accessibility checks. Hidden in production.
export default async function DesignGalleryPage() {
  if (getServerEnv().VERCEL_ENV === 'production') notFound();
  const c = galleryContent[await currentLocale()];
  const money = await getTranslations('money');

  return (
    <div className="mx-auto max-w-[75rem] px-4 py-10 sm:px-6">
      <h1 className="text-h1 font-extrabold">{c.title}</h1>
      <p className="reading mt-2 text-muted">{c.lead}</p>

      <Section title={c.sections.type}>
        <div className="grid gap-4">
          <p className="font-display text-display font-extrabold">
            {c.type.display} <bdi className="num">14</bdi>
          </p>
          <p className="font-display text-h1 font-bold">{c.type.h1}</p>
          <p className="font-display text-h2 font-bold">{c.type.h2}</p>
          <p className="font-display text-h3 font-semibold">{c.type.h3}</p>
          <p className="reading text-body-lg">
            {c.type.lead} <Money value="4.200" currency="JOD" />.
          </p>
          <p>{c.type.body}</p>
          <p className="text-small font-medium">{c.type.small}</p>
          <p className="text-caption text-muted">{c.type.caption}</p>
        </div>
      </Section>

      <Section title={c.sections.buttons}>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">{c.buttons.primary}</Button>
          <Button>{c.buttons.secondary}</Button>
          <Button variant="quiet">{c.buttons.quiet}</Button>
          <Button disabled>{c.buttons.disabled}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <TextLink href="/">{c.buttons.home}</TextLink>
          <TextLink href="/" className="inline-flex items-center gap-1">
            {c.buttons.next}
            {/* Directional icon: mirrors in RTL so it points to the next step. */}
            <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
          </TextLink>
        </div>
      </Section>

      <Section title={c.sections.fields}>
        <div className="grid max-w-xl gap-6">
          <Field id="idea" label={c.fields.ideaLabel} hint={c.fields.ideaHint}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="idea"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                defaultValue={c.fields.ideaValue}
              />
            )}
          </Field>
          <Field id="customer" label={c.fields.customerLabel} error={c.fields.customerError}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="customer"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                defaultValue={c.fields.customerValue}
              />
            )}
          </Field>
          <MoneyField
            id="price"
            name="price"
            label={c.fields.priceLabel}
            hint={c.fields.priceHint}
            defaultAmount="4.500"
          />
          <SelectField
            id="scope"
            name="scope"
            label={c.fields.scopeLabel}
            placeholder={c.fields.scopePlaceholder}
            options={Object.entries(c.fields.scopeOptions).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <RadioGroup
            name="goal"
            label={c.fields.goalLabel}
            defaultValue="main"
            options={Object.entries(c.fields.goalOptions).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Checkbox id="crossborder" name="crossborder" label={c.fields.crossborder} />
        </div>
      </Section>

      <Section title={c.sections.overlays}>
        <Tabs
          label={c.overlays.tabsLabel}
          tabs={[
            { value: 'bmc', title: c.overlays.bmcTitle, content: <p>{c.overlays.bmcBody}</p> },
            { value: 'lean', title: 'Lean Canvas', content: <p>{c.overlays.leanBody}</p> },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip content={c.overlays.tooltip}>
            <Button>{c.overlays.tooltipButton}</Button>
          </Tooltip>
          <Dialog
            trigger={<Button>{c.overlays.dialogButton}</Button>}
            title={c.overlays.dialogTitle}
            description={c.overlays.dialogDescription}
          >
            <p>{c.overlays.dialogBody}</p>
          </Dialog>
          <Drawer
            trigger={<Button>{c.overlays.drawerButton}</Button>}
            title={c.overlays.drawerTitle}
          >
            <p>
              {c.overlays.drawerBefore} <Money value="3.200" currency="JOD" />
              {c.overlays.drawerAfter}
            </p>
          </Drawer>
        </div>
      </Section>

      <Section title={c.sections.progress}>
        <div className="grid max-w-xl gap-4">
          <Progress value={46} label={c.progress.label} />
        </div>
        <NumericTable
          caption={c.progress.caption}
          columns={[
            { key: 'item', header: c.progress.item },
            { key: 'm1', header: `${c.progress.month} 1`, numeric: true },
            { key: 'm6', header: `${c.progress.month} 6`, numeric: true },
            { key: 'm12', header: `${c.progress.month} 12`, numeric: true },
          ]}
          rows={[
            {
              id: 'revenue',
              cells: {
                item: c.progress.revenue,
                m1: <Money value="1,250.000" currency="JOD" />,
                m6: <Money value="6,480.500" currency="JOD" />,
                m12: <Money value="11,920.000" currency="JOD" />,
              },
            },
            {
              id: 'cogs',
              cells: {
                item: c.progress.cogs,
                m1: <Money value="525.000" currency="JOD" />,
                m6: <Money value="2,721.810" currency="JOD" />,
                m12: <Money value="5,006.400" currency="JOD" />,
              },
            },
            {
              id: 'cash',
              cells: {
                item: c.progress.cash,
                m1: <Money value="−2,310.000" currency="JOD" />,
                m6: <Money value="−240.300" currency="JOD" />,
                m12: <Money value="1,904.600" currency="JOD" />,
              },
            },
          ]}
        />
      </Section>

      <Section title={c.sections.sources}>
        <div className="flex flex-wrap gap-2">
          <ProvenanceTag source="user" />
          <ProvenanceTag source="assumption" />
          <ProvenanceTag source="external" />
        </div>
        <VerifyBadge lastVerified="2026-05-14" />
        <RuleAlert message={c.sources.ruleMessage}>{c.sources.ruleExample}</RuleAlert>
        <AssumptionNote />
      </Section>

      <Section title={c.sections.verdict}>
        <div className="grid gap-6 md:grid-cols-2">
          <VerdictSlab verdict={{ kind: 'revise', summary: c.verdict.revise }} />
          <VerdictSlab verdict={{ kind: 'stop', changes: c.verdict.changes }} />
        </div>
        <div className="flex flex-wrap gap-10">
          <KeyNumber label={c.verdict.funding} value="18,500" unit={money('symbol.JOD')} />
          <KeyNumber label={c.verdict.breakEven} value="14" unit={c.verdict.month} unitFirst />
          <KeyNumber label={c.verdict.profit} value="−4,200" unit={money('symbol.JOD')} />
        </div>
      </Section>
    </div>
  );
}
