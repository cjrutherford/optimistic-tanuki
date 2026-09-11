import { resolveOllamaEndpoint } from './config';

describe('resolveOllamaEndpoint', () => {
  it('uses OLLAMA_HOST and OLLAMA_PORT when provided', () => {
    expect(
      resolveOllamaEndpoint(
        { apiUrl: 'yaml-host', apiPort: 11434 },
        { OLLAMA_HOST: '100.89.87.125', OLLAMA_PORT: '11435' }
      )
    ).toBe('http://100.89.87.125:11435');
  });

  it('falls back to the YAML values when overrides are absent', () => {
    expect(
      resolveOllamaEndpoint({ apiUrl: 'yaml-host', apiPort: 12345 }, {})
    ).toBe('http://yaml-host:12345');
  });

  it('uses the safe deployment default when configuration is incomplete', () => {
    expect(resolveOllamaEndpoint({}, {})).toBe('http://100.89.87.124:11434');
  });
});
