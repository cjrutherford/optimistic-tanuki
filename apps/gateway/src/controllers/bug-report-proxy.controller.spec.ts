import { ConfigService } from '@nestjs/config';
import { BugReportProxyController } from './bug-report-proxy.controller';

describe('BugReportProxyController', () => {
  const config = {
    get: (k: string) =>
      k === 'BUG_REPORT_SERVICE_URL' ? 'http://bug-report:3025' : undefined,
  } as unknown as ConfigService;

  beforeEach(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn();
  });

  it('proxies nonce without auth and preserves client IP', async () => {
    const fetchMock = globalThis.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: 'n', expiresAt: 'e' }),
    });
    const c = new BugReportProxyController(config);
    const res = await c.nonce('1.2.3.4', {});
    expect(res).toEqual({ nonce: 'n', expiresAt: 'e' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-Forwarded-For']).toBe('1.2.3.4');
  });

  it('throws BadGateway when upstream fails', async () => {
    const fetchMock = globalThis.fetch as unknown as jest.Mock;
    fetchMock.mockRejectedValue(new Error('down'));
    const c = new BugReportProxyController(config);
    await expect(c.submit({ a: 1 }, '9.9.9.9', {})).rejects.toThrow(
      /unavailable/i
    );
  });
});
