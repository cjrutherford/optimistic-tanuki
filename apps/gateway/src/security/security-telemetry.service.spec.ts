import { SecurityTelemetryService } from './security-telemetry.service';

describe('SecurityTelemetryService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('masks client addresses in event results for observers', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          result: [
            {
              values: [
                [
                  '1720000000000000000',
                  JSON.stringify({
                    timestamp: '2026-07-24T12:00:00.000Z',
                    host: 'optimistic-tanuki.com',
                    path: '/wp-login.php',
                    method: 'GET',
                    status: 404,
                    classification: 'unsupported_url',
                    clientAddress: '203.0.113.42',
                  }),
                ],
              ],
            },
          ],
        },
      }),
    });

    const service = new SecurityTelemetryService({
      lokiUrl: 'http://loki:3100',
      crowdsecUrl: 'http://crowdsec:8080',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      service.listEvents({ from: '2026-07-24T11:00:00.000Z', limit: 10 })
    ).resolves.toEqual({
      events: [
        expect.objectContaining({
          path: '/wp-login.php',
          clientAddress: '203.0.113.*',
        }),
      ],
    });
  });

  it('returns the full client address only for enforcement operators', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          result: [
            {
              values: [
                [
                  '1720000000000000000',
                  JSON.stringify({
                    timestamp: '2026-07-24T12:00:00.000Z',
                    host: 'optimistic-tanuki.com',
                    path: '/wp-login.php',
                    method: 'GET',
                    status: 404,
                    classification: 'unsupported_url',
                    clientAddress: '203.0.113.42',
                  }),
                ],
              ],
            },
          ],
        },
      }),
    });

    const service = new SecurityTelemetryService({
      lokiUrl: 'http://loki:3100',
      crowdsecUrl: 'http://crowdsec:8080',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      service.listEvents(
        { from: '2026-07-24T11:00:00.000Z', limit: 10 },
        { revealClientAddress: true }
      )
    ).resolves.toEqual({
      events: [expect.objectContaining({ clientAddress: '203.0.113.42' })],
    });
  });

  it('aggregates filtered events into fixed metric buckets without raw identifiers', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          result: [
            {
              values: [
                [
                  '1720000000000000000',
                  JSON.stringify({
                    timestamp: '2026-07-24T12:01:00.000Z',
                    host: 'tanuki.test',
                    path: '/login',
                    method: 'GET',
                    status: 403,
                    classification: 'denied',
                    clientAddress: '203.0.113.42',
                  }),
                ],
                [
                  '1720000000000000001',
                  JSON.stringify({
                    timestamp: '2026-07-24T12:04:00.000Z',
                    host: 'tanuki.test',
                    path: '/wp-login.php',
                    method: 'GET',
                    status: 404,
                    classification: 'unsupported_url',
                  }),
                ],
              ],
            },
          ],
        },
      }),
    });
    const service = new SecurityTelemetryService({
      lokiUrl: 'http://loki:3100',
      crowdsecUrl: 'http://crowdsec:8080',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      service.metrics({
        from: '2026-07-24T12:00:00.000Z',
        to: '2026-07-24T12:10:00.000Z',
        bucket: '5m',
        host: 'tanuki.test',
      })
    ).resolves.toEqual({
      from: '2026-07-24T12:00:00.000Z',
      to: '2026-07-24T12:10:00.000Z',
      bucket: '5m',
      totals: {
        requests: 2,
        denied: 1,
        rateLimited: 0,
        blocked: 0,
        errors: 0,
        serverErrors: 0,
      },
      series: [
        {
          start: '2026-07-24T12:00:00.000Z',
          requests: 2,
          denied: 1,
          rateLimited: 0,
          blocked: 0,
          errors: 0,
          serverErrors: 0,
        },
        {
          start: '2026-07-24T12:05:00.000Z',
          requests: 0,
          denied: 0,
          rateLimited: 0,
          blocked: 0,
          errors: 0,
          serverErrors: 0,
        },
      ],
      topPaths: [
        { path: '/login', count: 1, serverErrors: 0 },
        { path: '/wp-login.php', count: 1, serverErrors: 0 },
      ],
      topHosts: [{ host: 'tanuki.test', count: 2 }],
    });
  });
});
