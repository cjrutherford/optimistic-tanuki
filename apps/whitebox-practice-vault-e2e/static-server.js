const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const port = parseInt(process.argv[2] || '8095', 10);
const root = path.resolve(
  process.argv[3] || 'dist/apps/whitebox-practice-vault/browser'
);
const liveApiUrl = process.env.LIVE_API_URL || '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const proxyApi = (req, res, urlPath) => {
  const target = new URL(
    urlPath + (req.url.includes('?') ? `?${req.url.split('?')[1]}` : ''),
    liveApiUrl
  );
  const transport = target.protocol === 'https:' ? https : http;
  const proxyReq = transport.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: req.method,
      headers: { ...req.headers, host: target.host },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Live API proxy unreachable.' }));
  });
  req.pipe(proxyReq);
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (liveApiUrl && urlPath.startsWith('/api/')) {
    proxyApi(req, res, urlPath);
    return;
  }
  let filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      res.writeHead(200, {
        'Content-Type':
          MIME[path.extname(filePath)] || 'application/octet-stream',
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    fs.readFile(path.join(root, 'index.html'), (indexErr, data) => {
      if (indexErr) {
        res.writeHead(500);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`practice-vault e2e static server on http://127.0.0.1:${port}`);
});
