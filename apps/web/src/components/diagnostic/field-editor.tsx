'use client';

import {
  AGE_BANDS,
  COMPANY_SIZES,
  type Field,
  INCOME_BANDS,
  type Language,
  MONTHS,
  type Option,
  readNumber,
  SECTORS,
} from '@sbn/question-bank';
import { Plus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { controlClass } from '@/components/ui/text-input';
import { cn } from '@/lib/cn';
import type { CurrencyOptions } from '@/lib/diagnostic/currencies';
import type { Draft, DraftByKind, MoneyDraft } from '@/lib/diagnostic/draft';
import { CheckboxGroup, ChoiceGroup } from './choices';

export interface EditorOptions {
  countries: readonly { value: string; label: string }[];
  currencies: CurrencyOptions;
  /** The project's currency, the default for new amount rows (chosen by the founder, D-111). */
  currency: string;
  /** C1's answer: which parts of the customer profile (C2) apply. */
  payer?: string;
}

interface FieldEditorProps {
  id: string;
  /** The question heading, which labels single-control answers. */
  labelledBy: string;
  describedBy?: string;
  field: Field;
  draft: Draft;
  onChange: (draft: Draft) => void;
  /** Number boxes whose text could not be read, by path ("items.1.amount"). */
  unreadable: readonly string[];
  options: EditorOptions;
}

const labelClass = 'text-caption font-bold text-ink-2';
const numberClass = cn(controlClass, 'num text-end');

function Labelled({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TextBox({
  id,
  value,
  onChange,
  multiline = 0,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Rows for a text area; 0 for a single line. */
  multiline?: number;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}) {
  return multiline > 0 ? (
    <textarea
      id={id}
      rows={multiline}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={cn(controlClass, 'leading-relaxed')}
      {...aria}
    />
  ) : (
    <input
      id={id}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={controlClass}
      {...aria}
    />
  );
}

function NumberBox({
  id,
  value,
  onChange,
  invalid,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}) {
  return (
    <input
      id={id}
      value={value}
      inputMode="decimal"
      dir="ltr"
      autoComplete="off"
      aria-invalid={invalid || undefined}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={numberClass}
      {...aria}
    />
  );
}

function OptionSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder: string;
  'aria-labelledby'?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={controlClass}
      {...aria}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function CurrencySelect({
  id,
  value,
  onChange,
  currencies,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  currencies: CurrencyOptions;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}) {
  const t = useTranslations('diagnostic.widgets');
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={controlClass}
      {...aria}
    >
      <option value="" disabled>
        {t('chooseCurrency')}
      </option>
      <optgroup label={t('commonCurrencies')}>
        {currencies.common.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('allCurrencies')}>
        {currencies.others.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function MoneyBoxes({
  id,
  money,
  onChange,
  invalid,
  currencies,
  amountLabel,
}: {
  id: string;
  money: MoneyDraft;
  onChange: (money: MoneyDraft) => void;
  invalid: boolean;
  currencies: CurrencyOptions;
  amountLabel: string;
}) {
  const t = useTranslations('diagnostic.widgets');
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
      <Labelled id={`${id}-amount`} label={amountLabel}>
        <NumberBox
          id={`${id}-amount`}
          value={money.amount}
          invalid={invalid}
          onChange={(amount) => {
            onChange({ ...money, amount });
          }}
        />
      </Labelled>
      <Labelled id={`${id}-currency`} label={t('currency')}>
        <CurrencySelect
          id={`${id}-currency`}
          value={money.currency}
          currencies={currencies}
          onChange={(currency) => {
            onChange({ ...money, currency });
          }}
        />
      </Labelled>
    </div>
  );
}

/** A list of rows the founder can add to and remove from, each a group named by its title. */
function Rows<T>({
  id,
  items,
  onChange,
  empty,
  minItems,
  title,
  render,
}: {
  id: string;
  items: readonly T[];
  onChange: (items: T[]) => void;
  empty: () => T;
  minItems: number;
  title: (index: number) => string;
  render: (item: T, update: (item: T) => void, rowId: string, index: number) => ReactNode;
}) {
  const t = useTranslations('diagnostic.widgets');
  return (
    <div className="grid gap-4">
      {items.length === 0 ? <p className="text-small text-muted">{t('noItems')}</p> : null}
      {items.map((item, index) => {
        const rowId = `${id}-${String(index)}`;
        return (
          <div
            key={rowId}
            role="group"
            aria-labelledby={`${rowId}-title`}
            className="grid gap-3 border-t border-hairline pt-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p id={`${rowId}-title`} className="font-display text-small font-bold">
                {title(index)}
              </p>
              {items.length > minItems ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange(items.filter((_, other) => other !== index));
                  }}
                  aria-label={t('remove', { item: title(index) })}
                  className="rounded-control p-1 text-ink-2 hover:bg-sunken"
                >
                  <X aria-hidden className="size-4" />
                </button>
              ) : null}
            </div>
            {render(
              item,
              (next) => {
                onChange(items.map((current, other) => (other === index ? next : current)));
              },
              rowId,
              index,
            )}
          </div>
        );
      })}
      <div>
        <button
          type="button"
          onClick={() => {
            onChange([...items, empty()]);
          }}
          className="inline-flex items-center gap-1.5 rounded-control border border-control px-3 py-1.5 text-small hover:bg-sunken"
        >
          <Plus aria-hidden className="size-4" />
          {t('add')}
        </button>
      </div>
    </div>
  );
}

const localized = (options: readonly Option[], language: Language) =>
  options.map((option) => ({ value: option.value, label: option.label[language] }));

/** The answer controls for one field kind. Holds no state: the answer editor owns the draft. */
export function FieldEditor({
  id,
  labelledBy,
  describedBy,
  field,
  draft,
  onChange,
  unreadable,
  options,
}: FieldEditorProps) {
  const language: Language = useLocale();
  const t = useTranslations('diagnostic.widgets');
  const aria = {
    'aria-labelledby': labelledBy,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  };
  const yesNo = [
    { value: 'yes', label: t('yes') },
    { value: 'no', label: t('no') },
  ];
  const toChoice = (value: boolean | null) => (value === null ? '' : value ? 'yes' : 'no');
  const bad = (path: string) => unreadable.includes(path);
  const newMoney = (): MoneyDraft => ({ amount: '', currency: options.currency });

  switch (field.kind) {
    case 'short_text':
      return (
        <TextBox id={id} value={draft as string} onChange={onChange} multiline={2} {...aria} />
      );
    case 'long_text':
      return (
        <TextBox id={id} value={draft as string} onChange={onChange} multiline={5} {...aria} />
      );
    case 'number':
      return (
        <NumberBox
          id={id}
          value={draft as string}
          onChange={onChange}
          invalid={bad('')}
          {...aria}
        />
      );
    case 'boolean':
      return (
        <ChoiceGroup
          id={id}
          labelledBy={labelledBy}
          inline
          options={yesNo}
          value={toChoice(draft as boolean | null)}
          onChange={(value) => {
            onChange(value === 'yes');
          }}
        />
      );
    case 'single':
      return field.options.length > 8 ? (
        <OptionSelect
          id={id}
          value={draft as string}
          onChange={onChange}
          options={localized(field.options, language)}
          placeholder={t('choose')}
          aria-labelledby={labelledBy}
        />
      ) : (
        <ChoiceGroup
          id={id}
          labelledBy={labelledBy}
          options={localized(field.options, language)}
          value={draft as string}
          onChange={onChange}
        />
      );
    case 'multi': {
      const multi = draft as DraftByKind['multi'];
      return (
        <div className="grid gap-4">
          <CheckboxGroup
            id={id}
            labelledBy={labelledBy}
            columns={2}
            options={localized(field.options, language)}
            values={multi.values}
            onChange={(values) => {
              onChange({ ...multi, values });
            }}
          />
          {field.other ? (
            <Labelled id={`${id}-other`} label={t('other')}>
              <TextBox
                id={`${id}-other`}
                value={multi.other}
                onChange={(other) => {
                  onChange({ ...multi, other });
                }}
              />
            </Labelled>
          ) : null}
        </div>
      );
    }
    case 'money':
      return (
        <MoneyBoxes
          id={id}
          money={draft as MoneyDraft}
          onChange={onChange}
          invalid={bad('amount')}
          currencies={options.currencies}
          amountLabel={t('amount')}
        />
      );
    case 'money_range': {
      const range = draft as DraftByKind['money_range'];
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <Labelled id={`${id}-min`} label={t('from')}>
            <NumberBox
              id={`${id}-min`}
              value={range.min}
              invalid={bad('min')}
              onChange={(min) => {
                onChange({ ...range, min });
              }}
            />
          </Labelled>
          <Labelled id={`${id}-max`} label={t('to')}>
            <NumberBox
              id={`${id}-max`}
              value={range.max}
              invalid={bad('max')}
              onChange={(max) => {
                onChange({ ...range, max });
              }}
            />
          </Labelled>
          <Labelled id={`${id}-currency`} label={t('currency')}>
            <CurrencySelect
              id={`${id}-currency`}
              value={range.currency}
              currencies={options.currencies}
              onChange={(currency) => {
                onChange({ ...range, currency });
              }}
            />
          </Labelled>
        </div>
      );
    }
    case 'currency':
      return (
        <CurrencySelect
          id={id}
          value={draft as string}
          currencies={options.currencies}
          onChange={onChange}
          aria-labelledby={labelledBy}
        />
      );
    case 'country_city': {
      const place = draft as DraftByKind['country_city'];
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled id={`${id}-country`} label={t('country')}>
            <OptionSelect
              id={`${id}-country`}
              value={place.country}
              options={options.countries}
              placeholder={t('choose')}
              onChange={(country) => {
                onChange({ ...place, country });
              }}
            />
          </Labelled>
          <Labelled id={`${id}-city`} label={t('city')}>
            <TextBox
              id={`${id}-city`}
              value={place.city}
              onChange={(city) => {
                onChange({ ...place, city });
              }}
            />
          </Labelled>
        </div>
      );
    }
    case 'cost_items': {
      const list = draft as DraftByKind['cost_items'];
      return (
        <Rows
          id={id}
          items={list.items}
          minItems={field.minItems}
          empty={() => ({ label: '', ...newMoney() })}
          title={(index) => t('item', { number: index + 1 })}
          onChange={(items) => {
            onChange({ items });
          }}
          render={(item, update, rowId, index) => (
            <div className="grid gap-3">
              <Labelled id={`${rowId}-label`} label={t('label')}>
                <TextBox
                  id={`${rowId}-label`}
                  value={item.label}
                  onChange={(label) => {
                    update({ ...item, label });
                  }}
                />
              </Labelled>
              <MoneyBoxes
                id={rowId}
                money={item}
                currencies={options.currencies}
                amountLabel={t('amount')}
                invalid={bad(`items.${String(index)}.amount`)}
                onChange={(money) => {
                  update({ ...item, ...money });
                }}
              />
            </div>
          )}
        />
      );
    }
    case 'people': {
      const list = draft as DraftByKind['people'];
      return (
        <Rows
          id={id}
          items={list.items}
          minItems={field.minItems}
          empty={() => ({ name: '', detail: '' })}
          title={(index) => t('item', { number: index + 1 })}
          onChange={(items) => {
            onChange({ items });
          }}
          render={(item, update, rowId) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Labelled id={`${rowId}-name`} label={field.labels.name[language]}>
                <TextBox
                  id={`${rowId}-name`}
                  value={item.name}
                  onChange={(name) => {
                    update({ ...item, name });
                  }}
                />
              </Labelled>
              <Labelled id={`${rowId}-detail`} label={field.labels.detail[language]}>
                <TextBox
                  id={`${rowId}-detail`}
                  value={item.detail}
                  onChange={(detail) => {
                    update({ ...item, detail });
                  }}
                />
              </Labelled>
            </div>
          )}
        />
      );
    }
    case 'competitors': {
      const list = draft as DraftByKind['competitors'];
      return (
        <Rows
          id={id}
          items={list.items}
          minItems={field.minItems}
          empty={() => ({ name: '', url: '', strength: '', weakness: '' })}
          title={(index) => t('competitor', { number: index + 1 })}
          onChange={(items) => {
            onChange({ items });
          }}
          render={(item, update, rowId) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Labelled id={`${rowId}-name`} label={t('name')}>
                <TextBox
                  id={`${rowId}-name`}
                  value={item.name}
                  onChange={(name) => {
                    update({ ...item, name });
                  }}
                />
              </Labelled>
              <Labelled id={`${rowId}-url`} label={t('url')}>
                <input
                  id={`${rowId}-url`}
                  type="url"
                  dir="ltr"
                  value={item.url}
                  onChange={(event) => {
                    update({ ...item, url: event.target.value });
                  }}
                  className={controlClass}
                />
              </Labelled>
              <Labelled id={`${rowId}-strength`} label={t('strength')}>
                <TextBox
                  id={`${rowId}-strength`}
                  value={item.strength}
                  onChange={(strength) => {
                    update({ ...item, strength });
                  }}
                />
              </Labelled>
              <Labelled id={`${rowId}-weakness`} label={t('weakness')}>
                <TextBox
                  id={`${rowId}-weakness`}
                  value={item.weakness}
                  onChange={(weakness) => {
                    update({ ...item, weakness });
                  }}
                />
              </Labelled>
            </div>
          )}
        />
      );
    }
    case 'competitor_prices': {
      const list = draft as DraftByKind['competitor_prices'];
      return (
        <Rows
          id={id}
          items={list.items}
          minItems={1}
          empty={() => ({ name: '', ...newMoney(), unknown: false })}
          title={(index) => t('competitor', { number: index + 1 })}
          onChange={(items) => {
            onChange({ items });
          }}
          render={(item, update, rowId, index) => (
            <div className="grid gap-3">
              <Labelled id={`${rowId}-name`} label={t('name')}>
                <TextBox
                  id={`${rowId}-name`}
                  value={item.name}
                  onChange={(name) => {
                    update({ ...item, name });
                  }}
                />
              </Labelled>
              {item.unknown ? null : (
                <MoneyBoxes
                  id={rowId}
                  money={item}
                  currencies={options.currencies}
                  amountLabel={t('price')}
                  invalid={bad(`items.${String(index)}.amount`)}
                  onChange={(money) => {
                    update({ ...item, ...money });
                  }}
                />
              )}
              <label className="flex items-center gap-2 text-small">
                <input
                  type="checkbox"
                  checked={item.unknown}
                  onChange={(event) => {
                    update({ ...item, unknown: event.target.checked });
                  }}
                  className="size-4 accent-ink"
                />
                {t('unknownPrice')}
              </label>
            </div>
          )}
        />
      );
    }
    case 'percent_split': {
      const list = draft as DraftByKind['percent_split'];
      const total = list.items.reduce((sum, item) => {
        const reading = readNumber(item.percent);
        return sum + (reading.ok ? reading.value : 0);
      }, 0);
      return (
        <div className="grid gap-3">
          <Rows
            id={id}
            items={list.items}
            minItems={1}
            empty={() => ({ label: '', percent: '' })}
            title={(index) => t('partner', { number: index + 1 })}
            onChange={(items) => {
              onChange({ items });
            }}
            render={(item, update, rowId, index) => (
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
                <Labelled id={`${rowId}-label`} label={t('name')}>
                  <TextBox
                    id={`${rowId}-label`}
                    value={item.label}
                    onChange={(label) => {
                      update({ ...item, label });
                    }}
                  />
                </Labelled>
                <Labelled id={`${rowId}-percent`} label={t('share')}>
                  <NumberBox
                    id={`${rowId}-percent`}
                    value={item.percent}
                    invalid={bad(`items.${String(index)}.percent`)}
                    onChange={(percent) => {
                      update({ ...item, percent });
                    }}
                  />
                </Labelled>
              </div>
            )}
          />
          <p className="text-small text-ink-2" aria-live="polite">
            {t('total')} <bdi className="num">{Math.round(total * 100) / 100}%</bdi>
          </p>
        </div>
      );
    }
    case 'yes_no_detail': {
      const answer = draft as DraftByKind['yes_no_detail'];
      const showDetail = answer.answer === (field.detailWhen === 'yes');
      return (
        <div className="grid gap-4">
          <ChoiceGroup
            id={id}
            labelledBy={labelledBy}
            inline
            options={yesNo}
            value={toChoice(answer.answer)}
            onChange={(value) => {
              onChange({ ...answer, answer: value === 'yes' });
            }}
          />
          {showDetail ? (
            <Labelled id={`${id}-detail`} label={field.detailLabel[language]}>
              <TextBox
                id={`${id}-detail`}
                multiline={3}
                value={answer.detail}
                onChange={(detail) => {
                  onChange({ ...answer, detail });
                }}
              />
            </Labelled>
          ) : null}
        </div>
      );
    }
    case 'yes_no_percent': {
      const answer = draft as DraftByKind['yes_no_percent'];
      return (
        <div className="grid gap-4">
          <ChoiceGroup
            id={id}
            labelledBy={labelledBy}
            inline
            options={yesNo}
            value={toChoice(answer.answer)}
            onChange={(value) => {
              onChange({ ...answer, answer: value === 'yes' });
            }}
          />
          {answer.answer ? (
            <Labelled id={`${id}-percent`} label={field.percentLabel[language]}>
              <NumberBox
                id={`${id}-percent`}
                value={answer.percent}
                invalid={bad('percent')}
                onChange={(percent) => {
                  onChange({ ...answer, percent });
                }}
              />
            </Labelled>
          ) : null}
        </div>
      );
    }
    case 'seasonality': {
      const season = draft as DraftByKind['seasonality'];
      return (
        <div className="grid gap-4">
          <ChoiceGroup
            id={id}
            labelledBy={labelledBy}
            inline
            options={yesNo}
            value={toChoice(season.seasonal)}
            onChange={(value) => {
              onChange({ ...season, seasonal: value === 'yes' });
            }}
          />
          {season.seasonal ? (
            <div className="grid gap-2">
              <p id={`${id}-months`} className={labelClass}>
                {t('peakMonths')}
              </p>
              <CheckboxGroup
                id={`${id}-month`}
                labelledBy={`${id}-months`}
                columns={3}
                options={MONTHS.map((month, index) => ({
                  value: String(index + 1),
                  label: month[language],
                }))}
                values={season.peakMonths.map(String)}
                onChange={(values) => {
                  onChange({ ...season, peakMonths: values.map(Number).sort((a, b) => a - b) });
                }}
              />
            </div>
          ) : null}
        </div>
      );
    }
    case 'sales_forecast': {
      const sales = draft as DraftByKind['sales_forecast'];
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          {(['month1', 'month6', 'month12'] as const).map((month) => (
            <Labelled key={month} id={`${id}-${month}`} label={t(month)}>
              <NumberBox
                id={`${id}-${month}`}
                value={sales[month]}
                invalid={bad(month)}
                onChange={(value) => {
                  onChange({ ...sales, [month]: value });
                }}
              />
            </Labelled>
          ))}
        </div>
      );
    }
    case 'three_texts': {
      const texts = draft as DraftByKind['three_texts'];
      return (
        <div className="grid gap-3">
          {texts.items.map((item, index) => (
            <Labelled
              key={String(index)}
              id={`${id}-${String(index)}`}
              label={t('activity', { number: index + 1 })}
            >
              <TextBox
                id={`${id}-${String(index)}`}
                value={item}
                onChange={(value) => {
                  const items = [...texts.items] as [string, string, string];
                  items[index] = value;
                  onChange({ items });
                }}
              />
            </Labelled>
          ))}
        </div>
      );
    }
    case 'staff_plan': {
      const list = draft as DraftByKind['staff_plan'];
      return (
        <Rows
          id={id}
          items={list.items}
          minItems={0}
          empty={() => ({ role: '', ...newMoney(), startMonth: '' })}
          title={(index) => t('role', { number: index + 1 })}
          onChange={(items) => {
            onChange({ items });
          }}
          render={(item, update, rowId, index) => (
            <div className="grid gap-3">
              <Labelled id={`${rowId}-role`} label={t('roleName')}>
                <TextBox
                  id={`${rowId}-role`}
                  value={item.role}
                  onChange={(role) => {
                    update({ ...item, role });
                  }}
                />
              </Labelled>
              <MoneyBoxes
                id={rowId}
                money={item}
                currencies={options.currencies}
                amountLabel={t('monthlyCost')}
                invalid={bad(`items.${String(index)}.amount`)}
                onChange={(money) => {
                  update({ ...item, ...money });
                }}
              />
              <Labelled id={`${rowId}-start`} label={t('startMonth')}>
                <NumberBox
                  id={`${rowId}-start`}
                  value={item.startMonth}
                  invalid={bad(`items.${String(index)}.startMonth`)}
                  onChange={(startMonth) => {
                    update({ ...item, startMonth });
                  }}
                />
              </Labelled>
            </div>
          )}
        />
      );
    }
    case 'customer_profile': {
      const profile = draft as DraftByKind['customer_profile'];
      const set = (part: keyof DraftByKind['customer_profile']) => (value: string) => {
        onChange({ ...profile, [part]: value });
      };
      const individual = options.payer !== 'b2b' && options.payer !== 'b2g';
      const organisation = options.payer !== 'b2c';
      return (
        <div className="grid gap-6">
          {individual ? (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 font-display text-small font-bold">{t('individual')}</legend>
              <Labelled id={`${id}-age`} label={t('ageBand')}>
                <OptionSelect
                  id={`${id}-age`}
                  value={profile.ageBand}
                  onChange={set('ageBand')}
                  options={localized(AGE_BANDS, language)}
                  placeholder={t('choose')}
                />
              </Labelled>
              <Labelled id={`${id}-city`} label={t('city')}>
                <TextBox id={`${id}-city`} value={profile.city} onChange={set('city')} />
              </Labelled>
              <Labelled id={`${id}-income`} label={t('incomeBand')}>
                <OptionSelect
                  id={`${id}-income`}
                  value={profile.incomeBand}
                  onChange={set('incomeBand')}
                  options={localized(INCOME_BANDS, language)}
                  placeholder={t('choose')}
                />
              </Labelled>
              <Labelled id={`${id}-occupation`} label={t('occupation')}>
                <TextBox
                  id={`${id}-occupation`}
                  value={profile.occupation}
                  onChange={set('occupation')}
                />
              </Labelled>
            </fieldset>
          ) : null}
          {organisation ? (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 font-display text-small font-bold">
                {t('organisation')}
              </legend>
              <Labelled id={`${id}-sector`} label={t('sector')}>
                <OptionSelect
                  id={`${id}-sector`}
                  value={profile.sector}
                  onChange={set('sector')}
                  options={localized(SECTORS, language)}
                  placeholder={t('choose')}
                />
              </Labelled>
              <Labelled id={`${id}-size`} label={t('size')}>
                <OptionSelect
                  id={`${id}-size`}
                  value={profile.size}
                  onChange={set('size')}
                  options={localized(COMPANY_SIZES, language)}
                  placeholder={t('choose')}
                />
              </Labelled>
              <Labelled id={`${id}-decision`} label={t('decisionMaker')}>
                <TextBox
                  id={`${id}-decision`}
                  value={profile.decisionMaker}
                  onChange={set('decisionMaker')}
                />
              </Labelled>
            </fieldset>
          ) : null}
        </div>
      );
    }
  }
}
