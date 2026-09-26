/** Exact wording from SPEC §6 for low-confidence pivotal numbers. */
export const ASSUMPTION_NOTE = 'هذا الرقم افتراض، اختبره قبل أن تبني عليه قراراً.';

export function AssumptionNote() {
  return (
    <p className="border border-dashed border-control px-4 py-2.5 text-small">{ASSUMPTION_NOTE}</p>
  );
}
