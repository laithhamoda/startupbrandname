import Anthropic from '@anthropic-ai/sdk';
import type { Usage } from './cost';
import { REVIEW_SYSTEM, REVIEW_TOOL, reviewUserMessage, type ReviewInput } from './review-text';

/** What every model call returns: the tool input the model produced, and the tokens used. */
export interface ToolCallResult {
  input: unknown;
  usage: Usage;
}

export interface AiClient {
  /** Reviews one de-identified answer (review-text.ts). */
  reviewText(model: string, input: ReviewInput): Promise<ToolCallResult>;
}

/**
 * The Anthropic API through the official SDK. The static instructions are marked for prompt
 * caching (CLAUDE.md §5); no sampling parameters are set, since newer models reject them.
 */
export function anthropicClient(
  apiKey: string,
  /** Tests pass their own fetch to see the request without calling the API. */
  options: { fetch?: typeof fetch } = {},
): AiClient {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 20_000, ...options });
  return {
    async reviewText(model, input) {
      const response = await client.messages.create({
        model,
        max_tokens: 1500,
        system: [{ type: 'text', text: REVIEW_SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: [REVIEW_TOOL],
        tool_choice: { type: 'tool', name: REVIEW_TOOL.name },
        messages: [{ role: 'user', content: reviewUserMessage(input) }],
      });
      const block = response.content.find((part) => part.type === 'tool_use');
      return {
        input: block?.type === 'tool_use' ? block.input : null,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
          cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        },
      };
    },
  };
}
