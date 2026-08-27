import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('business-site OAuth popup security headers', () => {
  it('keeps OAuth popups connected to their opener', () => {
    const server = readFileSync(resolve(__dirname, 'server.ts'), 'utf8');

    expect(server).toContain(
      "'Cross-Origin-Opener-Policy', 'same-origin-allow-popups'"
    );
  });
});
