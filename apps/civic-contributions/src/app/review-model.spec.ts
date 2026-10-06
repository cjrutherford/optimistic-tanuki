import { of } from 'rxjs';
import loadConfig from '../config';
import { reviewModel } from './review-model';

const ollamaReply = {
  model: 'm',
  message: { role: 'assistant', content: '{"ok":true}' },
  prompt_eval_count: 1,
  eval_count: 1,
};

const messages = [{ role: 'user' as const, content: 'hello' }];

describe('reviewModel', () => {
  afterEach(() => jest.restoreAllMocks());

  it("goes through prompt-proxy by default, sending Ollama's native body and never touching fetch", async () => {
    const globalFetch = jest.spyOn(globalThis, 'fetch');
    const send = jest.fn(() => of(ollamaReply));
    const config = loadConfig({});
    expect(config.llmTransport).toBe('prompt-proxy');

    const model = reviewModel(config, { send } as never);
    expect(await model.call(messages)).toBe('{"ok":true}');

    expect(send).toHaveBeenCalledTimes(1);
    const [pattern, body] = send.mock.calls[0] as unknown as [
      { cmd: string },
      { model: string; messages: unknown[]; stream: boolean }
    ];
    expect(pattern.cmd).toBe('SEND');
    expect(body.model).toBe(config.model.model);
    expect(body.stream).toBe(false);
    expect(body.messages).toHaveLength(1);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('calls the base URL directly when LLM_TRANSPORT=direct, without prompt-proxy', async () => {
    const globalFetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(ollamaReply), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const send = jest.fn();
    const config = loadConfig({
      LLM_TRANSPORT: 'direct',
      REVIEW_MODEL_BASE_URL: 'http://ollama.test:11434',
    });

    const model = reviewModel(config, { send } as never);
    expect(await model.call(messages)).toBe('{"ok":true}');

    expect(send).not.toHaveBeenCalled();
    expect(globalFetch).toHaveBeenCalledTimes(1);
    expect(String(globalFetch.mock.calls[0]?.[0])).toBe(
      'http://ollama.test:11434/api/chat'
    );
  });

  it('names the configured model', () => {
    expect(reviewModel(loadConfig({ REVIEW_MODEL: 'tiny:1b' })).name).toBe(
      'tiny:1b'
    );
  });
});
