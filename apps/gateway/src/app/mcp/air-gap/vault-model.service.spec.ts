import { ConfigService } from '@nestjs/config';
import { VaultModelError, VaultModelService } from './vault-model.service';
import { VaultAirGapError } from './local-endpoint.guard';

jest.mock('dns/promises', () => ({
  lookup: jest.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

type ConfigMap = Record<string, unknown>;

describe('VaultModelService', () => {
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  const configFor = (vault: ConfigMap): ConfigService =>
    ({
      get: (key: string) => (key === 'vault' ? vault : undefined),
    } as unknown as ConfigService);

  const okResponse = (body: unknown) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  describe('reaching the model', () => {
    it('posts to the configured local endpoint and nothing else', async () => {
      fetchMock.mockReturnValue(okResponse({ response: 'Local answer.' }));
      const service = new VaultModelService(
        configFor({ ollama: { baseUrl: 'http://127.0.0.1:11434' } })
      );

      const result = await service.generate({
        prompt: 'Question about Schedule C.',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://127.0.0.1:11434/api/generate');
      expect(init.method).toBe('POST');
      expect(result).toEqual({
        model: 'qwen2.5-coder:14b',
        text: 'Local answer.',
      });
    });

    it('refuses to follow a redirect, so the prompt cannot be replayed off-box', async () => {
      fetchMock.mockReturnValue(okResponse({ response: 'Local answer.' }));
      const service = new VaultModelService(
        configFor({ ollama: { baseUrl: 'http://127.0.0.1:11434' } })
      );

      await service.generate({ prompt: 'Question.' });

      expect(fetchMock.mock.calls[0][1].redirect).toBe('error');
    });

    it('uses the model the spec names for the vault path', async () => {
      fetchMock.mockReturnValue(okResponse({ response: 'ok' }));
      const service = new VaultModelService(
        configFor({ ollama: { baseUrl: 'http://127.0.0.1:11434' } })
      );

      await service.generate({ prompt: 'Question.' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.model).toBe('qwen2.5-coder:14b');
    });

    it('takes the model from config rather than from a caller', async () => {
      fetchMock.mockReturnValue(okResponse({ response: 'ok' }));
      const service = new VaultModelService(
        configFor({
          model: { name: 'qwen2.5-coder:14b' },
          ollama: { baseUrl: 'http://127.0.0.1:11434' },
        })
      );

      const result = await service.generate({ prompt: 'Question.' });

      expect(result.model).toBe('qwen2.5-coder:14b');
    });

    it('lets the environment override the configured model', async () => {
      process.env['VAULT_OLLAMA_MODEL'] = 'qwen2.5-coder:32b';
      fetchMock.mockReturnValue(okResponse({ response: 'ok' }));
      const service = new VaultModelService(
        configFor({
          model: { name: 'qwen2.5-coder:14b' },
          ollama: { baseUrl: 'http://127.0.0.1:11434' },
        })
      );

      expect((await service.generate({ prompt: 'Question.' })).model).toBe(
        'qwen2.5-coder:32b'
      );
    });

    it('lets the environment override the configured endpoint', async () => {
      process.env['VAULT_OLLAMA_BASE_URL'] = 'http://10.1.4.9:11434';
      fetchMock.mockReturnValue(okResponse({ response: 'ok' }));
      const service = new VaultModelService(
        configFor({ ollama: { baseUrl: 'http://127.0.0.1:11434' } })
      );

      await service.generate({ prompt: 'Question.' });

      expect(fetchMock.mock.calls[0][0]).toBe(
        'http://10.1.4.9:11434/api/generate'
      );
    });

    it('passes the context width and temperature the deployment configured', async () => {
      fetchMock.mockReturnValue(okResponse({ response: 'ok' }));
      const service = new VaultModelService(
        configFor({
          model: { name: 'qwen2.5-coder:14b', numCtx: 32768, temperature: 0.1 },
          ollama: { baseUrl: 'http://127.0.0.1:11434' },
        })
      );

      await service.generate({ prompt: 'Question.' });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).options).toEqual({
        num_ctx: 32768,
        temperature: 0.1,
      });
    });

    it('asks for a structured answer when the caller needs one', async () => {
      fetchMock.mockReturnValue(okResponse({ response: '{"answer":"x"}' }));
      const service = new VaultModelService(
        configFor({ ollama: { baseUrl: 'http://127.0.0.1:11434' } })
      );

      await service.generate({ prompt: 'Question.', format: 'json' });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).format).toBe('json');
    });

    it('bounds the request with an abort signal', async () => {
      fetchMock.mockReturnValue(okResponse({ response: 'ok' }));
      const service = new VaultModelService(
        configFor({ ollama: { baseUrl: 'http://127.0.0.1:11434' } })
      );

      await service.generate({ prompt: 'Question.' });

      expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('refusing to leave the network', () => {
    it('fails closed when no endpoint is configured at all', async () => {
      const service = new VaultModelService(configFor({}));

      await expect(service.generate({ prompt: 'Question.' })).rejects.toThrow(
        VaultAirGapError
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails closed when the configured endpoint is empty', async () => {
      const service = new VaultModelService(
        configFor({ ollama: { baseUrl: '   ' } })
      );

      await expect(service.generate({ prompt: 'Question.' })).rejects.toThrow(
        /not configured/i
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses a public host without making the request', async () => {
      const service = new VaultModelService(
        configFor({ ollama: { baseUrl: 'https://api.openai.com' } })
      );

      await expect(service.generate({ prompt: 'Question.' })).rejects.toThrow(
        VaultAirGapError
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('re-checks the endpoint on every call, not once at boot', async () => {
      const vault: ConfigMap = {
        ollama: { baseUrl: 'http://127.0.0.1:11434' },
      };
      const service = new VaultModelService(configFor(vault));
      fetchMock.mockReturnValue(okResponse({ response: 'ok' }));
      await service.generate({ prompt: 'First.' });

      vault['ollama'] = {
        baseUrl: 'https://generativelanguage.googleapis.com',
      };
      await expect(service.generate({ prompt: 'Second.' })).rejects.toThrow(
        VaultAirGapError
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('failing closed on a model that will not answer', () => {
    const service = (baseUrl = 'http://127.0.0.1:11434') =>
      new VaultModelService(configFor({ ollama: { baseUrl } }));

    it('reports an unreachable model rather than returning nothing', async () => {
      fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
      await expect(service().generate({ prompt: 'Question.' })).rejects.toThrow(
        /ECONNREFUSED/
      );
    });

    it('reports a non-2xx from the model rather than reading the body as an answer', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ response: 'trouble' }),
      });

      await expect(service().generate({ prompt: 'Question.' })).rejects.toThrow(
        /503/
      );
    });

    it('rejects an empty completion instead of passing an empty string on', async () => {
      fetchMock.mockReturnValue(okResponse({ response: '   ' }));

      await expect(service().generate({ prompt: 'Question.' })).rejects.toThrow(
        /no generated content/i
      );
    });

    it('rejects a body with no completion field at all', async () => {
      fetchMock.mockReturnValue(okResponse({ done: true }));

      await expect(service().generate({ prompt: 'Question.' })).rejects.toThrow(
        VaultModelError
      );
    });
  });

  describe('describing itself', () => {
    it('reports the model it would use without contacting anything', () => {
      const service = new VaultModelService(
        configFor({ ollama: { baseUrl: 'http://127.0.0.1:11434' } })
      );

      expect(service.describe()).toEqual({
        model: 'qwen2.5-coder:14b',
        endpointConfigured: true,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports an unconfigured deployment as unconfigured rather than assuming a host', () => {
      const service = new VaultModelService(configFor({}));

      expect(service.describe().endpointConfigured).toBe(false);
    });
  });
});
