import { Field } from '@/components/ui/field';
import { TextInput } from '@/components/ui/text-input';

/** A labelled text field for the admin forms (a server component; the form that holds it is not). */
export function AdminField({
  id,
  name,
  label,
  hint,
  required = false,
  ltr = false,
  inputMode,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  /** Emails, ids and amounts read left to right inside the right-to-left page. */
  ltr?: boolean;
  inputMode?: 'numeric' | 'decimal' | 'email';
  defaultValue?: string;
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      {({ describedBy }) => (
        <TextInput
          id={id}
          name={name}
          required={required}
          dir={ltr ? 'ltr' : undefined}
          inputMode={inputMode}
          autoComplete="off"
          defaultValue={defaultValue}
          aria-describedby={describedBy}
        />
      )}
    </Field>
  );
}

/** A small table for the admin lists: left-to-right figures inside the right-to-left page. */
export function AdminTable({
  caption,
  head,
  children,
}: {
  caption: string;
  head: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-start text-small">
        <caption className="pb-2 text-start font-bold">{caption}</caption>
        <thead>
          <tr className="border-b border-hairline">
            {head.map((label) => (
              <th key={label} scope="col" className="px-2 py-2 text-start font-bold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({ children, ltr = false }: { children: React.ReactNode; ltr?: boolean }) {
  return (
    <td className="border-b border-hairline px-2 py-2 align-top">
      {ltr ? <bdi dir="ltr">{children}</bdi> : children}
    </td>
  );
}
