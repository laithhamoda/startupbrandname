'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from './theme-script';

type ThemeChoice = 'system' | 'light' | 'dark';

const ORDER: readonly ThemeChoice[] = ['system', 'light', 'dark'];
const LABELS: Record<ThemeChoice, string> = { system: 'تلقائي', light: 'فاتح', dark: 'داكن' };
const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function applyChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage unavailable (private mode): the choice still applies to this page.
  }
  for (const listener of listeners) listener();
}

/** Cycles automatic → light → dark. Automatic follows the operating system (D-052). */
export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => 'system' as const);
  const Icon = ICONS[choice];
  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length] ?? 'system';

  return (
    <button
      type="button"
      onClick={() => {
        applyChoice(next);
      }}
      className="inline-flex items-center gap-2 rounded-control px-2 py-1 text-small text-ink-2 hover:bg-sunken"
      aria-label={`المظهر: ${LABELS[choice]}. التبديل إلى: ${LABELS[next]}`}
    >
      <Icon aria-hidden className="size-4" />
      <span>{LABELS[choice]}</span>
    </button>
  );
}
