import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import express from 'express';
import { createServer, get, type Server } from 'node:http';
import { configureBrowserServerRoutes } from './browser-server-routing';

function listen(app: express.Application): Promise<Server> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function request(
  server: Server,
  path: string
): Promise<{ status: number; contentType: string; body: string }> {
  return new Promise((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      reject(new Error('server has no address'));
      return;
    }

    const request = get(
      {
        host: '127.0.0.1',
        port: address.port,
        path,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (body += chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            contentType: response.headers['content-type'] ?? '',
            body,
          })
        );
      }
    );
    request.on('error', reject);
  });
}

async function createFixture() {
  await mkdir(join(process.cwd(), 'tmp'), { recursive: true });
  const directory = await mkdtemp(
    join(process.cwd(), 'tmp', 'learning-browser-routing-')
  );
  const indexPath = join(directory, 'index.csr.html');
  await writeFile(indexPath, '<!doctype html><html></html>');
  const app = express();
  configureBrowserServerRoutes(app, {
    browserDistFolder: directory,
    browserIndexPath: indexPath,
    serverStartedAt: Date.now() + 60_000,
    render: (request, response) => {
      response.type('html').send(`<html>${request.path} SSR</html>`);
    },
  });
  const server = await listen(app);

  return {
    directory,
    server,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
      await rm(directory, { recursive: true, force: true });
    },
  };
}

describe('browser server routing', () => {
  it('serves current referenced JavaScript with a JavaScript MIME type', async () => {
    const fixture = await createFixture();
    try {
      await writeFile(
        join(fixture.directory, 'main-current.js'),
        'window.__currentBuild = true;'
      );
      const response = await request(fixture.server, '/main-current.js');

      expect(response.status).toBe(200);
      expect(response.contentType).toMatch(/javascript/);
      expect(response.body).toContain('__currentBuild');
    } finally {
      await fixture.close();
    }
  });

  it('returns a non-HTML 404 for nonexistent hashed JavaScript', async () => {
    const fixture = await createFixture();
    try {
      const response = await request(fixture.server, '/main-missing123.js');

      expect(response.status).toBe(404);
      expect(response.contentType).toMatch(/text\/plain/);
      expect(response.body).not.toMatch(/<html/i);
    } finally {
      await fixture.close();
    }
  });

  it('keeps navigation paths on the SSR fallback', async () => {
    const fixture = await createFixture();
    try {
      const response = await request(fixture.server, '/courses');

      expect(response.status).toBe(200);
      expect(response.contentType).toMatch(/text\/html/);
      expect(response.body).toContain('/courses SSR');
    } finally {
      await fixture.close();
    }
  });

  it('falls back to the current CSR index when SSR returns null', async () => {
    const fixture = await createFixture();
    await writeFile(
      join(fixture.directory, 'index.csr.html'),
      '<!doctype html><html><body>current CSR</body></html>'
    );
    try {
      const app = express();
      configureBrowserServerRoutes(app, {
        browserDistFolder: fixture.directory,
        browserIndexPath: fixture.directory + '/index.csr.html',
        serverStartedAt: Date.now() + 60_000,
        render: (_request, _response, next) => next(),
      });
      const server = await listen(app);
      try {
        const response = await request(server, '/courses');
        expect(response.status).toBe(200);
        expect(response.contentType).toMatch(/text\/html/);
        expect(response.body).toContain('current CSR');
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
    } finally {
      await fixture.close();
    }
  });

  it('rejects requests after the browser build is replaced', async () => {
    const fixture = await createFixture();
    try {
      const replacedAt = Date.now() + 1_000;
      await utimes(
        fixture.directory + '/index.csr.html',
        replacedAt / 1000,
        replacedAt / 1000
      );
      const app = express();
      configureBrowserServerRoutes(app, {
        browserDistFolder: fixture.directory,
        browserIndexPath: fixture.directory + '/index.csr.html',
        serverStartedAt: Date.now() - 1_000,
        render: (_request, response) => response.send('<html>stale</html>'),
      });
      const server = await listen(app);
      try {
        const response = await request(server, '/');
        expect(response.status).toBe(503);
        expect(response.contentType).toMatch(/text\/plain/);
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
    } finally {
      await fixture.close();
    }
  });
});
