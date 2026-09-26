import { notFound } from 'next/navigation';

// Unknown paths under /ar or /en get the 404 page in their own language ([locale]/not-found.tsx).
// Paths the proxy skips (anything with a file extension) and whose first segment is not a
// language fail in the root layout and get Next.js's plain 404 page.
export default function UnknownPage() {
  notFound();
}
