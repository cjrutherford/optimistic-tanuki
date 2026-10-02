import type { ClientProxy } from '@nestjs/microservices';
import { PromptCommands } from '@optimistic-tanuki/constants';
import type { FetchImplementation } from '@optimistic-tanuki/civic-llm';
import { firstValueFrom, timeout } from 'rxjs';

/**
 * Model calls through the platform's prompt-proxy (D5).
 *
 * civic-llm's gateway builds Ollama's native /api/chat request and calls it
 * through a fetch function. This one sends that body to prompt-proxy over
 * TCP, which forwards it to Ollama unchanged, and returns Ollama's reply as
 * a Response, so prompts, structured output, context size and provenance
 * recording are exactly what a direct call would produce.
 *
 * A proxy failure rejects, which the gateway records as `unavailable`; the
 * gateway's own timer still decides `timeout`, so the proxy's limit must be
 * longer than the gateway's (see PROMPT_PROXY_TIMEOUT_MS in compose).
 */
export function promptProxyFetch(
  client: Pick<ClientProxy, 'send'>,
  options: { timeoutMs: number }
): FetchImplementation {
  return async (_input, init) => {
    if (typeof init?.body !== 'string') {
      throw new Error('prompt-proxy fetch expects a JSON string body');
    }
    const body: unknown = JSON.parse(init.body);
    const reply = firstValueFrom(
      client
        .send({ cmd: PromptCommands.SEND }, body)
        .pipe(timeout(options.timeoutMs))
    );
    const signal = init.signal;
    const aborted = new Promise<never>((_, reject) => {
      if (!signal) return;
      if (signal.aborted) reject(signal.reason ?? new Error('aborted'));
      signal.addEventListener(
        'abort',
        () => reject(signal.reason ?? new Error('aborted')),
        { once: true }
      );
    });
    const data = await Promise.race([reply, aborted]);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}
