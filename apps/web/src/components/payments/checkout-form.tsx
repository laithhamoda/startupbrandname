'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useRef, useState } from 'react';
import { FormError, submitTo } from '@/components/auth/form-helpers';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { callAction } from '@/lib/call-action';
import type { CheckoutStart } from '@/lib/payments/checkout-actions';

/** Paddle.js v2, loaded from Paddle's CDN only when a checkout starts. */
const PADDLE_JS = 'https://cdn.paddle.com/paddle/v2/paddle.js';

interface PaddleGlobal {
  Environment: { set: (environment: 'sandbox') => void };
  Initialize: (options: { token: string }) => void;
  Checkout: {
    open: (options: {
      items: { priceId: string; quantity: number }[];
      customer?: { email: string };
      customData: Record<string, string>;
      settings: { displayMode: 'overlay'; locale: string; successUrl: string };
    }) => void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

let loading: Promise<PaddleGlobal> | null = null;

function loadPaddle(): Promise<PaddleGlobal> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  loading ??= new Promise<PaddleGlobal>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PADDLE_JS;
    script.async = true;
    script.onload = () => {
      if (window.Paddle) resolve(window.Paddle);
      else reject(new Error('paddle.js loaded without Paddle'));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('paddle.js failed to load'));
    };
    document.head.append(script);
  });
  return loading;
}

let initialised: string | null = null;

function openCheckout(
  paddle: PaddleGlobal,
  start: Extract<CheckoutStart, { status: 'ready' }>,
  locale: string,
  successUrl: string,
) {
  if (initialised !== start.clientToken) {
    if (start.environment === 'sandbox') paddle.Environment.set('sandbox');
    paddle.Initialize({ token: start.clientToken });
    initialised = start.clientToken;
  }
  paddle.Checkout.open({
    items: [{ priceId: start.priceId, quantity: 1 }],
    ...(start.email ? { customer: { email: start.email } } : {}),
    customData: { checkout_ref: start.checkoutRef },
    settings: { displayMode: 'overlay', locale, successUrl },
  });
}

type FormState = CheckoutStart | { readonly status: 'idle' };

const IDLE: FormState = { status: 'idle' };
const FAILED: CheckoutStart = { status: 'error' };

/**
 * The 18+ confirmation and the button that opens Paddle's checkout over the page (M7 step 5). The
 * server records the confirmation and the reference before Paddle opens (D-086, D-317); the box
 * is never pre-ticked. A failure is shown beside the button, and the box keeps its state.
 */
export function CheckoutForm({
  locale,
  begin,
  successUrl,
}: {
  locale: string;
  begin: (formData: FormData) => Promise<CheckoutStart>;
  successUrl: string;
}) {
  const t = useTranslations('checkout');
  const [state, dispatch, pending] = useActionState<FormState, FormData>(
    (_previous, formData) => callAction(() => begin(formData), FAILED),
    IDLE,
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const opened = useRef<string | null>(null);

  useEffect(() => {
    if (state.status !== 'ready' || opened.current === state.checkoutRef) return;
    opened.current = state.checkoutRef;
    loadPaddle()
      .then((paddle) => {
        setLoadFailed(false);
        openCheckout(paddle, state, locale, successUrl);
      })
      .catch(() => {
        setLoadFailed(true);
      });
  }, [state, locale, successUrl]);

  const error =
    loadFailed || state.status === 'error'
      ? t('errors.failed')
      : state.status === 'limit'
        ? t('errors.limit')
        : state.status === 'closed'
          ? t('errors.closed')
          : state.status === 'owned'
            ? t('errors.owned')
            : null;

  return (
    <form noValidate onSubmit={submitTo(dispatch)} className="grid justify-items-start gap-4">
      <Checkbox
        id="adult"
        name="adult"
        label={t('adult')}
        error={state.status === 'adult_required' ? t('errors.adult') : undefined}
      />
      {error ? <FormError>{error}</FormError> : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? t('opening') : t('pay')}
      </Button>
      <p className="text-small text-muted">{t('secure')}</p>
    </form>
  );
}
