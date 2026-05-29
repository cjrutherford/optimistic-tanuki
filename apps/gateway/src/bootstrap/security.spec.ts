import type { Request } from 'express';
import {
  applyGatewaySecurityHeaders,
  enforceTrustedBrowserOrigins,
  isAllowedOrigin,
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

describe('gateway security helpers', () => {
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

  it('allows same-origin browser mutations', () => {
    expect(
      shouldRejectBrowserMutation(
        createRequest({ headers: { origin: 'http://localhost:3000' } })
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
    expect(next).toHaveBeenCalled();
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
