import type { SourceAdapter } from '../../../src/types.js';

export const failingSourceAdapter: SourceAdapter = {
  name: 'runner-failing-source',
  async fetch() { throw new Error('fixture fetch failure'); },
  async parse() { throw new Error('fixture parse failure'); },
};
