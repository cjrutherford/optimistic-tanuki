import {
  createGatewaySessionValidator,
  type ServerSessionRequest,
} from './server-session-validation';

describe('createGatewaySessionValidator', () => {
  const gatewayUrl = 'http://gateway:3000';
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
  });

  const validate = (request: ServerSessionRequest) =>
    createGatewaySessionValidator({ gatewayUrl, fetch: fetchMock })(request);

  it('authorizes an opaque ot_session only after the gateway validates it', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await expect(
      validate({ cookies: { ot_session: 'signed-session-token' } })
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://gateway:3000/api/authentication/session',
      expect.objectContaining({
        method: 'GET',
        headers: { Cookie: 'ot_session=signed-session-token' },
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('rejects an opaque session the gateway declines', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    await expect(
      validate({ cookies: { ot_session: 'forged-session-token' } })
    ).resolves.toBe(false);
  });

  it('does not trust a direct Bearer header where Forge has no bearer SSR contract', async () => {
    await expect(
      validate({
        cookies: {},
        headers: { authorization: 'Bearer forged-browser-token' },
      })
    ).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the gateway session check errors', async () => {
    fetchMock.mockRejectedValue(new Error('gateway unavailable'));

    await expect(
      validate({ cookies: { ot_session: 'signed-session-token' } })
    ).resolves.toBe(false);
  });

  it('aborts and fails closed when gateway validation exceeds its timeout', async () => {
    const timeoutFetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('gateway validation timed out'))
          );
        })
    );
    const validateWithTimeout = createGatewaySessionValidator({
      gatewayUrl,
      fetch: timeoutFetch as any,
      timeoutMs: 1,
    });

    await expect(
      validateWithTimeout({ cookies: { ot_session: 'signed-session-token' } })
    ).resolves.toBe(false);

    expect((timeoutFetch.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(
      true
    );
  });
});
