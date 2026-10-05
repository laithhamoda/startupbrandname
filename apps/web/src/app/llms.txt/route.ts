import { llmsTxt } from '@/seo/llms';

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(llmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
