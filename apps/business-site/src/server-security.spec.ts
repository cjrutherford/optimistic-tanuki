import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('business-site OAuth popup security headers', () => {
  it('keeps OAuth popups connected to their opener', () => {
    const server = readFileSync(resolve(__dirname, 'server.ts'), 'utf8');

    expect(server).toContain(
      "'Cross-Origin-Opener-Policy', 'same-origin-allow-popups'"
    );
  });

  it('starts runtime monitoring only for the main server module', () => {
    const server = readFileSync(resolve(__dirname, 'server.ts'), 'utf8');

    expect(server).toMatch(
      /if \(isMainModule\(import\.meta\.url\)\) \{\s*startNodeRuntimeMonitoring\(/
    );
  });

  it('keeps the listener guarded and request handler available on import', () => {
    const server = readFileSync(resolve(__dirname, 'server.ts'), 'utf8');
    const mainGuardStart = server.indexOf(
      'if (isMainModule(import.meta.url)) {'
    );
    const mainGuardEnd = server.indexOf('\n}', mainGuardStart);
    const listener = server.indexOf('app.listen(');
    const requestHandlerExport = server.indexOf(
      'export const reqHandler = createNodeRequestHandler(app);'
    );

    expect(mainGuardStart).toBeGreaterThanOrEqual(0);
    expect(mainGuardEnd).toBeGreaterThan(mainGuardStart);
    expect(listener).toBeGreaterThan(mainGuardStart);
    expect(listener).toBeLessThan(mainGuardEnd);
    expect(requestHandlerExport).toBeGreaterThan(mainGuardEnd);
  });
});
