import type { Request } from 'express';
import type { AppRegistry } from '@optimistic-tanuki/app-registry-backend';
import {
  applyGatewaySecurityHeaders,
  enforceTrustedBrowserOrigins,
  getTrustedOrigins,
  isAllowedOrigin,
  isProxiedRequest,
  shouldRejectBrowserMutation,
} from './security';

const createRequest = (overrides: Partial<Request> = {}): Request => {
  const headers = new Map<string, string>();
  const incomingHeaders = (overrides.headers || {}) as Record<string, string>;

  for (const [key, value] of Object.entries(incomingHeaders)) {
    headers.set(key.toLowerCase(), value);
  }

  const request = {
    method: 'POST',
    path: '/api/social/posts',
    protocol: 'http',
    secure: false,
    headers: incomingHeaders,
    get(name: string) {
      if (name.toLowerCase() === 'host') {
        return 'localhost:3000';
      }
      return headers.get(name.toLowerCase());
    },
    ...overrides,
  } as Request;

  return request;
};

const registry: AppRegistry = {
  version: '1.0.0',
  generatedAt: '2026-06-23T00:00:00Z',
  apps: [
    {
      appId: 'client-interface',
      name: 'Optimistic Tanuki',
      domain: 'optimistic-tanuki.com',
      uiBaseUrl: 'https://optimistic-tanuki.com',
      apiBaseUrl: 'https://optimistic-tanuki.com/api',
      appType: 'client',
      visibility: 'public',
    },
    {
      appId: 'business-site',
      name: 'Business Site',
      domain: 'christopherrutherford.net',
      subdomain: 'business.experiments',
      uiBaseUrl: 'https://business.experiments.christopherrutherford.net',
      apiBaseUrl: 'https://business.experiments.christopherrutherford.net/api',
      appType: 'client',
      visibility: 'public',
    },
  ],
};

describe('gateway security helpers', () => {
  it('derives trusted origins from configured origins and registry uiBaseUrl values', () => {
    expect(
      getTrustedOrigins({
        configuredOrigins: ['https://towne-square.com'],
        registry,
      })
    ).toEqual(
      expect.arrayContaining([
        'https://towne-square.com',
        'https://optimistic-tanuki.com',
        'https://business.experiments.christopherrutherford.net',
      ])
    );
  });

  it('allows configured origins', () => {
    expect(
      isAllowedOrigin('https://portal.optimistictanuki.com', [
        'https://portal.optimistictanuki.com',
      ])
    ).toBe(true);
  });

  it('rejects untrusted origins', () => {
    expect(
      isAllowedOrigin('https://evil.example.com', [
        'https://portal.optimistictanuki.com',
      ])
    ).toBe(false);
  });

  it('allows all origins when the dev override is enabled', () => {
    const originalNodeEnv = process.env['NODE_ENV'];
    const originalOverride = process.env['DEV_ALLOW_ALL_BROWSER_ORIGINS'];

    process.env['NODE_ENV'] = 'development';
    process.env['DEV_ALLOW_ALL_BROWSER_ORIGINS'] = 'true';
    jest.resetModules();

    const reloaded = jest.requireActual(
      './security'
    ) as typeof import('./security');

    expect(
      reloaded.isAllowedOrigin('https://tailnet-machine.ts.net:8080', [])
    ).toBe(true);

    if (originalNodeEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalNodeEnv;
    }

    if (originalOverride === undefined) {
      delete process.env['DEV_ALLOW_ALL_BROWSER_ORIGINS'];
    } else {
      process.env['DEV_ALLOW_ALL_BROWSER_ORIGINS'] = originalOverride;
    }

    jest.resetModules();
  });

  it('allows same-origin browser mutations', () => {
    expect(
      shouldRejectBrowserMutation(
        createRequest({ headers: { origin: 'http://localhost:3000' } }),
        ['http://localhost:3000']
      )
    ).toBe(false);
  });

  it('rejects cross-site browser mutations from unknown origins', () => {
    expect(
      shouldRejectBrowserMutation(
        createRequest({
          headers: {
            origin: 'https://evil.example.com',
            'sec-fetch-site': 'cross-site',
          },
        })
      )
    ).toBe(true);
  });

  it('adds baseline security headers', () => {
    const headers = new Map<string, string>();
    const response = {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
    };
    const next = jest.fn();

    applyGatewaySecurityHeaders(createRequest(), response as never, next);

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Content-Security-Policy')).toContain(
      "default-src 'none'"
    );
    expect(headers.get('Cross-Origin-Opener-Policy')).toBe(
      'same-origin-allow-popups'
    );
    expect(next).toHaveBeenCalled();
  });

  it('allows proxied browser mutations when forwarded origin is trusted', () => {
    expect(
      shouldRejectBrowserMutation(
        createRequest({
          headers: {
            origin: 'https://optimistic-tanuki.com',
            'x-forwarded-host': 'optimistic-tanuki.com',
            'x-forwarded-proto': 'https',
            'sec-fetch-site': 'cross-site',
          },
        }),
        getTrustedOrigins({ registry })
      )
    ).toBe(false);
  });

  it('allows proxied same-origin browser mutations from private-network development hosts', () => {
    expect(
      shouldRejectBrowserMutation(
        createRequest({
          headers: {
            origin: 'http://192.168.1.50:8080',
            host: '192.168.1.50:8080',
            'x-forwarded-host': '192.168.1.50:8080',
            'x-forwarded-proto': 'http',
            'sec-fetch-site': 'same-origin',
          },
        }),
        getTrustedOrigins({ registry })
      )
    ).toBe(false);
  });

  it('allows proxied same-origin browser mutations from tailnet development hosts', () => {
    expect(
      shouldRejectBrowserMutation(
        createRequest({
          headers: {
            origin: 'http://demo.tailnet.ts.net:8080',
            host: 'demo.tailnet.ts.net:8080',
            'x-forwarded-host': 'demo.tailnet.ts.net:8080',
            'x-forwarded-proto': 'http',
            'sec-fetch-site': 'same-origin',
          },
        }),
        getTrustedOrigins({ registry })
      )
    ).toBe(false);
  });

  it('rejects proxied browser mutations when forwarded origin is not trusted', () => {
    expect(
      shouldRejectBrowserMutation(
        createRequest({
          headers: {
            origin: 'https://evil.example.com',
            'x-forwarded-host': 'evil.example.com',
            'x-forwarded-proto': 'https',
            'sec-fetch-site': 'cross-site',
          },
        }),
        getTrustedOrigins({ registry })
      )
    ).toBe(true);
  });

  it('identifies proxied requests', () => {
    expect(
      isProxiedRequest(
        createRequest({
          headers: {
            'x-forwarded-host': 'client.example.com',
            'x-forwarded-proto': 'https',
          },
        })
      )
    ).toBe(true);
  });

  it('blocks rejected browser mutations', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const response = { status, json };
    const next = jest.fn();

    enforceTrustedBrowserOrigins(
      createRequest({
        headers: {
          origin: 'https://evil.example.com',
          'sec-fetch-site': 'cross-site',
        },
      }),
      response as never,
      next
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      message: 'Cross-site browser mutations are not allowed.',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
