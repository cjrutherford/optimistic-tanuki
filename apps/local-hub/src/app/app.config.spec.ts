import { resolveLocalHubSocketHost } from './app.config';

describe('resolveLocalHubSocketHost', () => {
  it('uses the same-origin proxy when no browser socket URL is configured', () => {
    expect(resolveLocalHubSocketHost(undefined, 'http://localhost:8087')).toBe(
      'http://localhost:8087'
    );
  });

  it('uses the same-origin proxy for path-only values', () => {
    expect(resolveLocalHubSocketHost('/socket.io', 'http://localhost:8087')).toBe(
      'http://localhost:8087'
    );
  });

  it('uses the same-origin proxy for the legacy malformed port fallback', () => {
    expect(resolveLocalHubSocketHost(':3300', 'http://localhost:8087')).toBe(
      'http://localhost:8087'
    );
  });

  it('preserves a configured absolute socket URL', () => {
    expect(
      resolveLocalHubSocketHost('https://chat.example.test', 'https://hub.test')
    ).toBe('https://chat.example.test');
  });

  it('returns an empty host during server rendering', () => {
    expect(resolveLocalHubSocketHost(undefined, undefined)).toBe('');
  });
});
