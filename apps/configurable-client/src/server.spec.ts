import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('configurable-client SSR server startup', () => {
  const serverSource = readFileSync(resolve(__dirname, 'server.ts'), 'utf8');

  it('initializes the emitted Angular app-engine manifest before constructing the node engine', () => {
    const manifestImport = serverSource.indexOf(
      "import angularAppEngineManifest from './angular-app-engine-manifest.mjs';"
    );
    const manifestSetter = serverSource.indexOf(
      'ɵsetAngularAppEngineManifest(angularAppEngineManifest);'
    );
    const angularEngine = serverSource.indexOf(
      'const angularApp = new AngularNodeAppEngine();'
    );

    expect(manifestImport).toBeGreaterThanOrEqual(0);
    expect(manifestSetter).toBeGreaterThan(manifestImport);
    expect(manifestSetter).toBeLessThan(angularEngine);
  });

  it('does not start runtime monitoring while the SSR bundle is imported', () => {
    expect(serverSource).toMatch(
      /if \(isMainModule\(import\.meta\.url\)\) \{\s*startNodeRuntimeMonitoring\(/
    );
  });

  it('keeps listening guarded while exporting the request handler on import', () => {
    const mainGuardStart = serverSource.indexOf(
      'if (isMainModule(import.meta.url)) {'
    );
    const mainGuardEnd = serverSource.indexOf('\n}', mainGuardStart);
    const listener = serverSource.indexOf('app.listen(');
    const requestHandlerExport = serverSource.indexOf(
      'export const reqHandler = createNodeRequestHandler(app);'
    );

    expect(mainGuardStart).toBeGreaterThanOrEqual(0);
    expect(mainGuardEnd).toBeGreaterThan(mainGuardStart);
    expect(listener).toBeGreaterThan(mainGuardStart);
    expect(listener).toBeLessThan(mainGuardEnd);
    expect(requestHandlerExport).toBeGreaterThan(mainGuardEnd);
  });
});
