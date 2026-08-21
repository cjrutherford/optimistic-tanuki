import { ConfigService } from '@nestjs/config';
import { LlmOnboardingAnalysisService } from './llm-onboarding-analysis.service';

/**
 * The fallback exists because models differ in whether they honour Ollama's
 * structured-output `format`. `qwen3.5:4b-q8_0` ignores it and answers in prose
 * (0/3 schema conformance); `granite4:tiny-h` conforms with no coaxing (3/3).
 * When the primary returns something the schema rejects, one retry on a model
 * that behaves is cheaper than dropping the user to a scripted question.
 */
describe('LlmOnboardingAnalysisService model fallback', () => {
  const buildConfig = (overrides: Record<string, unknown> = {}) => {
    const values: Record<string, unknown> = {
      ollama: {
        host: 'ollama.test',
        port: 11434,
        model: 'primary-model',
        fallbackModel: 'fallback-model',
        temperature: 0.3,
      },
      'ollama.fallbackModel': 'fallback-model',
      'ollama.think': false,
      'ollama.timeoutMs': 0,
      ...overrides,
    };
    return { get: (key: string) => values[key] } as unknown as ConfigService;
  };

  /** Swaps both clients for stubs so no network call is made. */
  const withClients = (
    service: LlmOnboardingAnalysisService,
    primary: unknown,
    fallback: unknown
  ) => {
    (service as unknown as Record<string, unknown>)['llm'] = primary;
    (service as unknown as Record<string, unknown>)['fallbackLlm'] = fallback;
  };

  const reply = (content: string) => ({ content });

  it('retries on the fallback when the primary answers with prose', async () => {
    const service = new LlmOnboardingAnalysisService(buildConfig());
    const primary = {
      invoke: jest.fn().mockResolvedValue(reply('Tell me about a time...')),
    };
    const fallback = {
      invoke: jest.fn().mockResolvedValue(reply('{"question":"Go on?"}')),
    };
    withClients(service, primary, fallback);

    const result = await service.generateJson<{ question: string }>(
      'system',
      'user',
      { type: 'object', properties: { question: { type: 'string' } } }
    );

    expect(result.question).toBe('Go on?');
    expect(primary.invoke).toHaveBeenCalledTimes(1);
    expect(fallback.invoke).toHaveBeenCalledTimes(1);
  });

  it('does not call the fallback when the primary succeeds', async () => {
    const service = new LlmOnboardingAnalysisService(buildConfig());
    const primary = {
      invoke: jest.fn().mockResolvedValue(reply('{"question":"First try"}')),
    };
    const fallback = { invoke: jest.fn() };
    withClients(service, primary, fallback);

    const result = await service.generateJson<{ question: string }>(
      'system',
      'user',
      { type: 'object', properties: { question: { type: 'string' } } }
    );

    expect(result.question).toBe('First try');
    expect(fallback.invoke).not.toHaveBeenCalled();
  });

  it('surfaces the original failure when no fallback is configured', async () => {
    const service = new LlmOnboardingAnalysisService(buildConfig());
    const primary = { invoke: jest.fn().mockResolvedValue(reply('nope')) };
    withClients(service, primary, null);

    await expect(
      service.generateJson('system', 'user', {
        type: 'object',
        properties: { question: { type: 'string' } },
      })
    ).rejects.toThrow(/No valid JSON object/);
  });
});
