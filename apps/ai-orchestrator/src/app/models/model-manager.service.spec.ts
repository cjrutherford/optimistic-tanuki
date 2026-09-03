import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { ModelManager, ModelType } from './model-manager.service';

/**
 * The config file and this service have to agree about what a model type is
 * called.
 *
 * They did not. The service asked for `models.toolCalling`, the config file
 * defined `models.tool_calling`, and nothing anywhere compared the two. Three
 * of the four types fell through to a hardcoded default naming a model that
 * was not installed on the Ollama host, so tool calling, workflow control and
 * intent analysis were all pointed at something that did not exist. Nothing
 * failed loudly, because a missing config value and a working one look the
 * same to `configService.get`.
 */
describe('ModelManager configuration', () => {
  const configPath = join(__dirname, '..', '..', 'assets', 'config.yaml');

  function shippedConfig(): Record<string, { name?: string }> {
    const parsed = yaml.load(readFileSync(configPath, 'utf8')) as {
      models?: Record<string, { name?: string }>;
    };
    return parsed.models ?? {};
  }

  /** A ConfigService reading the file the service actually ships with. */
  function realConfigService(): ConfigService {
    const parsed = yaml.load(readFileSync(configPath, 'utf8')) as Record<
      string,
      unknown
    >;
    return {
      get: (path: string) =>
        path
          .split('.')
          .reduce<unknown>(
            (node, key) =>
              node && typeof node === 'object'
                ? (node as Record<string, unknown>)[key]
                : undefined,
            parsed
          ),
    } as ConfigService;
  }

  it('names every model type the code knows about', () => {
    const configured = Object.keys(shippedConfig());
    const missing = Object.values(ModelType).filter(
      (type) => !configured.includes(type)
    );

    expect(missing).toEqual([]);
  });

  it('resolves a model name for every type, from the real config file', () => {
    const manager = new ModelManager(realConfigService());

    const unresolved = Object.values(ModelType).filter(
      (type) => !manager.isModelConfigured(type)
    );

    expect(unresolved).toEqual([]);
  });

  it('refuses a type it has no model for, rather than substituting one', () => {
    // The old behaviour returned the conversational model for any unconfigured
    // type, so asking for a tool-calling model and getting a chat one looked
    // like the model being bad at tool calling rather than a missing setting.
    const empty = { get: () => undefined } as unknown as ConfigService;
    const manager = new ModelManager(empty);

    expect(() => manager.getModelConfig(ModelType.TOOL_CALLING)).toThrow(
      /No model configured for tool_calling/
    );
  });

  it('configures nothing at all when the config names nothing', () => {
    // The behavioural form of "no hardcoded model names". If a name is ever
    // baked into the service again, some type resolves here despite an empty
    // config and this fails.
    //
    // An earlier version of this test scanned the source for string literals
    // shaped like a model reference. It passed while the bug was present,
    // twice. Stripping comments with a regex ate the `//` inside
    // 'http://prompt-proxy:11434' and swallowed the rest of the file into one
    // fake literal, so there was nothing left to match. Asserting behaviour
    // needs no parsing and cannot be fooled that way.
    const empty = { get: () => undefined } as unknown as ConfigService;

    const manager = new ModelManager(empty);

    expect(manager.getConfiguredTypes()).toEqual([]);
  });

  it('carries the tuning the pilot actually ran with', () => {
    // The pilot chose these models at temperature 0 with a repeat penalty.
    // This service had no repeat penalty field at all and took 0.2 from
    // config, so the first end-to-end run produced a worse summary that
    // crammed three ids into one evidence field and took 61s instead of 23s.
    // Piloted numbers only transfer if the service uses the piloted settings.
    const manager = new ModelManager(realConfigService());
    const analysis = manager.getModelConfig(ModelType.PROJECT_ANALYSIS);

    expect(analysis.temperature).toBe(0);
    expect(analysis.repeatPenalty).toBe(1.1);
  });

  it('gives the summary job its own type, separate from the classifiers', () => {
    // A project summary is not conversation, tool calling, or classification,
    // and it wants depth where those want speed. The pilot picked different
    // models for them, which only works if they are different types.
    const models = shippedConfig();

    expect(models[ModelType.PROJECT_ANALYSIS]?.name).toBeTruthy();
    expect(models[ModelType.PROJECT_ANALYSIS]?.name).not.toEqual(
      models[ModelType.WORKFLOW_CONTROL]?.name
    );
  });
});

/**
 * How much each model is allowed to read.
 *
 * This was never set, so Ollama applied its own small default and silently
 * dropped the oldest part of anything longer. Measured on the real server: at
 * num_ctx 2048 a ten thousand token prompt reached the model as 1,026 tokens
 * and a fact planted at the front was simply gone, with nothing to say it had
 * been. The model answered confidently from what was left, which is the worst
 * shape a limit can take.
 */
describe('ModelManager and the context window', () => {
  function managerWith(values: Record<string, unknown>) {
    const config = {
      get: jest.fn((key: string) => values[key]),
    };
    const { ModelManager } = jest.requireActual('./model-manager.service');
    return new ModelManager(config as never);
  }

  const base = {
    'ollama.host': 'localhost',
    'ollama.port': 11434,
    'models.conversational.name': 'llama3.2:3b',
    'models.conversational.temperature': 0.7,
  };

  it('carries the configured window into the model config', () => {
    const manager = managerWith({
      ...base,
      'models.conversational.numCtx': 16384,
    });

    expect(manager.getModelConfig('conversational').numCtx).toBe(16384);
  });

  it('leaves it unset when nothing is configured, rather than inventing one', () => {
    // An invented default would be another silent limit, which is the problem
    // this exists to make visible.
    const manager = managerWith(base);

    expect(manager.getModelConfig('conversational').numCtx).toBeUndefined();
  });

  it('lets each model type have its own', () => {
    // The 8B models are expensive here and the 3B one is not, so they cannot
    // share a number.
    const manager = managerWith({
      ...base,
      'models.conversational.numCtx': 16384,
      'models.tool_calling.name': 'qwen3:8b',
      'models.tool_calling.temperature': 0.3,
      'models.tool_calling.numCtx': 8192,
    });

    expect(manager.getModelConfig('conversational').numCtx).toBe(16384);
    expect(manager.getModelConfig('tool_calling').numCtx).toBe(8192);
  });
});
