import type { ClientProxy } from '@nestjs/microservices';
import type { ReviewModel } from '@optimistic-tanuki/civic-community';
import {
  requestChatCompletion,
  type FetchImplementation,
} from '@optimistic-tanuki/civic-llm';
import type { CommunityConfig } from '../config';
import { promptProxyFetch } from './model/prompt-proxy-fetch';

/** The review model, bound to the configured local model; the rules in civic-community decide what its answers mean. */
export const REVIEW_MODEL = Symbol('REVIEW_MODEL');
/** The TCP client to the platform's prompt-proxy. */
export const PROMPT_PROXY_CLIENT = 'PROMPT_PROXY_CLIENT';

/**
 * With LLM_TRANSPORT=prompt-proxy (the default) the model call goes to
 * Ollama's native API through prompt-proxy (D5); with `direct` it goes to
 * the configured base URL as the POC's did.
 */
export function reviewModel(
  config: CommunityConfig,
  promptProxy?: Pick<ClientProxy, 'send'>
): { name: string; call: ReviewModel } {
  const transport: { api?: 'ollama'; fetchImpl?: FetchImplementation } =
    config.llmTransport === 'prompt-proxy' && promptProxy
      ? {
          api: 'ollama',
          // Longer than the gateway's own timer, which decides `timeout`.
          fetchImpl: promptProxyFetch(promptProxy, {
            timeoutMs: config.model.timeoutMs + 10_000,
          }),
        }
      : {};
  return {
    name: config.model.model,
    call: async (messages) => {
      const response = await requestChatCompletion({
        baseUrl: config.model.baseUrl,
        model: config.model.model,
        messages,
        timeoutMs: config.model.timeoutMs,
        generation: { temperature: 0 },
        ...transport,
      });
      return response.content;
    },
  };
}
