import { resolveLoginReturnUrl } from './login-return-url';

describe('resolveLoginReturnUrl', () => {
  it('preserves an internal protected deep link and query string', () => {
    expect(resolveLoginReturnUrl('/messages/new?recipient=forge')).toBe(
      '/messages/new?recipient=forge'
    );
  });

  it.each([
    'https://attacker.example/projects',
    '//attacker.example/projects',
    '/\\attacker.example/projects',
    'javascript:alert(1)',
    '/%2f%2fattacker.example/projects',
    '/projects\nLocation: https://attacker.example',
  ])('falls back to projects for an unsafe return target: %s', (returnUrl) => {
    expect(resolveLoginReturnUrl(returnUrl)).toBe('/projects');
  });
});
