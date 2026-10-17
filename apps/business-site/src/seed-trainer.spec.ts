import { bootstrap, fetchJson } from './seed-trainer.mjs';
import http from 'node:http';

type FakeResponse = { status: number; data: unknown };

const owner = {
  email: 'owner@localbusiness.test',
  firstName: 'Jordan',
  lastName: 'Vale',
  password: 'BusinessOwnerPass123!',
  bio: 'Owner',
};

const tenant = {
  configKey: 'default',
  owner,
  site: { slug: 'north-star-advisory' },
  brand: { businessName: 'North Star Advisory' },
};

function makeDependencies(
  responses: Record<string, FakeResponse>,
  storeQuery: jest.Mock = jest.fn().mockResolvedValue({ rowCount: 1 })
) {
  class FakePgClient {
    async connect() {}
    async query(...args: unknown[]) {
      return storeQuery(...args);
    }
    async end() {}
  }

  return {
    PgClient: FakePgClient,
    sleep: async () => undefined,
    fetchJson: async (url: string) =>
      responses[url] ?? { status: 200, data: {} },
  };
}

function successfulResponses(): Record<string, FakeResponse> {
  return {
    'http://gateway:3000/api/api-docs': { status: 200, data: {} },
    'http://gateway:3000/api/authentication/register': {
      status: 201,
      data: { data: { user: { id: 'user-1' } } },
    },
    'http://gateway:3000/api/authentication/login': {
      status: 200,
      data: { token: 'header.eyJzdWIiOiJ1c2VyLTEifQ.signature' },
    },
    'http://gateway:3000/api/authentication/exchange': {
      status: 200,
      data: { profileId: 'profile-1', token: 'exchange-token' },
    },
    'http://gateway:3000/api/workspaces/business-sites/provision': {
      status: 201,
      data: { workspace: { workspaceId: 'workspace-1' } },
    },
  };
}

describe('business seed required operations', () => {
  it('sends the registered public Host and Origin to the gateway on the wire', async () => {
    let received: http.IncomingMessage | undefined;
    const server = http.createServer((req, res) => {
      received = req;
      res.setHeader('content-type', 'application/json');
      res.end('{"ok":true}');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    try {
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('No test port');
      const response = await fetchJson(
        `http://127.0.0.1:${address.port}/api/authentication/register`,
        { method: 'POST', body: '{"email":"owner@example.test"}' },
        'business-site',
        'http://127.0.0.1:8094'
      );
      expect(response).toEqual({ status: 200, data: { ok: true } });
      expect(received?.headers.host).toBe('127.0.0.1:8094');
      expect(received?.headers.origin).toBe('http://127.0.0.1:8094');
      expect(received?.headers['x-ot-app-id']).toBe('business-site');
      expect(received?.headers['x-ot-appscope']).toBe('business-site');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it('rejects a noncanonical business app scope', async () => {
    await expect(
      fetchJson('http://127.0.0.1:1', {}, 'unregistered-app')
    ).rejects.toThrow(/only supports app scope business-site/i);
  });

  it('rejects registration failures instead of reporting a successful seed', async () => {
    const responses = successfulResponses();
    responses['http://gateway:3000/api/authentication/register'] = {
      status: 500,
      data: { message: 'authentication unavailable' },
    };

    await expect(
      bootstrap({
        users: [owner],
        tenants: [],
        dependencies: makeDependencies(responses),
      })
    ).rejects.toThrow(/registration/i);
  });

  it('rejects login failures instead of skipping the required owner', async () => {
    const responses = successfulResponses();
    responses['http://gateway:3000/api/authentication/login'] = {
      status: 503,
      data: { message: 'authentication unavailable' },
    };

    await expect(
      bootstrap({
        users: [owner],
        tenants: [],
        dependencies: makeDependencies(responses),
      })
    ).rejects.toThrow(/login/i);
  });

  it('rejects configuration failures for an authenticated required tenant', async () => {
    const responses = successfulResponses();
    const storeQuery = jest
      .fn()
      .mockRejectedValue(new Error('store unavailable'));
    const logs: string[] = [];

    await expect(
      bootstrap({
        users: [owner],
        tenants: [tenant],
        dependencies: makeDependencies(responses, storeQuery),
        logger: {
          log: (message: string) => logs.push(message),
          warn: jest.fn(),
          error: jest.fn(),
        },
      })
    ).rejects.toThrow(/config|store unavailable/i);
    expect(logs).not.toContain('=== Business User Seed Complete ===');
  });

  it('rejects workspace provisioning failures for an authenticated required tenant', async () => {
    const responses = successfulResponses();
    responses['http://gateway:3000/api/workspaces/business-sites/provision'] = {
      status: 502,
      data: { message: 'workspace unavailable' },
    };

    await expect(
      bootstrap({
        users: [owner],
        tenants: [tenant],
        dependencies: makeDependencies(responses),
      })
    ).rejects.toThrow(/provision|workspace unavailable/i);
  });
});
