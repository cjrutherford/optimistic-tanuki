import { normalizeAuthReturnTo } from './oauth-return';

describe('normalizeAuthReturnTo', () => {
  const options = { currentOrigin: 'https://app.example' };

  it('normalizes an absolute current-origin return to an internal target', () => {
    expect(
      normalizeAuthReturnTo(
        'https://app.example/dashboard?tab=profile#security',
        options
      )
    ).toEqual({
      origin: 'https://app.example',
      path: '/dashboard?tab=profile#security',
      href: 'https://app.example/dashboard?tab=profile#security',
      isCurrentOrigin: true,
    });
  });

  it('accepts an explicitly registered origin while keeping the target internal', () => {
    expect(
      normalizeAuthReturnTo('https://portal.example/workspace', {
        ...options,
        registeredOrigins: ['https://portal.example'],
      })
    ).toEqual({
      origin: 'https://portal.example',
      path: '/workspace',
      href: 'https://portal.example/workspace',
      isCurrentOrigin: false,
    });
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    'javascript:alert(1)',
    '/%2F%2Fevil.example/phish',
    '/%5C%5Cevil.example/phish',
    '/dashboard\\evil',
    '/dashboard\n/evil',
    '/login',
    '/register',
    '/oauth/callback/google',
  ])('rejects unsafe or auth-loop destination %s', (returnTo) => {
    expect(normalizeAuthReturnTo(returnTo, options)).toBeNull();
  });

  it('rejects whitespace padding, malformed escapes, and unsupported origins', () => {
    expect(normalizeAuthReturnTo(' /dashboard', options)).toBeNull();
    expect(normalizeAuthReturnTo('/dashboard%ZZ', options)).toBeNull();
    expect(
      normalizeAuthReturnTo('ftp://app.example/dashboard', options)
    ).toBeNull();
  });

  it('rejects control characters in the absolute URL and decoded path', () => {
    expect(
      normalizeAuthReturnTo('https://app.example/dashboard\u0000', options)
    ).toBeNull();
    expect(
      normalizeAuthReturnTo('https://app.example/%0A/dashboard', options)
    ).toBeNull();
  });

  it('rejects missing values and invalid current origins', () => {
    expect(normalizeAuthReturnTo(undefined, options)).toBeNull();
    expect(normalizeAuthReturnTo('', options)).toBeNull();
    expect(
      normalizeAuthReturnTo('/dashboard', { currentOrigin: 'not-an-origin' })
    ).toBeNull();
  });
});
