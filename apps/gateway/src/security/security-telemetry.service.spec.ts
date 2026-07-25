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
});
