'use client';

import type { Field } from '@sbn/question-bank';
import { useState } from 'react';
import type { Draft } from '@/lib/diagnostic/draft';
import { type EditorOptions, FieldEditor } from './field-editor';

/** The answer controls with local state only, for the design gallery (no project, no saving). */
export function FieldPreview({
  id,
  labelledBy,
  describedBy,
  field,
  initialDraft,
  options,
}: {
  id: string;
  labelledBy: string;
  describedBy: string;
  field: Field;
  initialDraft: Draft;
  options: EditorOptions;
}) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  return (
    <FieldEditor
      id={id}
      labelledBy={labelledBy}
      describedBy={describedBy}
      field={field}
      draft={draft}
      onChange={setDraft}
      unreadable={[]}
      options={options}
    />
  );
}
