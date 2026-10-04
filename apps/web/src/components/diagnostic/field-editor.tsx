'use client';

import {
  AGE_BANDS,
  COMPANY_SIZES,
  type Field,
  INCOME_BANDS,
  type Language,
  maxItemsFor,
  MONTHS,
  type Option,
  profilePartsFor,
  readNumber,
  SECTORS,
} from '@sbn/question-bank';
import { Plus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { controlClass } from '@/components/ui/text-input';
import { cn } from '@/lib/cn';
import type { CurrencyOptions } from '@/lib/diagnostic/currencies';
import type { Draft, DraftByKind, FieldError, MoneyDraft } from '@/lib/diagnostic/draft';
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
  /**
   * Parts of the answer to mark as wrong, by path ("items.1.amount"), from the browser's own
   * number reading or the server's checks. Each message is shown under its box (UX-3).
   */
  errors: readonly FieldError[];
  options: EditorOptions;
}

const labelClass = 'text-caption font-bold text-ink-2';
const numberClass = cn(controlClass, 'num text-end');
const errorClass = 'text-caption text-danger';

/** What a control needs to say it is wrong: aria-invalid, and the id of its message. */
interface ErrorAria {
  invalid: boolean;
  'aria-describedby'?: string;
}

/** The ids that describe a control, the error message's last. */
function describedBy(error: FieldError | undefined, messageId: string, other?: string) {
  const ids = [other, error?.message ? messageId : undefined].filter(Boolean).join(' ');
  return ids === '' ? {} : { 'aria-describedby': ids };
}

/** An error message, under the control it is about. */
function ErrorText({ id, error }: { id: string; error: FieldError | undefined }) {
  return error?.message ? (
    <p id={id} className={errorClass}>
      {error.message}
    </p>
  ) : null;
}

/**
 * A control without a label of its own (the answer's only control, a yes/no inside a combined
 * answer), with its error under it. `children` puts the error's aria on the control.
 */
function Described({
  id,
  error,
  describedBy: other,
  children,
}: {
  id: string;
  error: FieldError | undefined;
  /** The question's help, which describes the answer's only control. */
  describedBy?: string;
  children: (aria: ErrorAria) => ReactNode;
}) {
  const messageId = `${id}-error`;
  return (
    <div className="grid gap-1.5">
      {children({ invalid: error !== undefined, ...describedBy(error, messageId, other) })}
      <ErrorText id={messageId} error={error} />
    </div>
  );
}

/** A labelled control with its error under it, linked by aria-describedby (WCAG 3.3.1). */
function Labelled({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: FieldError | undefined;
  children: (control: ErrorAria & { id: string }) => ReactNode;
}) {
  const messageId = `${id}-error`;
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children({ id, invalid: error !== undefined, ...describedBy(error, messageId) })}
      <ErrorText id={messageId} error={error} />
    </div>
  );
}

function TextBox({
  id,
  value,
  onChange,
  multiline = 0,
  invalid = false,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Rows for a text area; 0 for a single line. */
  multiline?: number;
  invalid?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}) {
  return multiline > 0 ? (
    <textarea
      id={id}
      // Founders write in Arabic or English whatever the interface language.
      dir="auto"
      rows={multiline}
      value={value}
      aria-invalid={invalid || undefined}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      className={cn(controlClass, 'leading-relaxed')}
      {...aria}
    />
  ) : (
    <input
      id={id}
      dir="auto"
      value={value}
      aria-invalid={invalid || undefined}
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
  invalid = false,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
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
  invalid = false,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder: string;
  invalid?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      aria-invalid={invalid || undefined}
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
  invalid = false,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  currencies: CurrencyOptions;
  invalid?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}) {
  const t = useTranslations('diagnostic.widgets');
  return (
    <select
      id={id}
      value={value}
      aria-invalid={invalid || undefined}
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
  errors,
  currencies,
  amountLabel,
}: {
  id: string;
  money: MoneyDraft;
  onChange: (money: MoneyDraft) => void;
  errors: { amount: FieldError | undefined; currency: FieldError | undefined };
  currencies: CurrencyOptions;
  amountLabel: string;
}) {
  const t = useTranslations('diagnostic.widgets');
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start gap-2">
      <Labelled id={`${id}-amount`} label={amountLabel} error={errors.amount}>
        {(control) => (
          <NumberBox
            {...control}
            value={money.amount}
            onChange={(amount) => {
              onChange({ ...money, amount });
            }}
          />
        )}
      </Labelled>
      <Labelled id={`${id}-currency`} label={t('currency')} error={errors.currency}>
        {(control) => (
          <CurrencySelect
            {...control}
            value={money.currency}
            currencies={currencies}
            onChange={(currency) => {
              onChange({ ...money, currency });
            }}
          />
        )}
      </Labelled>
    </div>
  );
}

/** Where focus goes once a list has changed (Rows). */
type RowFocus = { row: number; on: 'title' | 'control' } | 'add';

/**
 * A list of rows the founder can add to and remove from, each a group named by its title.
 * "Add" disappears at the list's limit, which the bank's schema applies too (ARCH-M2). Focus is
 * never lost with a button that goes (UX-8): a new row takes it in its first box; after a removal
 * the row before takes it, else "Add", and the removal is announced.
 */
function Rows<T>({
  id,
  items,
  onChange,
  empty,
  minItems,
  maxItems,
  title,
  render,
}: {
  id: string;
  items: readonly T[];
  onChange: (items: T[]) => void;
  empty: () => T;
  minItems: number;
  maxItems: number | null;
  title: (index: number) => string;
  render: (item: T, update: (item: T) => void, rowId: string, index: number) => ReactNode;
}) {
  const t = useTranslations('diagnostic');
  const full = maxItems !== null && items.length >= maxItems;
  const addButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<RowFocus | null>(null);
  const [removals, setRemovals] = useState(0);

  // Runs once the parent has rendered the changed list.
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === null) return;
    if (target === 'add') {
      addButton.current?.focus();
      return;
    }
    const rowId = `${id}-${String(target.row)}`;
    (target.on === 'title'
      ? document.getElementById(`${rowId}-title`)
      : document.getElementById(rowId)?.querySelector<HTMLElement>('input, select, textarea')
    )?.focus();
  }, [items, id]);

  return (
    <div className="grid gap-4">
      {items.length === 0 ? <p className="text-small text-muted">{t('widgets.noItems')}</p> : null}
      {items.map((item, index) => {
        const rowId = `${id}-${String(index)}`;
        return (
          <div
            key={rowId}
            id={rowId}
            role="group"
            aria-labelledby={`${rowId}-title`}
            className="grid gap-3 border-t border-hairline pt-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p
                id={`${rowId}-title`}
                tabIndex={-1}
                className="font-display text-small font-bold focus:outline-none"
              >
                {title(index)}
              </p>
              {items.length > minItems ? (
                <button
                  type="button"
                  onClick={() => {
                    focusNext.current = index > 0 ? { row: index - 1, on: 'title' } : 'add';
                    setRemovals((count) => count + 1);
                    onChange(items.filter((_, other) => other !== index));
                  }}
                  aria-label={t('widgets.remove', { item: title(index) })}
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
        {full ? (
          <p className="text-small text-muted">
            {t('errors.maxItems', { count: String(maxItems) })}
          </p>
        ) : (
          <button
            ref={addButton}
            type="button"
            onClick={() => {
              focusNext.current = { row: items.length, on: 'control' };
              onChange([...items, empty()]);
            }}
            className="inline-flex items-center gap-1.5 rounded-control border border-control px-3 py-1.5 text-small hover:bg-sunken"
          >
            <Plus aria-hidden className="size-4" />
            {t('widgets.add')}
          </button>
        )}
      </div>
      {/* A new node per removal, so the same words are announced again. */}
      <p role="status" className="sr-only">
        {removals > 0 ? <span key={removals}>{t('widgets.removed')}</span> : null}
      </p>
    </div>
  );
}

const localized = (options: readonly Option[], language: Language) =>
  options.map((option) => ({ value: option.value, label: option.label[language] }));

/** The answer controls for one field kind. Holds no state: the answer editor owns the draft. */
export function FieldEditor({
  id,
  labelledBy,
  describedBy: help,
  field,
  draft,
  onChange,
  errors,
  options,
}: FieldEditorProps) {
  const language: Language = useLocale();
  const t = useTranslations('diagnostic.widgets');
  const yesNo = [
    { value: 'yes', label: t('yes') },
    { value: 'no', label: t('no') },
  ];
  const toChoice = (value: boolean | null) => (value === null ? '' : value ? 'yes' : 'no');
  const errorAt = (path: string) => errors.find((error) => error.path === path);
  const newMoney = (): MoneyDraft => ({ amount: '', currency: options.currency });
  const moneyErrors = (path: string) => ({
    amount: errorAt(`${path}.amount`),
    currency: errorAt(`${path}.currency`),
  });
  /** The answer's only control, labelled by the question and described by its help. */
  const only = (render: (aria: ErrorAria & { 'aria-labelledby': string }) => ReactNode) => (
    <Described id={id} error={errorAt('')} {...(help ? { describedBy: help } : {})}>
      {(aria) => render({ ...aria, 'aria-labelledby': labelledBy })}
    </Described>
  );

  switch (field.kind) {
    case 'short_text':
    case 'long_text':
      return only((aria) => (
        <TextBox
          id={id}
          value={draft as string}
          onChange={onChange}
          multiline={field.kind === 'short_text' ? 2 : 5}
          {...aria}
        />
      ));
    case 'number':
      return only((aria) => (
        <NumberBox id={id} value={draft as string} onChange={onChange} {...aria} />
      ));
    case 'boolean':
      return only((aria) => (
        <ChoiceGroup
          id={id}
          labelledBy={labelledBy}
          invalid={aria.invalid}
          describedBy={aria['aria-describedby']}
          inline
          options={yesNo}
          value={toChoice(draft as boolean | null)}
          onChange={(value) => {
            onChange(value === 'yes');
          }}
        />
      ));
    case 'single':
      return only((aria) =>
        field.options.length > 8 ? (
          <OptionSelect
            id={id}
            value={draft as string}
            onChange={onChange}
            options={localized(field.options, language)}
            placeholder={t('choose')}
            {...aria}
          />
        ) : (
          <ChoiceGroup
            id={id}
            labelledBy={labelledBy}
            invalid={aria.invalid}
            describedBy={aria['aria-describedby']}
            options={localized(field.options, language)}
            value={draft as string}
            onChange={onChange}
          />
        ),
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
            <Labelled id={`${id}-other`} label={t('other')} error={errorAt('other')}>
              {(control) => (
                <TextBox
                  {...control}
                  value={multi.other}
                  onChange={(other) => {
                    onChange({ ...multi, other });
                  }}
                />
              )}
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
          errors={{ amount: errorAt('amount'), currency: errorAt('currency') }}
          currencies={options.currencies}
          amountLabel={t('amount')}
        />
      );
    case 'money_range': {
      const range = draft as DraftByKind['money_range'];
      return (
        <div className="grid items-start gap-3 sm:grid-cols-3">
          <Labelled id={`${id}-min`} label={t('from')} error={errorAt('min')}>
            {(control) => (
              <NumberBox
                {...control}
                value={range.min}
                onChange={(min) => {
                  onChange({ ...range, min });
                }}
              />
            )}
          </Labelled>
          <Labelled id={`${id}-max`} label={t('to')} error={errorAt('max')}>
            {(control) => (
              <NumberBox
                {...control}
                value={range.max}
                onChange={(max) => {
                  onChange({ ...range, max });
                }}
              />
            )}
          </Labelled>
          <Labelled id={`${id}-currency`} label={t('currency')} error={errorAt('currency')}>
            {(control) => (
              <CurrencySelect
                {...control}
                value={range.currency}
                currencies={options.currencies}
                onChange={(currency) => {
                  onChange({ ...range, currency });
                }}
              />
            )}
          </Labelled>
        </div>
      );
    }
    case 'currency':
      return only((aria) => (
        <CurrencySelect
          id={id}
          value={draft as string}
          currencies={options.currencies}
          onChange={onChange}
          {...aria}
        />
      ));
    case 'country_city': {
      const place = draft as DraftByKind['country_city'];
      return (
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <Labelled id={`${id}-country`} label={t('country')} error={errorAt('country')}>
            {(control) => (
              <OptionSelect
                {...control}
                value={place.country}
                options={options.countries}
                placeholder={t('choose')}
                onChange={(country) => {
                  onChange({ ...place, country });
                }}
              />
            )}
          </Labelled>
          <Labelled id={`${id}-city`} label={t('city')} error={errorAt('city')}>
            {(control) => (
              <TextBox
                {...control}
                value={place.city}
                onChange={(city) => {
                  onChange({ ...place, city });
                }}
              />
            )}
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
          maxItems={maxItemsFor(field)}
          empty={() => ({ label: '', ...newMoney() })}
          title={(index) => t('item', { number: index + 1 })}
          onChange={(items) => {
            onChange({ items });
          }}
          render={(item, update, rowId, index) => (
            <div className="grid gap-3">
              <Labelled
                id={`${rowId}-label`}
                label={t('label')}
                error={errorAt(`items.${String(index)}.label`)}
              >
                {(control) => (
                  <TextBox
                    {...control}
                    value={item.label}
                    onChange={(label) => {
                      update({ ...item, label });
                    }}
                  />
                )}
              </Labelled>
              <MoneyBoxes
                id={rowId}
                money={item}
                currencies={options.currencies}
                amountLabel={t('amount')}
                errors={moneyErrors(`items.${String(index)}`)}
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
          maxItems={maxItemsFor(field)}
          empty={() => ({ name: '', detail: '' })}
          title={(index) => t('item', { number: index + 1 })}
          onChange={(items) => {
            onChange({ items });
          }}
          render={(item, update, rowId, index) => (
            <div className="grid items-start gap-3 sm:grid-cols-2">
              <Labelled
                id={`${rowId}-name`}
                label={field.labels.name[language]}
                error={errorAt(`items.${String(index)}.name`)}
              >
                {(control) => (
                  <TextBox
                    {...control}
                    value={item.name}
                    onChange={(name) => {
                      update({ ...item, name });
                    }}
                  />
                )}
              </Labelled>
              <Labelled
                id={`${rowId}-detail`}
                label={field.labels.detail[language]}
                error={errorAt(`items.${String(index)}.detail`)}
              >
                {(control) => (
                  <TextBox
                    {...control}
                    value={item.detail}
                    onChange={(detail) => {
                      update({ ...item, detail });
                    }}
                  />
                )}
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
          maxItems={maxItemsFor(field)}
          empty={() => ({ name: '', url: '', strength: '', weakness: '' })}
          title={(index) => t('competitor', { number: index + 1 })}
          onChange={(items) => {
            onChange({ items });
          }}
          render={(item, update, rowId, index) => {
            const at = (part: string) => errorAt(`items.${String(index)}.${part}`);
            return (
              <div className="grid items-start gap-3 sm:grid-cols-2">
                <Labelled id={`${rowId}-name`} label={t('name')} error={at('name')}>
                  {(control) => (
                    <TextBox
                      {...control}
                      value={item.name}
                      onChange={(name) => {
                        update({ ...item, name });
                      }}
                    />
                  )}
                </Labelled>
                <Labelled id={`${rowId}-url`} label={t('url')} error={at('url')}>
                  {({ invalid, ...control }) => (
                    <input
                      {...control}
                      type="url"
                      dir="ltr"
                      value={item.url}
                      aria-invalid={invalid || undefined}
                      onChange={(event) => {
                        update({ ...item, url: event.target.value });
                      }}
                      className={controlClass}
                    />
                  )}
                </Labelled>
                <Labelled id={`${rowId}-strength`} label={t('strength')} error={at('strength')}>
                  {(control) => (
                    <TextBox
                      {...control}
                      value={item.strength}
                      onChange={(strength) => {
                        update({ ...item, strength });
                      }}
                    />
                  )}
                </Labelled>
                <Labelled id={`${rowId}-weakness`} label={t('weakness')} error={at('weakness')}>
                  {(control) => (
                    <TextBox
                      {...control}
                      value={item.weakness}
                      onChange={(weakness) => {
                        update({ ...item, weakness });
                      }}
                    />
                  )}
                </Labelled>
              </div>
            );
          }}
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
          maxItems={maxItemsFor(field)}
          empty={() => ({ name: '', ...newMoney(), unknown: false })}
          title={(index) => t('competitor', { number: index + 1 })}
          onChange={(items) => {
            onChange({ items });
          }}
          render={(item, update, rowId, index) => (
            <div className="grid gap-3">
              <Labelled
                id={`${rowId}-name`}
                label={t('name')}
                error={errorAt(`items.${String(index)}.name`)}
              >
                {(control) => (
                  <TextBox
                    {...control}
                    value={item.name}
                    onChange={(name) => {
                      update({ ...item, name });
                    }}
                  />
                )}
              </Labelled>
              {item.unknown ? null : (
                <MoneyBoxes
                  id={rowId}
                  money={item}
                  currencies={options.currencies}
                  amountLabel={t('price')}
                  errors={moneyErrors(`items.${String(index)}.price`)}
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
            maxItems={maxItemsFor(field)}
            empty={() => ({ label: '', percent: '' })}
            title={(index) => t('partner', { number: index + 1 })}
            onChange={(items) => {
              onChange({ items });
            }}
            render={(item, update, rowId, index) => (
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start gap-3">
                <Labelled
                  id={`${rowId}-label`}
                  label={t('name')}
                  error={errorAt(`items.${String(index)}.label`)}
                >
                  {(control) => (
                    <TextBox
                      {...control}
                      value={item.label}
                      onChange={(label) => {
                        update({ ...item, label });
                      }}
                    />
                  )}
                </Labelled>
                <Labelled
                  id={`${rowId}-percent`}
                  label={t('share')}
                  error={errorAt(`items.${String(index)}.percent`)}
                >
                  {(control) => (
                    <NumberBox
                      {...control}
                      value={item.percent}
                      onChange={(percent) => {
                        update({ ...item, percent });
                      }}
                    />
                  )}
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
          <Described id={id} error={errorAt('answer')}>
            {(aria) => (
              <ChoiceGroup
                id={id}
                labelledBy={labelledBy}
                invalid={aria.invalid}
                describedBy={aria['aria-describedby']}
                inline
                options={yesNo}
                value={toChoice(answer.answer)}
                onChange={(value) => {
                  onChange({ ...answer, answer: value === 'yes' });
                }}
              />
            )}
          </Described>
          {showDetail ? (
            <Labelled
              id={`${id}-detail`}
              label={field.detailLabel[language]}
              error={errorAt('detail')}
            >
              {(control) => (
                <TextBox
                  {...control}
                  multiline={3}
                  value={answer.detail}
                  onChange={(detail) => {
                    onChange({ ...answer, detail });
                  }}
                />
              )}
            </Labelled>
          ) : null}
        </div>
      );
    }
    case 'yes_no_percent': {
      const answer = draft as DraftByKind['yes_no_percent'];
      return (
        <div className="grid gap-4">
          <Described id={id} error={errorAt('answer')}>
            {(aria) => (
              <ChoiceGroup
                id={id}
                labelledBy={labelledBy}
                invalid={aria.invalid}
                describedBy={aria['aria-describedby']}
                inline
                options={yesNo}
                value={toChoice(answer.answer)}
                onChange={(value) => {
                  onChange({ ...answer, answer: value === 'yes' });
                }}
              />
            )}
          </Described>
          {answer.answer ? (
            <Labelled
              id={`${id}-percent`}
              label={field.percentLabel[language]}
              error={errorAt('percent')}
            >
              {(control) => (
                <NumberBox
                  {...control}
                  value={answer.percent}
                  onChange={(percent) => {
                    onChange({ ...answer, percent });
                  }}
                />
              )}
            </Labelled>
          ) : null}
        </div>
      );
    }
    case 'seasonality': {
      const season = draft as DraftByKind['seasonality'];
      return (
        <div className="grid gap-4">
          <Described id={id} error={errorAt('seasonal')}>
            {(aria) => (
              <ChoiceGroup
                id={id}
                labelledBy={labelledBy}
                invalid={aria.invalid}
                describedBy={aria['aria-describedby']}
                inline
                options={yesNo}
                value={toChoice(season.seasonal)}
                onChange={(value) => {
                  onChange({ ...season, seasonal: value === 'yes' });
                }}
              />
            )}
          </Described>
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
        <div className="grid items-start gap-3 sm:grid-cols-3">
          {(['month1', 'month6', 'month12'] as const).map((month) => (
            <Labelled key={month} id={`${id}-${month}`} label={t(month)} error={errorAt(month)}>
              {(control) => (
                <NumberBox
                  {...control}
                  value={sales[month]}
                  onChange={(value) => {
                    onChange({ ...sales, [month]: value });
                  }}
                />
              )}
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
              error={errorAt(`items.${String(index)}`)}
            >
              {(control) => (
                <TextBox
                  {...control}
                  value={item}
                  onChange={(value) => {
                    const items = [...texts.items] as [string, string, string];
                    items[index] = value;
                    onChange({ items });
                  }}
                />
              )}
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
          maxItems={maxItemsFor(field)}
          empty={() => ({ role: '', ...newMoney(), startMonth: '' })}
          title={(index) => t('role', { number: index + 1 })}
          onChange={(items) => {
            onChange({ items });
          }}
          render={(item, update, rowId, index) => (
            <div className="grid gap-3">
              <Labelled
                id={`${rowId}-role`}
                label={t('roleName')}
                error={errorAt(`items.${String(index)}.role`)}
              >
                {(control) => (
                  <TextBox
                    {...control}
                    value={item.role}
                    onChange={(role) => {
                      update({ ...item, role });
                    }}
                  />
                )}
              </Labelled>
              <MoneyBoxes
                id={rowId}
                money={item}
                currencies={options.currencies}
                amountLabel={t('monthlyCost')}
                errors={moneyErrors(`items.${String(index)}.monthlyCost`)}
                onChange={(money) => {
                  update({ ...item, ...money });
                }}
              />
              <Labelled
                id={`${rowId}-start`}
                label={t('startMonth')}
                error={errorAt(`items.${String(index)}.startMonth`)}
              >
                {(control) => (
                  <NumberBox
                    {...control}
                    value={item.startMonth}
                    onChange={(startMonth) => {
                      update({ ...item, startMonth });
                    }}
                  />
                )}
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
      // The parts that fit the payer in C1, the same ones the C2 check asks for (ARCH-7).
      const parts = profilePartsFor(options.payer);
      const individual = parts.individual.length > 0;
      const organisation = parts.organisation.length > 0;
      return (
        <div className="grid gap-6">
          {individual ? (
            <fieldset className="grid items-start gap-3 sm:grid-cols-2">
              <legend className="mb-2 font-display text-small font-bold">{t('individual')}</legend>
              <Labelled id={`${id}-age`} label={t('ageBand')} error={errorAt('ageBand')}>
                {(control) => (
                  <OptionSelect
                    {...control}
                    value={profile.ageBand}
                    onChange={set('ageBand')}
                    options={localized(AGE_BANDS, language)}
                    placeholder={t('choose')}
                  />
                )}
              </Labelled>
              <Labelled id={`${id}-city`} label={t('city')} error={errorAt('city')}>
                {(control) => <TextBox {...control} value={profile.city} onChange={set('city')} />}
              </Labelled>
              <Labelled id={`${id}-income`} label={t('incomeBand')} error={errorAt('incomeBand')}>
                {(control) => (
                  <OptionSelect
                    {...control}
                    value={profile.incomeBand}
                    onChange={set('incomeBand')}
                    options={localized(INCOME_BANDS, language)}
                    placeholder={t('choose')}
                  />
                )}
              </Labelled>
              <Labelled
                id={`${id}-occupation`}
                label={t('occupation')}
                error={errorAt('occupation')}
              >
                {(control) => (
                  <TextBox {...control} value={profile.occupation} onChange={set('occupation')} />
                )}
              </Labelled>
            </fieldset>
          ) : null}
          {organisation ? (
            <fieldset className="grid items-start gap-3 sm:grid-cols-2">
              <legend className="mb-2 font-display text-small font-bold">
                {t('organisation')}
              </legend>
              <Labelled id={`${id}-sector`} label={t('sector')} error={errorAt('sector')}>
                {(control) => (
                  <OptionSelect
                    {...control}
                    value={profile.sector}
                    onChange={set('sector')}
                    options={localized(SECTORS, language)}
                    placeholder={t('choose')}
                  />
                )}
              </Labelled>
              <Labelled id={`${id}-size`} label={t('size')} error={errorAt('size')}>
                {(control) => (
                  <OptionSelect
                    {...control}
                    value={profile.size}
                    onChange={set('size')}
                    options={localized(COMPANY_SIZES, language)}
                    placeholder={t('choose')}
                  />
                )}
              </Labelled>
              <Labelled
                id={`${id}-decision`}
                label={t('decisionMaker')}
                error={errorAt('decisionMaker')}
              >
                {(control) => (
                  <TextBox
                    {...control}
                    value={profile.decisionMaker}
                    onChange={set('decisionMaker')}
                  />
                )}
              </Labelled>
            </fieldset>
          ) : null}
        </div>
      );
    }
  }
}
