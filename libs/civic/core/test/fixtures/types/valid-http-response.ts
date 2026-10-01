import type { HttpResponse } from '../../../src/types.js';

class FixtureHttpResponse extends Response {
  readonly finalUrl: string;
  readonly redirectChain: readonly string[];

  constructor(url: string) {
    super('ok', { status: 200 });
    this.finalUrl = url;
    this.redirectChain = [url];
  }
}

export const validHttpResponse = new FixtureHttpResponse('https://example.test/story') satisfies HttpResponse;
