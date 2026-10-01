import { createHash } from 'node:crypto';
import type {
  ChatMessage,
  LlmGenerationSettings,
  LlmOperation,
} from './contracts.js';
import {
  buildOllamaResponseSchema,
  DynamicSchemaError,
  type CitationSchemaEvidence,
} from './schema-builder.js';
export {
  buildOllamaResponseSchema,
  OLLAMA_RESPONSE_SCHEMAS,
} from './schema-builder.js';
export {
  buildDynamicResponseSchema,
  buildResponseSchema,
} from './schema-builder.js';
export { DynamicSchemaError } from './schema-builder.js';
export type { CitationSchemaEvidence, JsonSchema } from './schema-builder.js';
export type { ChatMessage } from './contracts.js';

export const DEFAULT_OLLAMA_BASE_URL =
  'http://shangrila.tail5a4a0.ts.net:11434/v1';
// Chosen by `civic corpus eval-llm` on the recorded Georgia corpus (2026-09-17): on an
// 8 GB GPU with a 16k context, qwen3.5:4b-q8_0 completed every brief and story prompt with
// the most validated claims and the lowest latency; qwen3:8b and mistral:7b timed out.
export const DEFAULT_PRIMARY_MODEL = 'qwen3.5:4b-q8_0';
export const DEFAULT_FALLBACK_MODEL = 'qwen2.5:7b-instruct';

const RESPONSE_SCHEMA_NAMES: Record<LlmOperation, string> = {
  cluster: 'civic_cluster_response',
  brief: 'civic_brief_response',
  brief_plan: 'civic_brief_plan_response',
  story: 'civic_story_response',
  agenda_fixup: 'civic_agenda_fixup_response',
};

function responseFormat(
  operation?: LlmOperation,
  evidence?: readonly CitationSchemaEvidence[]
): Record<string, unknown> {
  if (!operation) return { type: 'json_object' };
  // Runtime validation below guarantees this branch has evidence. Keeping the
  // guard here also protects future callers that bypass request validation.
  if (!evidence?.length)
    throw new StrictLlmError(
      `Operation ${operation} requires a non-empty evidence set`,
      { code: 'invalid', operation }
    );
  const schema = buildOllamaResponseSchema(operation, evidence);
  return {
    type: 'json_schema',
    json_schema: {
      name: RESPONSE_SCHEMA_NAMES[operation],
      strict: true,
      schema,
    },
  };
}

export interface GatewayUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  [key: string]: number | undefined;
}
export interface GatewayChatResponse {
  content: string;
  raw: Record<string, unknown>;
  model: string;
  actualModel: string;
  usage?: GatewayUsage;
  latencyMs: number;
  promptSha256: string;
  outputSha256: string;
  attempt?: number;
}
export type FetchImplementation = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export class StrictLlmError extends Error {
  readonly code:
    | 'http'
    | 'timeout'
    | 'decode'
    | 'empty'
    | 'invalid'
    | 'unavailable';
  readonly operation?: LlmOperation;
  readonly model?: string;
  override readonly cause?: unknown;
  constructor(
    message: string,
    options: {
      code?: StrictLlmError['code'];
      operation?: LlmOperation;
      model?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'StrictLlmError';
    this.code = options.code ?? 'unavailable';
    this.operation = options.operation;
    this.model = options.model;
    this.cause = options.cause;
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}
export function sha256(value: unknown): string {
  return createHash('sha256')
    .update(typeof value === 'string' ? value : canonicalJson(value), 'utf8')
    .digest('hex');
}

/**
 * `ollama` uses Ollama's native /api/chat, which honors num_ctx and think.
 * Ollama's OpenAI-compatible endpoint silently keeps only the last ~2k prompt
 * tokens, so long prompts lose their instructions and early evidence.
 * `openai` is for OpenAI-compatible providers that manage context themselves.
 */
export type GatewayApi = 'ollama' | 'openai';

export function resolveGatewayApi(
  baseUrl: string,
  api?: GatewayApi
): GatewayApi {
  const configured =
    api ??
    (process.env['GATEWAY_API'] === 'ollama' ||
    process.env['GATEWAY_API'] === 'openai'
      ? process.env['GATEWAY_API']
      : undefined);
  if (configured) return configured;
  return /:11434(?:\/|$)/u.test(baseUrl) ? 'ollama' : 'openai';
}

interface ChatCompletionBaseOptions {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  timeoutMs?: number;
  api?: GatewayApi;
  fetchImpl?: FetchImplementation;
  /** Alias useful to callers that inject a transport named `fetch`. */
  fetch?: FetchImplementation;
  attempt?: number;
  /** Optional OpenAI-compatible generation controls. */
  generation?: LlmGenerationSettings;
}

/** Legacy transport is intentionally operationless and receives json_object. */
export interface LegacyChatCompletionOptions extends ChatCompletionBaseOptions {
  operation?: undefined;
  evidence?: undefined;
}

/** Every structured operation must carry the exact evidence identities it may cite. */
export interface EvidenceBoundChatCompletionOptions
  extends ChatCompletionBaseOptions {
  operation: LlmOperation;
  evidence: readonly CitationSchemaEvidence[];
}

export type ChatCompletionOptions =
  | LegacyChatCompletionOptions
  | EvidenceBoundChatCompletionOptions;

export async function requestChatCompletion(
  options: ChatCompletionOptions
): Promise<GatewayChatResponse> {
  if (options.operation !== undefined) {
    if (!Array.isArray(options.evidence) || options.evidence.length === 0) {
      throw new StrictLlmError(
        `Operation ${options.operation} requires an explicit non-empty evidence set`,
        { code: 'invalid', operation: options.operation, model: options.model }
      );
    }
    try {
      buildOllamaResponseSchema(options.operation, options.evidence);
    } catch (error) {
      if (error instanceof DynamicSchemaError)
        throw new StrictLlmError(
          `Invalid ${options.operation} evidence schema: ${error.message}`,
          {
            code: 'invalid',
            operation: options.operation,
            model: options.model,
            cause: error,
          }
        );
      throw error;
    }
  } else if ((options as { evidence?: unknown }).evidence !== undefined) {
    throw new StrictLlmError('Evidence-bound requests require an operation', {
      code: 'invalid',
      model: options.model,
    });
  }
  const timeoutMs = Math.max(
    1,
    Math.min(options.timeoutMs ?? 120_000, 300_000)
  );
  const fetcher = options.fetchImpl ?? options.fetch ?? fetch;
  const messages = options.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const api = resolveGatewayApi(options.baseUrl, options.api);
  const promptSha256 = sha256(messages);
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const started = Date.now();
  try {
    let response: Response;
    try {
      const generation = options.generation ?? {};
      const format = responseFormat(options.operation, options.evidence);
      const requestBody =
        api === 'ollama'
          ? {
              model: options.model,
              messages,
              stream: false,
              // Thinking output is never used and multiplies latency; evaluation may turn it on.
              think: generation.think ?? false,
              format:
                format['type'] === 'json_schema'
                  ? (format['json_schema'] as { schema: unknown }).schema
                  : 'json',
              options: {
                ...(generation.temperature === undefined
                  ? {}
                  : { temperature: generation.temperature }),
                ...(generation.seed === undefined
                  ? {}
                  : { seed: generation.seed }),
                ...(generation.numCtx === undefined
                  ? {}
                  : { num_ctx: generation.numCtx }),
                ...(generation.numPredict === undefined
                  ? {}
                  : { num_predict: generation.numPredict }),
                ...(generation.repeatPenalty === undefined
                  ? {}
                  : { repeat_penalty: generation.repeatPenalty }),
                ...(generation.repeatLastN === undefined
                  ? {}
                  : { repeat_last_n: generation.repeatLastN }),
              },
            }
          : {
              model: options.model,
              messages,
              response_format: format,
              ...(generation.temperature === undefined
                ? {}
                : { temperature: generation.temperature }),
              ...(generation.seed === undefined
                ? {}
                : { seed: generation.seed }),
            };
      const endpoint =
        api === 'ollama'
          ? `${options.baseUrl
              .replace(/\/$/, '')
              .replace(/\/v1$/u, '')}/api/chat`
          : `${options.baseUrl.replace(/\/$/, '')}/chat/completions`;
      const request = fetcher(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          controller.abort();
          reject(
            new StrictLlmError(`Ollama request timeout after ${timeoutMs}ms`, {
              code: 'timeout',
              operation: options.operation,
              model: options.model,
            })
          );
        }, timeoutMs);
      });
      response = await Promise.race([request, timeout]);
    } catch (error) {
      if (controller.signal.aborted)
        throw new StrictLlmError(
          `Ollama request timeout after ${timeoutMs}ms`,
          {
            code: 'timeout',
            operation: options.operation,
            model: options.model,
            cause: error,
          }
        );
      throw new StrictLlmError(
        `Ollama request unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { operation: options.operation, model: options.model, cause: error }
      );
    }
    if (!response.ok)
      throw new StrictLlmError(
        `Ollama gateway ${response.status}: ${(await response.text()).slice(
          0,
          500
        )}`,
        { code: 'http', operation: options.operation, model: options.model }
      );
    let raw: Record<string, unknown>;
    try {
      const parsed: unknown = await response.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('response is not an object');
      raw = parsed as Record<string, unknown>;
    } catch (error) {
      throw new StrictLlmError('Ollama response was not valid JSON', {
        code: 'decode',
        operation: options.operation,
        model: options.model,
        cause: error,
      });
    }
    const choices = raw['choices'];
    const message =
      api === 'ollama'
        ? raw['message']
        : Array.isArray(choices) && choices[0] && typeof choices[0] === 'object'
        ? (choices[0] as Record<string, unknown>)['message']
        : undefined;
    const content =
      message && typeof message === 'object'
        ? (message as Record<string, unknown>)['content']
        : undefined;
    if (typeof content !== 'string' || !content.trim())
      throw new StrictLlmError('Ollama returned empty content', {
        code: 'empty',
        operation: options.operation,
        model: options.model,
      });
    const actualModel =
      typeof raw['model'] === 'string' && raw['model']
        ? raw['model']
        : options.model;
    const usage: GatewayUsage | undefined =
      api === 'ollama'
        ? {
            prompt_tokens:
              typeof raw['prompt_eval_count'] === 'number'
                ? raw['prompt_eval_count']
                : undefined,
            completion_tokens:
              typeof raw['eval_count'] === 'number'
                ? raw['eval_count']
                : undefined,
          }
        : raw['usage'] && typeof raw['usage'] === 'object'
        ? (raw['usage'] as GatewayUsage)
        : undefined;
    // Ollama truncates prompts to the context window instead of failing; a full window means lost instructions or evidence.
    const numCtx = options.generation?.numCtx;
    if (
      api === 'ollama' &&
      numCtx &&
      usage?.prompt_tokens !== undefined &&
      usage.prompt_tokens >= numCtx - 32
    ) {
      throw new StrictLlmError(
        `prompt used ${usage.prompt_tokens} of ${numCtx} context tokens and was likely truncated`,
        { code: 'invalid', operation: options.operation, model: options.model }
      );
    }
    return {
      content,
      raw,
      model: actualModel,
      actualModel,
      usage,
      latencyMs: Date.now() - started,
      promptSha256,
      outputSha256: sha256(content),
      ...(options.attempt ? { attempt: options.attempt } : {}),
    };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/** Legacy string helper retained for the standalone model-eval harness. */
export function chatCompletion(
  options: ChatCompletionOptions
): Promise<GatewayChatResponse>;
export function chatCompletion(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  timeoutMs?: number
): Promise<string>;
export async function chatCompletion(
  baseOrOptions: string | ChatCompletionOptions,
  model?: string,
  messages?: ChatMessage[],
  timeoutMs = 120_000
): Promise<string | GatewayChatResponse> {
  if (typeof baseOrOptions !== 'string')
    return requestChatCompletion(baseOrOptions);
  return (
    await requestChatCompletion({
      baseUrl: baseOrOptions,
      model: model as string,
      messages: messages ?? [],
      timeoutMs,
    })
  ).content;
}

export const ollamaChatCompletion = requestChatCompletion;
