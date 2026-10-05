import { unstable_rethrow } from 'next/navigation';

/**
 * Calls a Server Action from a component. The action returns its own failures (convention in
 * lib/diagnostic/actions.ts), but a dropped connection rejects the call itself: the form then
 * shows `failed` like any other failure, instead of the error page replacing what the person
 * entered. An action that threw on the server (an invariant violation, logged with its digest)
 * ends the same way. A redirect (such as a session that ended) still navigates.
 */
export async function callAction<Result>(
  action: () => Promise<Result>,
  failed: Result,
): Promise<Result> {
  try {
    return await action();
  } catch (error) {
    unstable_rethrow(error);
    return failed;
  }
}
