import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAdapter } from '@optimistic-tanuki/civic-core';
import { ALL_ADAPTERS, registerAllAdapters } from '../src/index.js';

describe('adapter registry', () => {
  it('registers every adapter folder in the lib', () => {
    const packaged = readdirSync(join(__dirname, '..', 'src'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const registered = ALL_ADAPTERS.map((adapter) =>
      adapter.name.replace(/-/gu, '')
    );
    for (const name of packaged) {
      expect(
        registered.some((candidate) => candidate === name.replace(/-/gu, ''))
      ).toBeTruthy();
    }
  });

  it('resolves every adapter a locality names', () => {
    registerAllAdapters();
    const directory = join(__dirname, '../../core/test/fixtures/localities');
    const named = new Set<string>();
    const walk = (path: string): void => {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        const child = join(path, entry.name);
        if (entry.isDirectory()) {
          walk(child);
          continue;
        }
        if (!entry.name.endsWith('.yaml')) continue;
        for (const match of readFileSync(child, 'utf8').matchAll(
          /^\s*adapter:\s*([\w-]+)/gmu
        ))
          named.add(match[1]!);
      }
    };
    walk(directory);
    expect(named.size > 0).toBeTruthy();
    for (const name of named) expect(() => getAdapter(name)).not.toThrow();
  });
});
