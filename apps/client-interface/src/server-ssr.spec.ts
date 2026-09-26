import {
  getClientInterfaceEngineOptions,
  getRequestUrl,
  isClientInterfaceProxyTrusted,
} from './server-ssr';

const mockRequest = (headers: Record<string, string>, extra: object = {}) =>
  ({
    get: (name: string) => headers[name.toLowerCase()],
    protocol: 'http',
    originalUrl: '/feed?x=1',
    ...extra,
  } as never);

describe('client-interface SSR wiring', () => {
  it('passes explicit allowed hosts to the engine', () => {
    const options = getClientInterfaceEngineOptions({
      SSR_ALLOWED_HOSTS: 'optimistic-tanuki.com,*.optimistic-tanuki.com',
    } as NodeJS.ProcessEnv);
    expect(options.allowedHosts).toEqual([
      'optimistic-tanuki.com',
      '*.optimistic-tanuki.com',
      'localhost',
      '127.0.0.1',
    ]);
  });

  it('falls back to localhost defaults when SSR_ALLOWED_HOSTS is empty', () => {
    const options = getClientInterfaceEngineOptions({
      SSR_ALLOWED_HOSTS: '',
    } as NodeJS.ProcessEnv);
    expect(options.allowedHosts).toEqual(['localhost', '127.0.0.1']);
  });

  it('derives the prod host from CLIENT_INTERFACE_UI_BASE_URL', () => {
    const options = getClientInterfaceEngineOptions({
      CLIENT_INTERFACE_UI_BASE_URL: 'https://optimistic-tanuki.com',
    } as NodeJS.ProcessEnv);
    expect(options.allowedHosts).toContain('optimistic-tanuki.com');
  });

  it('never allows all hosts', () => {
    const options = getClientInterfaceEngineOptions({
      SSR_ALLOWED_HOSTS: 'optimistic-tanuki.com',
    } as NodeJS.ProcessEnv);
    expect(options.allowedHosts).not.toContain('*');
  });

  it('trusts proxy headers by default with explicit opt-out', () => {
    expect(isClientInterfaceProxyTrusted({} as NodeJS.ProcessEnv)).toBe(true);
    expect(
      isClientInterfaceProxyTrusted({
        SSR_TRUST_PROXY: 'false',
      } as NodeJS.ProcessEnv)
    ).toBe(false);
    const options = getClientInterfaceEngineOptions({} as NodeJS.ProcessEnv);
    expect(options.trustProxyHeaders).toBe(true);
  });
});

describe('getRequestUrl', () => {
  it('prefers x-forwarded-proto/host headers', () => {
    expect(
      getRequestUrl(
        mockRequest({
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'optimistic-tanuki.com',
          host: 'internal:4000',
        })
      )
    ).toBe('https://optimistic-tanuki.com/feed?x=1');
  });

  it('uses only the first forwarded value and falls back to the request', () => {
    expect(
      getRequestUrl(
        mockRequest(
          { host: 'internal:4000' },
          { protocol: 'http', originalUrl: '/' }
        )
      )
    ).toBe('http://internal:4000/');
  });
});
