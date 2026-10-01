import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  ConnectError,
  fetchWithAddressFallback,
  orderAddresses,
  OutboundPolicy,
  OutboundPolicyError,
} from '../src/outbound-policy.js';
import { enrichDiscoveredArticle } from '../src/article-enrichment.js';
import { loadLocalityRegistry } from '../src/locality-registry.js';
import { join } from 'node:path';
import { articleHtml } from './helpers/article-html.js';

async function captureRejection(
  p: Promise<unknown> | (() => Promise<unknown>)
): Promise<unknown> {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}
// Restricted publishers are derived from the checked-in locality configuration.
loadLocalityRegistry(join(__dirname, 'fixtures', 'localities'));

describe('outbound URL policy', () => {
  it('rejects private, loopback, link-local, reserved, and non-http URLs without network access', async () => {
    const policy = new OutboundPolicy({
      resolveHostname: async (hostname) =>
        ({
          localhost: ['127.0.0.1'],
          'private.test': ['10.0.0.8'],
          'link.test': ['169.254.1.1'],
          'v6.test': ['::1'],
          'public.test': ['93.184.216.34'],
        }[hostname] ?? []),
    });
    for (const url of [
      'http://localhost/a',
      'https://private.test/a',
      'https://link.test/a',
      'https://v6.test/a',
      'file:///tmp/a',
    ]) {
      await expect((() => policy.validate(url))()).rejects.toThrow(
        /outbound|private|loopback|link-local|protocol|reserved/i
      );
    }
    await (() => policy.validate('https://public.test/a'))();
  });

  it('requires same origin unless explicitly allowed and validates redirects', async () => {
    const seen: string[] = [];
    const policy = new OutboundPolicy({
      allowOrigins: ['https://cdn.test'],
      resolveHostname: async () => ['93.184.216.34'],
      fetch: async (input) => {
        seen.push(String(input));
        if (seen.length === 1)
          return new Response('', {
            status: 302,
            headers: { location: 'https://cdn.test/file.pdf' },
          });
        return new Response('ok', { status: 200 });
      },
    });
    const response = await policy.fetch('https://public.test/index');
    expect(response.status).toBe(200);
    expect(response.finalUrl).toBe('https://cdn.test/file.pdf');
    expect(response.redirectChain).toStrictEqual([
      'https://public.test/index',
      'https://cdn.test/file.pdf',
    ]);
    expect(seen).toStrictEqual([
      'https://public.test/index',
      'https://cdn.test/file.pdf',
    ]);
    await expect(
      (() =>
        policy.validate(
          'https://evil.test/file',
          'https://public.test/index'
        ))()
    ).rejects.toThrow(/origin|allow/i);
  });

  it('enables public cross-origin redirects only for the article fetch path', async () => {
    const seen: string[] = [];
    const policies: (boolean | undefined)[] = [];
    const policy = new OutboundPolicy({
      resolveHostname: async () => ['93.184.216.34'],
      fetch: async (input, init) => {
        seen.push(input);
        policies.push(init?.policy?.allowPublicCrossOriginRedirects);
        if (seen.length === 1)
          return new Response('', {
            status: 302,
            headers: { location: 'https://publisher.example/story' },
          });
        return new Response(
          articleHtml(
            'A public redirected article contains enough local detail for the briefing.'
          ),
          { status: 200 }
        );
      },
    });
    await expect(
      (() => policy.fetch('https://links.example/item'))()
    ).rejects.toThrow(/origin|allow/i);
    seen.length = 0;
    const result = await enrichDiscoveredArticle(
      {
        title: 'Redirected story',
        snippet: 'Feed summary',
        originalUrl: 'https://links.example/item',
      },
      { httpClient: policy }
    );
    expect(result.body).toMatch(/public redirected article/);
    expect(result.provenance.redirectChain).toStrictEqual([
      'https://links.example/item',
      'https://publisher.example/story',
    ]);
    expect(policies).toStrictEqual([undefined, true, true]);
  });

  it('blocks restricted registrable domains before DNS or transport on redirects', async () => {
    const requests: string[] = [];
    const lookups: string[] = [];
    const policy = new OutboundPolicy({
      resolveHostname: async (hostname) => {
        lookups.push(hostname);
        return ['93.184.216.34'];
      },
      fetch: async (input) => {
        requests.push(input);
        return new Response('', {
          status: 302,
          headers: { location: 'https://EDGE.THEBERRIENPRESS.COM:443/story/1' },
        });
      },
    });
    await expect(
      ((error: unknown) =>
        error instanceof OutboundPolicyError &&
        error.kind === 'policy' &&
        error.code === 'restricted-domain' &&
        error.url === 'https://edge.theberrienpress.com/story/1')(
        await captureRejection(() =>
          policy.fetch('https://links.example/item', {
            policy: {
              allowPublicCrossOriginRedirects: true,
              deniedRegistrableDomains: [
                'theberrienpress.com',
                'adelnewstribune.com',
              ],
            },
          })
        )
      )
    ).toBe(true);
    expect(requests).toStrictEqual(['https://links.example/item']);
    expect(lookups).toStrictEqual(['links.example']);
  });

  it('lets article enrichment deny restricted redirects while retaining only aggregate evidence', async () => {
    const requests: string[] = [];
    const lookups: string[] = [];
    const policy = new OutboundPolicy({
      resolveHostname: async (hostname) => {
        lookups.push(hostname);
        return ['93.184.216.34'];
      },
      fetch: async (input) => {
        requests.push(input);
        return new Response('', {
          status: 302,
          headers: { location: 'https://www.adelnewstribune.com:443/story/42' },
        });
      },
    });
    const result = await enrichDiscoveredArticle(
      {
        title: 'Adel update',
        snippet: 'Aggregate-only snippet.',
        originalUrl: 'https://links.example/item',
      },
      { httpClient: policy }
    );
    expect(requests).toStrictEqual(['https://links.example/item']);
    expect(lookups).toStrictEqual(['links.example']);
    expect(result.accessMode).toBe('snippet-only');
    expect(result.canonicalUrl).toBe(null);
    expect(result.unresolvedAggregateLink).toBe(true);
    expect(result.provenance.policyBlock).toStrictEqual({
      code: 'restricted-domain',
      url: 'https://www.adelnewstribune.com/story/42',
    });
  });

  it('rejects declared and chunked response bodies over the byte ceiling before returning them', async () => {
    const policy = new OutboundPolicy({
      resolveHostname: async () => ['93.184.216.34'],
      fetch: async (input) =>
        new Response(
          input.endsWith('/declared')
            ? 'x'
            : new ReadableStream({
                start(controller) {
                  controller.enqueue(new Uint8Array([1, 2, 3]));
                  controller.enqueue(new Uint8Array([4, 5, 6]));
                  controller.close();
                },
              }),
          {
            status: 200,
            headers: input.endsWith('/declared')
              ? { 'content-length': '999' }
              : undefined,
          }
        ),
    });
    await expect(
      (() => policy.fetch('https://public.test/declared', { maxBytes: 4 }))()
    ).rejects.toThrow(/size|byte|large/i);
    await expect(
      (() => policy.fetch('https://public.test/chunked', { maxBytes: 4 }))()
    ).rejects.toThrow(/size|byte|large/i);
  });

  it('aborts a pinned request when its finite timeout expires', async () => {
    const policy = new OutboundPolicy({
      resolveHostname: async () => ['93.184.216.34'],
      fetch: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('request aborted')),
            { once: true }
          );
        }),
    });
    await expect(
      (() => policy.fetch('https://public.test/slow', { timeoutMs: 10 }))()
    ).rejects.toThrow(/timed out|aborted/i);
  });

  it('returns strict response provenance when no redirect occurs', async () => {
    const policy = new OutboundPolicy({
      resolveHostname: async () => ['93.184.216.34'],
      fetch: async () => new Response('ok', { status: 200 }),
    });
    const response = await policy.fetch('https://public.test/index');
    expect(response.finalUrl).toBe('https://public.test/index');
    expect(response.redirectChain).toStrictEqual(['https://public.test/index']);
  });

  it('rejects malicious cross-origin links even when the index is allowed', async () => {
    const policy = new OutboundPolicy({
      resolveHostname: async () => ['93.184.216.34'],
    });
    await expect(
      (() =>
        policy.validate(
          'https://evil.test/file.pdf',
          'https://public.test/index'
        ))()
    ).rejects.toThrow(/origin|allow/i);
  });
});

describe('resolved address fallback', () => {
  it('tries IPv4 before IPv6 and keeps resolver order within each family', () => {
    expect(
      orderAddresses([
        '2607:f8b0::1',
        '142.250.1.1',
        '2607:f8b0::2',
        '142.250.1.2',
      ])
    ).toStrictEqual([
      '142.250.1.1',
      '142.250.1.2',
      '2607:f8b0::1',
      '2607:f8b0::2',
    ]);
  });

  it('moves to the next address only when the connection could not be established', async () => {
    const tried: string[] = [];
    const response = await fetchWithAddressFallback(
      'https://example.test/feed',
      {},
      ['2607:f8b0::1', '142.250.1.1', '142.250.1.2'],
      1024,
      async (_url, _init, address) => {
        tried.push(address);
        if (address === '142.250.1.1')
          throw new ConnectError('connect ETIMEDOUT', 'ETIMEDOUT');
        return new Response('ok', { status: 200 });
      }
    );
    expect(response.status).toBe(200);
    expect(tried).toStrictEqual(['142.250.1.1', '142.250.1.2']);
  });

  it('does not retry failures after a request reached a server', async () => {
    const tried: string[] = [];
    await expect(
      (() =>
        fetchWithAddressFallback(
          'https://example.test/feed',
          {},
          ['142.250.1.1', '142.250.1.2'],
          1024,
          async (_url, _init, address) => {
            tried.push(address);
            throw Object.assign(new Error('socket hang up'), {
              code: 'ECONNRESET',
            });
          }
        ))()
    ).rejects.toThrow(/socket hang up/);
    expect(tried).toStrictEqual(['142.250.1.1']);
  });

  it('reports every address when none connect', async () => {
    await expect(
      (() =>
        fetchWithAddressFallback(
          'https://example.test/feed',
          {},
          ['142.250.1.1', '2607:f8b0::1'],
          1024,
          async () => {
            throw new ConnectError('connect ENETUNREACH', 'ENETUNREACH');
          }
        ))()
    ).rejects.toThrow(
      /could not connect to any resolved address \(142\.250\.1\.1: .*; 2607:f8b0::1: .*\)/
    );
  });

  it('classifies a refused socket as a connect failure and succeeds against a listening server', async () => {
    const closed = createServer();
    await new Promise<void>((resolve) =>
      closed.listen(0, '127.0.0.1', resolve)
    );
    const closedPort = (closed.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    await expect(
      (() =>
        fetchWithAddressFallback(
          `http://local.test:${closedPort}/`,
          {},
          ['127.0.0.1'],
          1024
        ))()
    ).rejects.toThrow(
      /could not connect to any resolved address \(127\.0\.0\.1: .*ECONNREFUSED/
    );

    const server = createServer((_request, response) => response.end('hello'));
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const { port } = server.address() as AddressInfo;
    try {
      const ok = await fetchWithAddressFallback(
        `http://local.test:${port}/`,
        {},
        ['127.0.0.1'],
        1024
      );
      expect(await ok.text()).toBe('hello');
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
