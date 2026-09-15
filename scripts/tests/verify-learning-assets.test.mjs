import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { verifyLearningAssets } from '../verify-learning-assets.mjs';

function startServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

test('verifies scripts, modulepreloads, and styles referenced by the index', async () => {
  const fixture = await startServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`
        <link rel="modulepreload" href="/chunk-12345678.js">
        <link rel="stylesheet" href="/styles-12345678.css">
        <script type="module" src="/main-12345678.js"></script>
      `);
      return;
    }
    if (request.url === '/styles-12345678.css') {
      response.writeHead(200, { 'content-type': 'text/css' });
      response.end('body { color: black; }');
      return;
    }
    response.writeHead(200, { 'content-type': 'application/javascript' });
    response.end('console.log("ready");');
  });

  try {
    await assert.doesNotReject(() => verifyLearningAssets(fixture.url));
  } finally {
    await new Promise((resolve) => fixture.server.close(resolve));
  }
});

test('rejects an HTML fallback returned for a missing script', async () => {
  const fixture = await startServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(
        '<script type="module" src="/missing-12345678.js"></script>'
      );
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><html><body>fallback</body></html>');
  });

  try {
    await assert.rejects(
      () => verifyLearningAssets(fixture.url),
      /missing-12345678\.js returned text\/html|returned markup/
    );
  } finally {
    await new Promise((resolve) => fixture.server.close(resolve));
  }
});

test('rejects an unhashed development asset', async () => {
  const fixture = await startServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<script type="module" src="/main.js"></script>');
      return;
    }
    response.writeHead(200, { 'content-type': 'application/javascript' });
    response.end('console.log("development");');
  });

  try {
    await assert.rejects(
      () => verifyLearningAssets(fixture.url),
      /not a production-hashed asset/
    );
  } finally {
    await new Promise((resolve) => fixture.server.close(resolve));
  }
});

test('allows an explicit development asset opt-out', async () => {
  const fixture = await startServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<script type="module" src="/main.js"></script>');
      return;
    }
    response.writeHead(200, { 'content-type': 'application/javascript' });
    response.end('console.log("development");');
  });

  try {
    await assert.doesNotReject(() =>
      verifyLearningAssets(fixture.url, { requireHashedAssets: false })
    );
  } finally {
    await new Promise((resolve) => fixture.server.close(resolve));
  }
});

test('times out when the index response stalls', async () => {
  const fixture = await startServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
  });

  try {
    await assert.rejects(
      () => verifyLearningAssets(fixture.url, { requestTimeoutMs: 50 }),
      /aborted|timeout|timed out/i
    );
  } finally {
    await new Promise((resolve) => fixture.server.close(resolve));
  }
});

test('times out when an asset response stalls', async () => {
  const fixture = await startServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<script type="module" src="/main-12345678.js"></script>');
      return;
    }
    response.writeHead(200, { 'content-type': 'application/javascript' });
  });

  try {
    await assert.rejects(
      () => verifyLearningAssets(fixture.url, { requestTimeoutMs: 50 }),
      /aborted|timeout|timed out/i
    );
  } finally {
    await new Promise((resolve) => fixture.server.close(resolve));
  }
});

test('bounds response body reads', async () => {
  const fixture = await startServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<script type="module" src="/main-12345678.js"></script>');
      return;
    }
    response.writeHead(200, {
      'content-type': 'application/javascript',
      'content-length': '64',
    });
    response.end('x'.repeat(64));
  });

  try {
    await assert.rejects(
      () =>
        verifyLearningAssets(fixture.url, {
          maxBodyBytes: 16,
        }),
      /exceeds the 16-byte readiness limit/
    );
  } finally {
    await new Promise((resolve) => fixture.server.close(resolve));
  }
});
