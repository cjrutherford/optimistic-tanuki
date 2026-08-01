import { createServer } from 'node:http';

const json = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
};

createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://oauth-provider:3016');

  if (request.method === 'GET' && url.pathname === '/authorize') {
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');
    if (!redirectUri || !state) {
      json(response, 400, { error: 'invalid_request' });
      return;
    }
    const callback = new URL(redirectUri);
    callback.searchParams.set('code', 'e2e-google-authorization-code');
    callback.searchParams.set('state', state);
    response.writeHead(302, { Location: callback.toString() });
    response.end();
    return;
  }

  if (request.method === 'POST' && url.pathname === '/token') {
    json(response, 200, {
      access_token: 'e2e-google-access-token',
      token_type: 'Bearer',
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/userinfo') {
    json(response, 200, {
      id: 'e2e-google-user',
      sub: 'e2e-google-user',
      email: 'oauth-e2e@example.test',
      email_verified: true,
      name: 'OAuth E2E User',
      given_name: 'OAuth',
      family_name: 'E2E',
    });
    return;
  }

  json(response, 404, { error: 'not_found' });
}).listen(3016, '0.0.0.0');
