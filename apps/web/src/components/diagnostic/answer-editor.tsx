'use client';

import { type Field, message, type NumberRange } from '@sbn/question-bank';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { RuleAlert } from '@/components/ui/rule-alert';
import { TextLink } from '@/components/ui/text-link';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { callAction } from '@/lib/call-action';
import { type SaveResult, saveAnswer } from '@/lib/diagnostic/actions';
import { type Draft, fromDraft, mayBeCentimes } from '@/lib/diagnostic/draft';
import type { FindingView } from '@/lib/diagnostic/findings';
import { sameDraft } from '@/lib/diagnostic/leave';
import { type EditorOptions, FieldEditor } from './field-editor';
import { FindingList } from './finding-list';
import { LeaveGuard } from './leave-guard';

interface AnswerEditorProps {
  locale: Locale;
  projectId: string;
  step: string;
  field: Field;
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
  /** R3: the number could not be read; offer the question's ranges. */
  | { kind: 'ranges'; ranges: readonly NumberRange[] }
  /** An amount inside a list could not be read. */
  | { kind: 'unreadable' }
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
  const [unreadable, setUnreadable] = useState<string[]>([]);
  const [local, setLocal] = useState<Local>({ kind: 'none' });
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();
  const feedback = useRef<HTMLDivElement>(null);
  // The value behind a pending AI confirmation, resent unchanged when the founder agrees (D-119).
  const lastValue = useRef<unknown>(null);

  // Move keyboard and screen-reader focus to whatever the server or the checks said.
  useEffect(() => {
    if (result || local.kind !== 'none') feedback.current?.focus();
  }, [result, local]);

  function send(submission: Parameters<typeof saveAnswer>[0]['submission']) {
    if (submission.kind === 'value') lastValue.current = submission.value;
    const sent = draft;
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
      if (outcome.status === 'saved') setSavedDraft(sent);
      if (outcome.status === 'saved' && outcome.notes.length === 0) {
        router.push(outcome.next ?? props.overviewHref);
        return;
      }
      // The project or this follow-up changed elsewhere: show the page as it is now.
      if (outcome.status === 'error' && outcome.reason === 'stale') router.refresh();
      setResult(outcome);
    });
  }

  function submit(centimes?: boolean) {
    setResult(null);
    if (centimes === undefined && mayBeCentimes(props.field, draft)) {
      setLocal({ kind: 'centimes' });
      return;
    }
    const conversion = fromDraft(props.field, draft, centimes ?? false);
    if (!conversion.ok) {
      setUnreadable(conversion.unreadable);
      setLocal(
        props.field.kind === 'number'
          ? { kind: 'ranges', ranges: props.field.ranges }
          : { kind: 'unreadable' },
      );
      return;
    }
    setUnreadable([]);
    setLocal({ kind: 'none' });
    send({ kind: 'value', value: conversion.value });
  }

  const saved = result?.status === 'saved' ? result : null;
  const confirm = result?.status === 'confirm' ? result : null;
  const notes = saved ? saved.notes : props.initialNotes;
  const askUnknown =
    result?.status === 'rejected' &&
    result.findings.some((finding) => finding.code === 'R4_unknown_text');
  const stale = result?.status === 'error' && result.reason === 'stale';
  // A stale answer can no longer be saved, so leaving loses nothing that could be kept.
  const unsaved = !stale && !sameDraft(draft, savedDraft);

  return (
    <form
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
        onChange={(next) => {
          setDraft(next);
          if (saved || confirm) setResult(null);
        }}
        unreadable={unreadable}
        options={props.options}
      />

      <div
        ref={feedback}
        tabIndex={-1}
        className="grid gap-3 focus:outline-none"
        aria-live="polite"
      >
        {props.savedUnknown && !result ? <RuleAlert message={t('savedUnknown')} /> : null}

        {local.kind === 'ranges' ? (
          <RuleAlert message={message('R3_not_numeric', props.locale)}>
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

        {local.kind === 'unreadable' ? <RuleAlert message={t('unreadable')} /> : null}

        {local.kind === 'centimes' ? (
          <RuleAlert message={message('currency_centimes', props.locale)}>
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
            <p className="font-bold">{t('confirmTitle')}</p>
            <p lang="ar" dir="rtl" className="text-body">
              {confirm.text}
            </p>
            <p className="text-muted">{t('confirmNote')}</p>
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
        {result?.status === 'rejected' ? <FindingList findings={result.findings} /> : null}
        {result?.status === 'invalid' ? (
          <RuleAlert message={t('invalid')}>
            <ul className="mt-1 grid list-disc gap-1 ps-5">
              {result.messages.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </RuleAlert>
        ) : null}
        {result?.status === 'error' && result.reason === 'failed' ? (
          <RuleAlert message={t('error')} />
        ) : null}
        {stale ? (
          <RuleAlert message={t('stale')}>
            <TextLink href={props.overviewHref}>{t('staleOverview')}</TextLink>
          </RuleAlert>
        ) : null}
        {notes.length > 0 ? <FindingList findings={notes} /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {saved ? (
          <ButtonLink href={saved.next ?? props.overviewHref} variant="primary">
            {t('continue')}
          </ButtonLink>
        ) : (
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? t('saving') : t('next')}
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
      <LeaveGuard active={unsaved} />
    </form>
  );
}
