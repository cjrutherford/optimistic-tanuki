import { NEVER, of, throwError } from 'rxjs';
import { promptProxyFetch } from './prompt-proxy-fetch';

const ollamaReply = {
  model: 'qwen3.5:4b-q8_0',
  message: { role: 'assistant', content: '{"ok":true}' },
  prompt_eval_count: 3,
  eval_count: 2,
};

describe('promptProxyFetch', () => {
  it('sends the native request body unchanged and returns the reply as JSON', async () => {
    const send = jest.fn(() => of(ollamaReply));
    const fetch = promptProxyFetch({ send } as never, { timeoutMs: 1000 });
    const body = {
      model: 'qwen3.5:4b-q8_0',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
      think: false,
      format: { type: 'object' },
      options: { num_ctx: 16384, seed: 7 },
    };
    const response = await fetch('http://ignored/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    expect(send).toHaveBeenCalledWith({ cmd: 'SEND' }, body);
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual(ollamaReply);
  });

  it('rejects when the proxy fails, so the gateway records it as unavailable', async () => {
    const fetch = promptProxyFetch(
      {
        send: () => throwError(() => new Error('connect ECONNREFUSED')),
      } as never,
      { timeoutMs: 1000 }
    );
    await expect(fetch('x', { body: '{}' })).rejects.toThrow(/ECONNREFUSED/);
  });

  it('gives up after its own timeout', async () => {
    const fetch = promptProxyFetch({ send: () => NEVER } as never, {
      timeoutMs: 20,
    });
    await expect(fetch('x', { body: '{}' })).rejects.toThrow(/Timeout/i);
  });

  it("stops waiting when the gateway's request is aborted", async () => {
    const fetch = promptProxyFetch({ send: () => NEVER } as never, {
      timeoutMs: 60_000,
    });
    const controller = new AbortController();
    const pending = fetch('x', { body: '{}', signal: controller.signal });
    controller.abort(new Error('gateway timeout'));
    await expect(pending).rejects.toThrow(/gateway timeout/);
  });

  it('refuses a request without a JSON string body', async () => {
    const fetch = promptProxyFetch({ send: () => NEVER } as never, {
      timeoutMs: 20,
    });
    await expect(fetch('x', {})).rejects.toThrow(/JSON string body/);
  });
});
