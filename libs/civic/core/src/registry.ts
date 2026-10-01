import type { SourceAdapter } from './types.js';

const adapters = new Map<string, SourceAdapter>();

export function registerAdapter(adapter: SourceAdapter): void {
  adapters.set(adapter.name, adapter);
}

export function getAdapter(name: string): SourceAdapter {
  const adapter = adapters.get(name);
  if (!adapter) throw new Error(`Unknown adapter: ${name}`);
  return adapter;
}

export function listAdapters(): string[] {
  return [...adapters.keys()];
}
