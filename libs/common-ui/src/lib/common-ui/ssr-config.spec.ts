import {
  getSsrAllowedHosts,
  getSsrEngineOptions,
  hostnameFromBaseUrl,
  isTrustProxyEnabled,
  matchesAllowedHost,
  parseAllowedHostsList,
} from './ssr-config';

describe('parseAllowedHostsList', () => {
  it('splits comma-separated values and trims entries', () => {
    expect(parseAllowedHostsList(' example.com , api.example.com ,, ')).toEqual(
      ['example.com', 'api.example.com']
    );
  });

  it('returns an empty list for empty or missing values', () => {
    expect(parseAllowedHostsList('')).toEqual([]);
    expect(parseAllowedHostsList('   ')).toEqual([]);
    expect(parseAllowedHostsList(undefined)).toEqual([]);
  });

  it('dedupes repeated hosts', () => {
    expect(parseAllowedHostsList('a.com,a.com,b.com')).toEqual([
      'a.com',
      'b.com',
    ]);
  });

  it('keeps wildcard entries verbatim', () => {
    expect(parseAllowedHostsList('*.example.com')).toEqual(['*.example.com']);
  });
});

describe('hostnameFromBaseUrl', () => {
  it('extracts hostnames from base URLs', () => {
    expect(hostnameFromBaseUrl('https://optimistic-tanuki.com')).toBe(
      'optimistic-tanuki.com'
    );
    expect(hostnameFromBaseUrl('http://localhost:8080')).toBe('localhost');
  });

  it('returns undefined for missing or invalid values', () => {
    expect(hostnameFromBaseUrl(undefined)).toBeUndefined();
    expect(hostnameFromBaseUrl('not a url')).toBeUndefined();
  });
});

describe('matchesAllowedHost', () => {
  it('matches exact hosts case-insensitively', () => {
    expect(matchesAllowedHost('Example.com', ['example.com'])).toBe(true);
    expect(matchesAllowedHost('other.com', ['example.com'])).toBe(false);
  });

  it('matches wildcard subdomains but not the apex', () => {
    expect(matchesAllowedHost('a.example.com', ['*.example.com'])).toBe(true);
    expect(matchesAllowedHost('example.com', ['*.example.com'])).toBe(false);
    expect(matchesAllowedHost('notexample.com', ['*.example.com'])).toBe(false);
  });
});

describe('getSsrAllowedHosts', () => {
  it('prefers SSR_ALLOWED_HOSTS and always keeps loopback defaults', () => {
    const hosts = getSsrAllowedHosts({
      SSR_ALLOWED_HOSTS: 'example.com, *.example.com',
    } as NodeJS.ProcessEnv);
    expect(hosts).toEqual([
      'example.com',
      '*.example.com',
      'localhost',
      '127.0.0.1',
    ]);
  });

  it('falls back to deprecated NG_ALLOWED_HOSTS for compatibility', () => {
    const hosts = getSsrAllowedHosts({
      NG_ALLOWED_HOSTS: 'legacy.example.com',
    } as NodeJS.ProcessEnv);
    expect(hosts).toContain('legacy.example.com');
    expect(hosts).toContain('localhost');
  });

  it('prefers SSR_ALLOWED_HOSTS over NG_ALLOWED_HOSTS', () => {
    const hosts = getSsrAllowedHosts({
      SSR_ALLOWED_HOSTS: 'new.example.com',
      NG_ALLOWED_HOSTS: 'legacy.example.com',
    } as NodeJS.ProcessEnv);
    expect(hosts).toContain('new.example.com');
    expect(hosts).not.toContain('legacy.example.com');
  });

  it('treats an empty SSR_ALLOWED_HOSTS as unset (dev still works)', () => {
    const hosts = getSsrAllowedHosts({
      SSR_ALLOWED_HOSTS: '',
    } as NodeJS.ProcessEnv);
    expect(hosts).toEqual(['localhost', '127.0.0.1']);
  });

  it('derives hosts from *_UI_BASE_URL env values when no explicit list', () => {
    const hosts = getSsrAllowedHosts({
      CLIENT_INTERFACE_UI_BASE_URL: 'https://optimistic-tanuki.com',
    } as NodeJS.ProcessEnv);
    expect(hosts).toContain('optimistic-tanuki.com');
    expect(hosts).toContain('localhost');
    expect(hosts).toContain('127.0.0.1');
  });

  it('derives hosts from extraBaseUrls and registry apps', () => {
    const hosts = getSsrAllowedHosts({} as NodeJS.ProcessEnv, {
      extraBaseUrls: ['https://oc.example.net'],
      registryApps: [{ uiBaseUrl: 'https://registry.example.org/app' }],
    });
    expect(hosts).toContain('oc.example.net');
    expect(hosts).toContain('registry.example.org');
  });

  it('never returns a wildcard-all entry from parsing', () => {
    const hosts = getSsrAllowedHosts({
      SSR_ALLOWED_HOSTS: 'example.com',
    } as NodeJS.ProcessEnv);
    expect(hosts).not.toContain('*');
  });
});

describe('isTrustProxyEnabled', () => {
  it('defaults to true when unset', () => {
    expect(isTrustProxyEnabled({} as NodeJS.ProcessEnv)).toBe(true);
  });

  it('supports explicit opt-out values', () => {
    for (const value of ['false', '0', 'no', 'off', 'FALSE']) {
      expect(
        isTrustProxyEnabled({ SSR_TRUST_PROXY: value } as NodeJS.ProcessEnv)
      ).toBe(false);
    }
    expect(
      isTrustProxyEnabled({ SSR_TRUST_PROXY: 'true' } as NodeJS.ProcessEnv)
    ).toBe(true);
  });
});

describe('getSsrEngineOptions', () => {
  it('returns engine options with hosts and proxy trust', () => {
    expect(
      getSsrEngineOptions({
        SSR_ALLOWED_HOSTS: 'example.com',
        SSR_TRUST_PROXY: 'true',
      } as NodeJS.ProcessEnv)
    ).toEqual({
      allowedHosts: ['example.com', 'localhost', '127.0.0.1'],
      trustProxyHeaders: true,
    });
  });
});
