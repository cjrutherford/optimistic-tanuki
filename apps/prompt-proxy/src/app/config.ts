import * as yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

export declare type PromptProxyConfigType = {
  listenPort: number;
  ollama: {
    apiUrl: string;
    apiPort: string | number;
  };
};

export const DEFAULT_OLLAMA_HOST = '100.89.87.124';
export const DEFAULT_OLLAMA_PORT = 11434;

type OllamaConfig = Partial<PromptProxyConfigType['ollama']>;

function validPort(
  value: string | number | undefined,
  fallback: number
): number {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : fallback;
}

export function resolveOllamaEndpoint(
  ollama: OllamaConfig = {},
  env: NodeJS.ProcessEnv = process.env
): string {
  const configuredHost = ollama.apiUrl?.trim() || DEFAULT_OLLAMA_HOST;
  const configuredPort = validPort(ollama.apiPort, DEFAULT_OLLAMA_PORT);
  const host = env.OLLAMA_HOST?.trim() || configuredHost;
  const port = validPort(env.OLLAMA_PORT, configuredPort);

  return `http://${host}:${port}`;
}

const loadConfig = () => {
  return yaml.load(
    fs.readFileSync(path.join(__dirname, '../assets/config.yaml')).toString()
  ) as PromptProxyConfigType;
};

export default loadConfig;
