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

  it('authorizes an HttpOnly ot_session only after the gateway validates it', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await expect(
      validate({ cookies: { ot_session: 'signed-session-token' }, headers: {} })
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

  it('rejects an ot_session the gateway declines', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    await expect(
      validate({ cookies: { ot_session: 'forged-token' }, headers: {} })
    ).resolves.toBe(false);
  });

  it('does not authorize a protected page without a session credential', async () => {
    await expect(validate({ cookies: {}, headers: {} })).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when gateway session validation errors', async () => {
    fetchMock.mockRejectedValue(new Error('gateway unavailable'));

    await expect(
      validate({ cookies: { ot_session: 'signed-session-token' }, headers: {} })
    ).resolves.toBe(false);
  });

  it('aborts and fails closed when gateway session validation exceeds its timeout', async () => {
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
      validateWithTimeout({
        cookies: { ot_session: 'signed-session-token' },
        headers: {},
      })
    ).resolves.toBe(false);

    expect((timeoutFetch.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(
      true
    );
  });

  it('validates a legacy local-hub credential through the gateway instead of decoding it locally', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await expect(
      validate({
        cookies: { 'ot-local-hub-authToken': 'legacy-token' },
        headers: {},
      })
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://gateway:3000/api/authentication/session',
      expect.objectContaining({
        headers: { Authorization: 'Bearer legacy-token' },
      })
    );
  });

  it('forwards a direct Bearer credential to the gateway for verification', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await expect(
      validate({
        cookies: {},
        headers: { authorization: 'Bearer browser-header-token' },
      })
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://gateway:3000/api/authentication/session',
      expect.objectContaining({
        headers: { Authorization: 'Bearer browser-header-token' },
      })
    );
  });
});
