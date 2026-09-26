import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type ConfigShape = {
  vault?: {
    ollama?: { baseUrl?: string };
    model?: {
      name?: string;
      numCtx?: number;
      temperature?: number;
      timeoutMs?: number;
    };
  };
};

const writeConfig = (yaml: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-vault-config-'));
  const file = path.join(dir, 'config.yaml');
  fs.writeFileSync(file, yaml);
  return file;
};

const load = async (yaml: string): Promise<ConfigShape> => {
  process.env.GATEWAY_CONFIG_PATH = writeConfig(yaml);
  const { loadConfig } = await import('./config');
  return loadConfig() as ConfigShape;
};

describe('gateway vault model configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GATEWAY_CONFIG_PATH;
    delete process.env.VAULT_OLLAMA_BASE_URL;
    delete process.env.VAULT_OLLAMA_MODEL;
    delete process.env.VAULT_OLLAMA_NUM_CTX;
    delete process.env.VAULT_OLLAMA_TEMPERATURE;
    delete process.env.VAULT_OLLAMA_TIMEOUT_MS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reads the vault model and endpoint from configuration', async () => {
    const config = await load(
      [
        'listenPort: 3000',
        'services: {}',
        'vault:',
        '  ollama:',
        '    baseUrl: http://10.1.4.9:11434',
        '  model:',
        '    name: qwen2.5-coder:14b',
        '    numCtx: 32768',
      ].join('\n')
    );

    expect(config.vault?.ollama?.baseUrl).toBe('http://10.1.4.9:11434');
    expect(config.vault?.model?.name).toBe('qwen2.5-coder:14b');
    expect(config.vault?.model?.numCtx).toBe(32768);
  });

  it('lets the environment name the local endpoint the vault may reach', async () => {
    process.env.VAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

    const config = await load(
      [
        'listenPort: 3000',
        'services: {}',
        'vault:',
        '  ollama:',
        '    baseUrl: ""',
      ].join('\n')
    );

    expect(config.vault?.ollama?.baseUrl).toBe('http://127.0.0.1:11434');
  });

  it('leaves the endpoint unset when neither config nor environment names one', async () => {
    // No host in source, on purpose. The previous deployment carried a
    // hardcoded tailnet address here, which meant the air gap was whatever that
    // one machine happened to be.
    const config = await load(
      [
        'listenPort: 3000',
        'services: {}',
        'vault:',
        '  ollama:',
        '    baseUrl: ""',
      ].join('\n')
    );

    expect(config.vault?.ollama?.baseUrl).toBeUndefined();
  });

  it('treats an unresolved placeholder as unset rather than as a hostname', async () => {
    const config = await load(
      [
        'listenPort: 3000',
        'services: {}',
        'vault:',
        '  ollama:',
        '    baseUrl: ${VAULT_OLLAMA_BASE_URL}',
      ].join('\n')
    );

    expect(config.vault?.ollama?.baseUrl).toBeUndefined();
  });

  it('keeps the shipped configuration free of a hardcoded model host', async () => {
    const shipped = fs.readFileSync(
      path.resolve(__dirname, 'assets/config.yaml'),
      'utf8'
    );

    expect(shipped).not.toMatch(/100\.89\.87\.124/);
    expect(shipped).toMatch(/qwen2\.5-coder:14b/);
  });
});
