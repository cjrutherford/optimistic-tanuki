import { validHttpResponse } from './fixtures/types/valid-http-response.js';
import type { HttpResponse } from '../src/types.js';

describe('strict HTTP response contract', () => {
  it('accepts a response carrying final URL and complete redirect chain', () => {
    const response: HttpResponse = validHttpResponse;
    expect(response.finalUrl).toBe('https://example.test/story');
    expect(response.redirectChain).toStrictEqual([
      'https://example.test/story',
    ]);
  });
});
