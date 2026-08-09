import { getServerApiBaseUrl } from './server-api-base-url';

describe('getServerApiBaseUrl', () => {
  it('routes server-rendered API calls directly to the configured gateway', () => {
    expect(getServerApiBaseUrl('http://gateway:3000')).toBe(
      'http://gateway:3000/api'
    );
  });

  it('does not duplicate a trailing slash', () => {
    expect(getServerApiBaseUrl('http://gateway:3000/')).toBe(
      'http://gateway:3000/api'
    );
  });
});
