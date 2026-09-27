import type { Axis, Field, Question, QuestionId, Text } from '../types';

export function t(ar: string, en: string): Text {
  return { ar, en };
}

interface Definition {
  id: QuestionId;
  star?: boolean;
  optional?: boolean;
  /** Defaults to true: «لا أعرف» is accepted unless the question is structural (D-104). */
  allowUnknown?: boolean;
  field: Field;
  label: Text;
  help: Text;
  rules?: Question['rules'];
}

export function define(definition: Definition): Question {
  return {
    ...definition,
    axis: definition.id.charAt(0) as Axis,
    star: definition.star ?? false,
    optional: definition.optional ?? false,
    allowUnknown: definition.allowUnknown ?? true,
    rules: definition.rules ?? [],
  };
}
