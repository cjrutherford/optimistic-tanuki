import * as fs from 'node:fs';
import * as path from 'node:path';

describe('owner-console admin API proxy boundary', () => {
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
