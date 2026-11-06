'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { type CounterData, daysLeft, parseCounter } from '@/lib/launch/counter';

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: CounterData; readonly days: number | null }
  | { readonly status: 'unavailable' };

/** Western digits, isolated, in both languages (CLAUDE.md §6). */
function Num({ value }: { value: number }) {
  return <bdi className="num">{value}</bdi>;
}

/**
 * The public counter of the free launch window (D-331, D-344): the spots left of the total and the
 * days left, read from the database through /api/launch/window. A thin gold rule marks it; the
 * numbers are plain and heavy, because gold belongs to the one button of the page. The box keeps
 * its height while it loads and when the numbers cannot be read, so nothing around it moves, and
 * no number is ever shown that was not received.
 */
export function LaunchCounter() {
  const t = useTranslations('launch');
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/launch/window', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('status'))))
      .then((body: unknown) => {
        const data = parseCounter(body);
        // The days are counted here, when the answer arrives: a render must not read the clock.
        setState(
          data === null
            ? { status: 'unavailable' }
            : { status: 'ready', data, days: daysLeft(data.endsAt, Date.now()) },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'unavailable' });
      });
    return () => {
      controller.abort();
    };
  }, []);

  const data = state.status === 'ready' ? state.data : null;
  const days = state.status === 'ready' ? state.days : null;

  return (
    <div aria-live="polite" className="min-h-[5.5rem] border-s-[3px] border-gold-ink ps-4">
      {data === null ? null : data.open && days !== 0 ? (
        <div className="grid gap-1">
          <p className="font-display text-h3 font-extrabold">
            {t.rich('counterSpots', {
              spots: () => <Num value={data.spotsLeft} />,
              total: () => <Num value={data.spotsTotal} />,
            })}
          </p>
          {days === null ? null : (
            <p className="text-body font-bold text-ink-2">
              {t.rich('counterDays', { days: () => <Num value={days} /> })}
            </p>
          )}
        </div>
      ) : (
        <p className="reading text-small font-bold">{t('closed')}</p>
      )}
    </div>
  );
}
