'use client';

import {
  type Field,
  type FindingCode,
  isQuestionId,
  message,
  type NumberAlternative,
  type NumberRange,
  reviewNumberText,
  type StepId,
} from '@sbn/question-bank';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { RuleAlert } from '@/components/ui/rule-alert';
import { TextLink } from '@/components/ui/text-link';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { callAction } from '@/lib/call-action';
import { type SaveResult, saveAnswer } from '@/lib/diagnostic/actions';
import {
  type Draft,
  type FieldError,
  fromDraft,
  isSingleControl,
  mayBeCentimes,
  type NumberChoice,
  rowsChanged,
  textAt,
  withText,
} from '@/lib/diagnostic/draft';
import type { FindingView } from '@/lib/diagnostic/findings';
import { sameDraft } from '@/lib/diagnostic/leave';
import { type EditorOptions, FieldEditor } from './field-editor';
import { FindingList } from './finding-list';
import { LeaveGuard } from './leave-guard';

interface AnswerEditorProps {
  locale: Locale;
  projectId: string;
  step: StepId;
  field: Field;
  /** A typed answer goes to the AI review before it is saved (consent given, AI on; D-150). */
  reviewsText: boolean;
  headingId: string;
  helpId: string;
  allowUnknown: boolean;
  /** The saved answer is «لا أعرف». */
  savedUnknown: boolean;
  initialDraft: Draft;
  /** Warnings about the saved answer, shown until it changes. */
  initialNotes: FindingView[];
  options: EditorOptions;
  /** Where "Previous" goes; null on the first step. */
  previousHref: string | null;
  overviewHref: string;
}

type Local =
  | { kind: 'none' }
  /** R3: the number could not be read (why, in `code`); offer the question's ranges. */
  | { kind: 'ranges'; code: FindingCode; ranges: readonly NumberRange[] }
  /** A box holds a number with two readings, "1.500": the founder picks one (UX-2). */
  | { kind: 'readings'; choice: NumberChoice }
  /** D-108: an Algerian-dinar amount that may be in centimes. */
  | { kind: 'centimes' };

const SAVE_FAILED: SaveResult = { status: 'error', reason: 'failed' };

/**
 * One question's answer: edit, then save and move on. Rules that reject an answer show their
 * message in place and keep what was typed (SPEC §2); warnings are shown once, then the founder
 * continues. Every step is saved on the server before moving on, so resuming never loses work.
 */
export function AnswerEditor(props: AnswerEditorProps) {
  const t = useTranslations('diagnostic');
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(props.initialDraft);
  // What the server holds, to tell whether leaving the page would lose a typed answer (UX-6).
  const [savedDraft, setSavedDraft] = useState<Draft>(props.initialDraft);
  // Boxes the browser could not read a number from, marked like the server's errors (UX-3).
  const [clientErrors, setClientErrors] = useState<FieldError[]>([]);
  const [local, setLocal] = useState<Local>({ kind: 'none' });
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();
  // A typed answer under AI review can take a few seconds, so the button says it is checked.
  const [checking, setChecking] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  // The value behind a pending AI confirmation, resent unchanged when the founder agrees (D-119).
  const lastValue = useRef<unknown>(null);
  // This attempt's answer to dinars or centimes, kept while a reading is picked (D-108, UX-2).
  const lastCentimes = useRef<boolean | undefined>(undefined);
  // Set when "Next" or a save has something to say: focus then moves to it once, and never
  // because an edit cleared feedback that no longer applies.
  const announce = useRef(false);

  // Move keyboard and screen-reader focus to whatever the server or the checks said: the first
  // box marked wrong when its message sits under it (UX-3), else the feedback below the answer.
  useEffect(() => {
    if (!announce.current) return;
    announce.current = false;
    const placed = [...clientErrors, ...(result?.status === 'invalid' ? result.errors : [])].some(
      (error) => error.message !== null,
    );
    if (!result && local.kind === 'none' && !placed) return;
    const invalid = placed
      ? form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      : null;
    // A radio group is not focusable itself; its first option is.
    const target = invalid?.matches('[role="radiogroup"]')
      ? invalid.querySelector<HTMLElement>('[role="radio"]')
      : invalid;
    (target ?? feedback.current)?.focus();
  }, [result, local, clientErrors]);

  function send(submission: Parameters<typeof saveAnswer>[0]['submission'], sent = draft) {
    if (submission.kind === 'value') lastValue.current = submission.value;
    setChecking(props.reviewsText && submission.kind === 'value');
    startTransition(async () => {
      // A dropped connection keeps the draft on screen so the founder can try again.
      const outcome = await callAction(
        () =>
          saveAnswer({
            locale: props.locale,
            projectId: props.projectId,
            step: props.step,
            submission,
          }),
        SAVE_FAILED,
      );
      if (outcome.status === 'saved') {
        setSavedDraft(sent);
        // A picked range is saved: its question and the box's mark have done their work.
        setClientErrors([]);
        setLocal({ kind: 'none' });
      }
      if (outcome.status === 'saved' && outcome.notes.length === 0) {
        router.push(outcome.next ?? props.overviewHref);
        return;
      }
      // A project deleted or a follow-up dropped elsewhere ('gone', 'stale') leaves the page as
      // it is, so the founder can read why; the message links to a page rendered fresh.
      announce.current = true;
      setResult(outcome);
    });
  }

  /** `current`: the draft to send, when it has only just changed (a picked reading). */
  function submit(centimes?: boolean, current: Draft = draft) {
    announce.current = true;
    setResult(null);
    if (centimes === undefined && mayBeCentimes(props.field, current)) {
      setLocal({ kind: 'centimes' });
      return;
    }
    lastCentimes.current = centimes;
    const conversion = fromDraft(props.field, current, centimes ?? false);
    if (!conversion.ok) {
      const { unreadable: paths, choice } = conversion;
      if (paths.length === 0 && choice) {
        // The question below says which box, and offers its two readings.
        setClientErrors([{ path: choice.path, message: null }]);
        setLocal({ kind: 'readings', choice });
        return;
      }
      // R3 says why the number was not read: a range, two numbers, or no digits (ARCH-7).
      const [finding] =
        props.field.kind === 'number' && isQuestionId(props.step)
          ? reviewNumberText(props.step, current as string)
          : [];
      setClientErrors(paths.map((path) => ({ path, message: finding ? null : t('unreadable') })));
      setLocal(
        finding?.ranges
          ? { kind: 'ranges', code: finding.code, ranges: finding.ranges }
          : { kind: 'none' },
      );
      return;
    }
    setClientErrors([]);
    setLocal({ kind: 'none' });
    send({ kind: 'value', value: conversion.value }, current);
  }

  /** The founder picked one reading of "1.500": the box now says only that, and is sent. */
  function pick(choice: NumberChoice, reading: NumberAlternative) {
    const next = withText(draft, choice.draftPath, reading.text);
    setDraft(next);
    submit(lastCentimes.current, next);
  }

  /**
   * The founder edits the answer. Marks name boxes by row, so once rows come or go they wait for
   * the next "Next"; the question about a number's two readings goes once its box changes, so a
   * pick never lands in another box.
   */
  function edit(next: Draft) {
    setDraft(next);
    if (result?.status === 'saved' || result?.status === 'confirm') setResult(null);
    const reshaped = rowsChanged(draft, next);
    if (reshaped) {
      setClientErrors([]);
      if (result?.status === 'invalid') setResult(null);
    }
    if (
      local.kind === 'readings' &&
      (reshaped || textAt(next, local.choice.draftPath) !== textAt(draft, local.choice.draftPath))
    ) {
      setClientErrors([]);
      setLocal({ kind: 'none' });
    }
  }

  const saved = result?.status === 'saved' ? result : null;
  const confirm = result?.status === 'confirm' ? result : null;
  const notes = saved ? saved.notes : props.initialNotes;
  const askUnknown =
    result?.status === 'rejected' &&
    result.findings.some((finding) => finding.code === 'R4_unknown_text');
  // The project was deleted, or this follow-up no longer applies (perhaps in another tab).
  const lost = result?.status === 'error' && result.reason !== 'failed' ? result.reason : null;
  // Such an answer can no longer be saved, so leaving loses nothing that could be kept.
  const unsaved = lost === null && !sameDraft(draft, savedDraft);
  const errors = [...clientErrors, ...(result?.status === 'invalid' ? result.errors : [])];
  // An answer made of several boxes also lists its errors below it, including those about the
  // answer as a whole ("the shares must add up to 100%") that no single box can carry.
  const summary = isSingleControl(props.field)
    ? []
    : [...new Set(errors.flatMap((error) => (error.message === null ? [] : [error.message])))];
  const failed = result?.status === 'error' && result.reason === 'failed';
  // The saved «لا أعرف» is mentioned until "Next" has something else to say.
  const showUnknown =
    props.savedUnknown && !result && local.kind === 'none' && clientErrors.length === 0;
  const numbered = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => `${prefix}-${String(index)}`);
  // The feedback is announced by taking focus: named by its first message and described by the
  // rest, in the order shown below. Its messages are not live regions as well, or they would be
  // read twice (UX-15).
  const [label, ...description] = [
    showUnknown ? ['feedback-unknown'] : [],
    local.kind === 'ranges' ? ['feedback-r3'] : [],
    local.kind === 'readings' ? ['feedback-readings'] : [],
    local.kind === 'centimes' ? ['feedback-centimes'] : [],
    confirm ? ['feedback-confirm', 'feedback-confirm-text', 'feedback-confirm-note'] : [],
    result?.status === 'rejected' ? numbered('feedback-finding', result.findings.length) : [],
    summary.length > 0 ? ['feedback-invalid', 'feedback-invalid-list'] : [],
    failed ? ['feedback-error'] : [],
    lost === 'stale' ? ['feedback-stale'] : [],
    lost === 'gone' ? ['feedback-gone'] : [],
    numbered('feedback-note', notes.length),
  ].flat();

  return (
    <form
      ref={form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid gap-6"
    >
      <FieldEditor
        id={`answer-${props.step}`}
        labelledBy={props.headingId}
        describedBy={props.helpId}
        field={props.field}
        draft={draft}
        onChange={edit}
        errors={errors}
        options={props.options}
      />

      <div
        ref={feedback}
        tabIndex={-1}
        className="grid gap-3 focus:outline-none"
        {...(label
          ? {
              role: 'group',
              'aria-labelledby': label,
              ...(description.length > 0 ? { 'aria-describedby': description.join(' ') } : {}),
            }
          : {})}
      >
        {showUnknown ? (
          <RuleAlert id="feedback-unknown" live={false} message={t('savedUnknown')} />
        ) : null}

        {local.kind === 'ranges' ? (
          <RuleAlert id="feedback-r3" live={false} message={message(local.code, props.locale)}>
            <div className="mt-2 flex flex-wrap gap-2">
              {local.ranges.map((range) => (
                <Button
                  key={`${String(range.min)}-${String(range.max)}`}
                  disabled={pending}
                  onClick={() => {
                    send({
                      kind: 'range',
                      min: range.min,
                      ...(range.max === undefined ? {} : { max: range.max }),
                    });
                  }}
                >
                  <bdi className="num">
                    {range.max === undefined
                      ? `${String(range.min)}+`
                      : range.min === range.max
                        ? String(range.min)
                        : `${String(range.min)}–${String(range.max)}`}
                  </bdi>
                </Button>
              ))}
            </div>
          </RuleAlert>
        ) : null}

        {local.kind === 'readings' ? (
          <RuleAlert
            id="feedback-readings"
            live={false}
            message={message('R3_two_readings', props.locale, local.choice.typed)}
          >
            <div className="mt-2 flex flex-wrap gap-2">
              {local.choice.readings.map((reading) => (
                <Button
                  key={reading.number}
                  disabled={pending}
                  onClick={() => {
                    pick(local.choice, reading);
                  }}
                >
                  <bdi className="num">{reading.number}</bdi>
                </Button>
              ))}
            </div>
          </RuleAlert>
        ) : null}

        {local.kind === 'centimes' ? (
          <RuleAlert
            id="feedback-centimes"
            live={false}
            message={message('currency_centimes', props.locale)}
          >
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() => {
                  submit(false);
                }}
              >
                {t('inDinars')}
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  submit(true);
                }}
              >
                {t('inCentimes')}
              </Button>
            </div>
          </RuleAlert>
        ) : null}

        {confirm ? (
          <div className="grid gap-3 border-s-[3px] border-teal bg-sunken px-4 py-3 text-small">
            <p id="feedback-confirm" className="font-bold">
              {t('confirmTitle')}
            </p>
            <p id="feedback-confirm-text" lang="ar" dir="rtl" className="text-body">
              {confirm.text}
            </p>
            <p id="feedback-confirm-note" className="text-muted">
              {t('confirmNote')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => {
                  send({ kind: 'confirmed', value: lastValue.current });
                }}
              >
                {t('confirmYes')}
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  setResult(null);
                  document.getElementById(`answer-${props.step}`)?.focus();
                }}
              >
                {t('confirmEdit')}
              </Button>
            </div>
          </div>
        ) : null}
        {result?.status === 'rejected' ? (
          <FindingList findings={result.findings} idPrefix="feedback-finding" live={false} />
        ) : null}
        {summary.length > 0 ? (
          <RuleAlert id="feedback-invalid" live={false} message={t('invalid')}>
            <ul id="feedback-invalid-list" className="mt-1 grid list-disc gap-1 ps-5">
              {summary.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </RuleAlert>
        ) : null}
        {failed ? <RuleAlert id="feedback-error" live={false} message={t('error')} /> : null}
        {lost === 'stale' ? (
          <RuleAlert id="feedback-stale" live={false} message={t('stale')}>
            <TextLink href={props.overviewHref}>{t('staleOverview')}</TextLink>
          </RuleAlert>
        ) : null}
        {lost === 'gone' ? (
          <RuleAlert id="feedback-gone" live={false} message={t('gone')}>
            <TextLink href="/projects">{t('goneProjects')}</TextLink>
          </RuleAlert>
        ) : null}
        {notes.length > 0 ? (
          <FindingList findings={notes} idPrefix="feedback-note" live={false} />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {saved ? (
          <ButtonLink href={saved.next ?? props.overviewHref} variant="primary">
            {t('continue')}
          </ButtonLink>
        ) : (
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? (checking ? t('checking') : t('saving')) : t('next')}
          </Button>
        )}
        {props.previousHref ? (
          <ButtonLink href={props.previousHref}>{t('previous')}</ButtonLink>
        ) : null}
        {props.allowUnknown ? (
          <Button
            variant="quiet"
            disabled={pending}
            onClick={() => {
              send({ kind: 'unknown' });
            }}
          >
            {askUnknown ? t('saveAsUnknown') : t('dontKnow')}
          </Button>
        ) : null}
      </div>
      <LeaveGuard active={unsaved} form={form} />
    </form>
  );
}
