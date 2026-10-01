import type { HttpResponse } from '../../../src/types.js';

const plainResponse = new Response('plain');

// @ts-expect-error an ordinary Response has no finalUrl or redirectChain metadata
export const invalidHttpResponse: HttpResponse = plainResponse;
