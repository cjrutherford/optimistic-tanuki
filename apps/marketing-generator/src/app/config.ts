import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export declare type MarketingGeneratorConfigType = {
  ollama: {
    host: string;
    port: number;
    model: string;
    temperature: number;
    timeoutMs: number;
  };
};

const toNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const resolveConfigPath = (): string => {
  const candidates = [
    path.resolve(currentDir, './assets/config.yaml'),
    path.resolve(currentDir, '../browser/assets/config.yaml'),
    path.resolve(process.cwd(), 'apps/marketing-generator/src/app/assets/config.yaml'),
    path.resolve(process.cwd(), 'dist/apps/marketing-generator/browser/assets/config.yaml'),
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate));

  if (!match) {
    throw new Error('Marketing generator config.yaml not found');
  }

  return match;
};

export const loadConfig = (): MarketingGeneratorConfigType => {
  const configFile = fs.readFileSync(resolveConfigPath(), 'utf8');
  const configData = yaml.load(configFile) as MarketingGeneratorConfigType;
  const ollamaConfig = configData.ollama;

  return {
    ...configData,
    ollama: {
      host: process.env['OLLAMA_HOST'] || ollamaConfig?.host || 'prompt-proxy',
      port: toNumber(process.env['OLLAMA_PORT'], ollamaConfig?.port ?? 11434),
      model: process.env['OLLAMA_MODEL'] || ollamaConfig?.model || 'gemma3',
      temperature: toNumber(
        process.env['OLLAMA_TEMPERATURE'],
        ollamaConfig?.temperature ?? 0.3
      ),
      timeoutMs: toNumber(
        process.env['OLLAMA_TIMEOUT_MS'],
        ollamaConfig?.timeoutMs ?? 120000
      ),
    },
  };
};

export default loadConfig;
