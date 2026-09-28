import 'server-only';
import { headers } from 'next/headers';
import { serverEnvSchema } from '@/env/server';

/**
 * Structured server logs (OBS-1): one JSON line per event, filtered by LOG_LEVEL and tagged with
 * the Vercel request id. Vercel keeps logs outside the EU (docs/OPEN-QUESTIONS.md #34), so a line
 * carries only the fields listed in FIELDS, each as a number or a short token: never an email, an
 * answer, a prompt or an error message (which can quote any of them). Any other field is dropped,
 * and a value that is not a short token is replaced by "[redacted]" (log.test.ts).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Dotted and lowercase, from the area to what happened: "diagnostic.save_failed". */
export type LogEvent = `${string}.${string}`;

export interface LogFields {
  /** Where in a flow the event happened, such as "upsert". */
  stage?: string | undefined;
  /** A Postgres, PostgREST, Supabase Auth or SDK error code. */
  code?: string | undefined;
  /** An HTTP status. */
  status?: number | undefined;
  /** Why something was refused or degraded, such as "stale". */
  reason?: string | undefined;
  /** The Next.js error digest, which the error pages show as a reference number. */
  digest?: string | undefined;
  /** The error's class, such as "TypeError"; never its message. */
  errorName?: string | undefined;
  /** A route template, such as "/[locale]/projects/[id]"; never the address itself. */
  route?: string | undefined;
  /** Opaque identifiers. */
  projectId?: string | undefined;
  questionId?: string | undefined;
  count?: number | undefined;
  /** Vercel's x-vercel-id; read from the request when not given. */
  requestId?: string | undefined;
}

const FIELDS = [
  'stage',
  'code',
  'status',
  'reason',
  'digest',
  'errorName',
  'route',
  'projectId',
  'questionId',
  'count',
  'requestId',
] as const satisfies readonly (keyof LogFields)[];

const LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

/** Letters, digits and ._:/-[]() only: no spaces, no "@", no Arabic text. */
const TOKEN = /^[\w.:/()[\]-]{1,200}$/;
const EVENT = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
export const REDACTED = '[redacted]';

const WRITE: Record<LogLevel, (line: string) => void> = {
  debug: (line) => {
    console.debug(line);
  },
  info: (line) => {
    console.info(line);
  },
  warn: (line) => {
    console.warn(line);
  },
  error: (line) => {
    console.error(line);
  },
};

function threshold(): LogLevel {
  const level = serverEnvSchema.shape.LOG_LEVEL.safeParse(process.env.LOG_LEVEL);
  return level.success ? level.data : 'info';
}

async function requestId(): Promise<string | undefined> {
  try {
    return (await headers()).get('x-vercel-id') ?? undefined;
  } catch {
    // Outside a request (build, instrumentation): there is no id to read.
    return undefined;
  }
}

/** The listed fields only, each a finite number or a short token (see the module comment). */
export function allowedFields(fields: LogFields): Record<string, string | number> {
  const clean: Record<string, string | number> = {};
  for (const key of FIELDS) {
    const value: unknown = (fields as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
    else clean[key] = typeof value === 'string' && TOKEN.test(value) ? value : REDACTED;
  }
  return clean;
}

/** The code, class and status of a thrown or returned error; never its message. */
export function errorFields(error: unknown): Pick<LogFields, 'code' | 'errorName' | 'status'> {
  if (typeof error !== 'object' || error === null) return {};
  const { code, name, status } = error as { code?: unknown; name?: unknown; status?: unknown };
  return {
    ...(typeof code === 'string' ? { code } : {}),
    ...(typeof name === 'string' ? { errorName: name } : {}),
    ...(typeof status === 'number' ? { status } : {}),
  };
}

async function write(level: LogLevel, event: LogEvent, fields: LogFields = {}): Promise<void> {
  try {
    if (LEVELS.indexOf(level) < LEVELS.indexOf(threshold())) return;
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      event: EVENT.test(event) ? event : 'log.invalid_event',
      ...allowedFields({ ...fields, requestId: fields.requestId ?? (await requestId()) }),
    });
    WRITE[level](line);
  } catch {
    // Logging never breaks the request it describes.
  }
}

/** Server-side logging. Each call writes at most one line and never throws. */
export const log = {
  debug: (event: LogEvent, fields?: LogFields) => write('debug', event, fields),
  info: (event: LogEvent, fields?: LogFields) => write('info', event, fields),
  warn: (event: LogEvent, fields?: LogFields) => write('warn', event, fields),
  error: (event: LogEvent, fields?: LogFields) => write('error', event, fields),
};
