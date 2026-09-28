import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertLocalVaultEndpoint } from './local-endpoint.guard';

export class VaultModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultModelError';
  }
}

export const VAULT_DEFAULT_MODEL = 'qwen2.5-coder:14b';
export const VAULT_DEFAULT_NUM_CTX = 32768;
export const VAULT_DEFAULT_TEMPERATURE = 0.1;
export const VAULT_DEFAULT_TIMEOUT_MS = 60000;

type VaultConfig = {
  ollama?: { baseUrl?: string };
  model?: {
    name?: string;
    numCtx?: number;
    temperature?: number;
    timeoutMs?: number;
  };
};

export type VaultGeneration = {
  model: string;
  text: string;
};

const envValue = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

const envNumber = (key: string): number | undefined => {
  const value = envValue(key);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const positive = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;

/**
 * The only thing in the gateway that speaks to a language model.
 *
 * The copilot used to open its own connection to Ollama from the AI service,
 * which meant the air gap was a sentence in a response object rather than a
 * control. Model access is now a tool like every other privileged operation:
 * the caller is an authenticated MCP session, and the request goes through
 * here, where the endpoint is re-checked against the local-network rule on every
 * call and redirects are refused outright.
 *
 * Nothing in this class invents an answer. An unreachable model, a non-2xx, an
 * empty completion, or a body with no completion in it are all errors, because
 * every one of them would otherwise be a response with no content behind it.
 */
@Injectable()
export class VaultModelService {
  private readonly logger = new Logger(VaultModelService.name);

  constructor(private readonly config: ConfigService) {}

  async generate(request: {
    prompt: string;
    system?: string;
    format?: 'json';
  }): Promise<VaultGeneration> {
    const settings = this.settings();
    const endpoint = await assertLocalVaultEndpoint(settings.baseUrl);
    const target = new URL('/api/generate', endpoint.origin);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), settings.timeoutMs);

    try {
      const response = await fetch(target.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'error',
        signal: controller.signal,
        body: JSON.stringify({
          model: settings.model,
          prompt: request.prompt,
          ...(request.system ? { system: request.system } : {}),
          stream: false,
          ...(request.format ? { format: request.format } : {}),
          options: {
            num_ctx: settings.numCtx,
            temperature: settings.temperature,
          },
        }),
      });

      if (!response.ok) {
        throw new VaultModelError(
          `The local model returned status ${response.status}.`
        );
      }

      const body = (await response.json()) as { response?: unknown };
      if (typeof body?.response !== 'string' || !body.response.trim()) {
        throw new VaultModelError(
          'The local model returned no generated content.'
        );
      }

      this.logger.log(
        `Generated ${body.response.length} characters on ${settings.model} at ${endpoint.origin}.`
      );

      return { model: settings.model, text: body.response };
    } catch (error) {
      if (error instanceof VaultModelError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new VaultModelError(
          `The local model did not answer within ${settings.timeoutMs}ms.`
        );
      }
      throw new VaultModelError(
        `The local model could not be reached: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  describe(): { model: string; endpointConfigured: boolean } {
    const settings = this.settings();
    return {
      model: settings.model,
      endpointConfigured: Boolean(settings.baseUrl?.trim()),
    };
  }

  private settings(): {
    baseUrl?: string;
    model: string;
    numCtx: number;
    temperature: number;
    timeoutMs: number;
  } {
    const vault = (this.config?.get<VaultConfig>('vault') ?? {}) as VaultConfig;

    return {
      baseUrl: envValue('VAULT_OLLAMA_BASE_URL') ?? vault.ollama?.baseUrl,
      model:
        envValue('VAULT_OLLAMA_MODEL') ??
        vault.model?.name?.trim() ??
        VAULT_DEFAULT_MODEL,
      numCtx: positive(
        envNumber('VAULT_OLLAMA_NUM_CTX') ?? vault.model?.numCtx,
        VAULT_DEFAULT_NUM_CTX
      ),
      temperature:
        typeof vault.model?.temperature === 'number' &&
        Number.isFinite(vault.model.temperature)
          ? vault.model.temperature
          : VAULT_DEFAULT_TEMPERATURE,
      timeoutMs: positive(
        envNumber('VAULT_OLLAMA_TIMEOUT_MS') ?? vault.model?.timeoutMs,
        VAULT_DEFAULT_TIMEOUT_MS
      ),
    };
  }
}
