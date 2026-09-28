'use client';

import { ErrorView } from '@/components/error-view';

/** A signed-in page failed: the header stays, with a retry and the way back to the projects. */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorView digest={error.digest} retry={retry} way="projects" />;
}
