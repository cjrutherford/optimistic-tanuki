import {
  getOwnerConsoleEngineOptions,
  getRequestUrl,
  isOwnerConsoleProxyTrusted,
} from './server-ssr';

const mockRequest = (headers: Record<string, string>, extra: object = {}) =>
  ({
    get: (name: string) => headers[name.toLowerCase()],
    protocol: 'http',
    originalUrl: '/admin?x=1',
    ...extra,
  } as never);

describe('owner-console SSR wiring', () => {
  it('passes explicit allowed hosts to the engine', () => {
    const options = getOwnerConsoleEngineOptions({
      SSR_ALLOWED_HOSTS: 'oc.example.net',
    } as NodeJS.ProcessEnv);
    expect(options.allowedHosts).toEqual([
      'oc.example.net',
      'localhost',
      '127.0.0.1',
    ]);
  });

  it('falls back to localhost defaults when SSR_ALLOWED_HOSTS is empty', () => {
    const options = getOwnerConsoleEngineOptions({
      SSR_ALLOWED_HOSTS: '',
    } as NodeJS.ProcessEnv);
    expect(options.allowedHosts).toEqual(['localhost', '127.0.0.1']);
  });

  it('derives the prod host from OWNER_CONSOLE_UI_BASE_URL', () => {
    const options = getOwnerConsoleEngineOptions({
      OWNER_CONSOLE_UI_BASE_URL: 'https://oc.example.net',
    } as NodeJS.ProcessEnv);
    expect(options.allowedHosts).toContain('oc.example.net');
  });

  it('trusts proxy headers by default with explicit opt-out', () => {
    expect(isOwnerConsoleProxyTrusted({} as NodeJS.ProcessEnv)).toBe(true);
    expect(
      isOwnerConsoleProxyTrusted({
        SSR_TRUST_PROXY: '0',
      } as NodeJS.ProcessEnv)
    ).toBe(false);
    const options = getOwnerConsoleEngineOptions({} as NodeJS.ProcessEnv);
    expect(options.trustProxyHeaders).toBe(true);
  });
});

describe('getRequestUrl', () => {
  it('prefers x-forwarded-proto/host headers', () => {
    expect(
      getRequestUrl(
        mockRequest({
          'x-forwarded-proto': 'https,http',
          'x-forwarded-host': 'oc.example.net,internal:4000',
        })
      )
    ).toBe('https://oc.example.net/admin?x=1');
  });

  it('falls back to the request host when no forwarded headers exist', () => {
    expect(
      getRequestUrl(
        mockRequest({ host: 'internal:4000' }, { originalUrl: '/' })
      )
    ).toBe('http://internal:4000/');
  });
});
