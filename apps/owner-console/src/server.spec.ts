import * as fs from 'node:fs';
import * as path from 'node:path';

describe('owner-console admin API proxy boundary', () => {
  it('keeps OAuth popups connected to their opener', () => {
    const server = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');

    expect(server).toContain(
      "'Cross-Origin-Opener-Policy', 'same-origin-allow-popups'"
    );
  });

  it('starts runtime monitoring only for the main server module', () => {
    const server = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');

    expect(server).toMatch(
      /if \(isMainModule\(import\.meta\.url\)\) \{\s*startNodeRuntimeMonitoring\(/
    );
  });

  it('keeps the listener guarded and request handler available on import', () => {
    const server = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');
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

  it('blocks bootstrap paths and authorizes privileged requests before proxying', () => {
    const server = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');
    const blockIndex = server.indexOf("'/admin-api/api/bootstrap'");
    const proxyIndex = server.lastIndexOf("'/admin-api',");

    expect(blockIndex).toBeGreaterThan(-1);
    expect(proxyIndex).toBeGreaterThan(blockIndex);
    expect(server.slice(blockIndex, proxyIndex)).toContain(
      'response.status(404)'
    );
    expect(server.slice(blockIndex, proxyIndex)).toContain(
      'authorizeOwnerConsoleAdminRequest'
    );
    expect(server.slice(blockIndex, proxyIndex)).toContain(
      "request.path === '/api/status/public'"
    );
  });
});
