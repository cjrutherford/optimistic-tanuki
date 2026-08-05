import { authorizeOwnerConsoleAdminRequest } from './admin-api-authorization';

describe('authorizeOwnerConsoleAdminRequest', () => {
  it('authorizes a verified owner token', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ role: { name: 'global_admin' } }],
    });
    const verifyToken = jest
      .fn()
      .mockReturnValue({ profileId: 'owner-profile' });

    await expect(
      authorizeOwnerConsoleAdminRequest({
        authorization: 'Bearer token',
        jwtSecret: 'test-secret',
        gatewayUrl: 'http://gateway:3000',
        fetchImpl: fetchMock,
        verifyToken,
      })
    ).resolves.toEqual({ authorized: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://gateway:3000/api/permissions/user-roles/owner-profile?appScope=owner-console',
      expect.anything()
    );
  });

  it('authorizes a verified owner session cookie', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ role: { name: 'global_admin' } }],
    });
    const verifyToken = jest
      .fn()
      .mockReturnValue({ profileId: 'owner-profile' });

    await expect(
      authorizeOwnerConsoleAdminRequest({
        cookieHeader: 'theme=control-center; ot_session=session-token',
        jwtSecret: 'test-secret',
        gatewayUrl: 'http://gateway:3000',
        fetchImpl: fetchMock,
        verifyToken,
      })
    ).resolves.toEqual({ authorized: true });

    expect(verifyToken).toHaveBeenCalledWith('session-token', 'test-secret');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://gateway:3000/api/permissions/user-roles/owner-profile?appScope=owner-console',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
        }),
      })
    );
  });

  it('authorizes the dedicated owner-console role', async () => {
    await expect(
      authorizeOwnerConsoleAdminRequest({
        authorization: 'Bearer token',
        jwtSecret: 'test-secret',
        gatewayUrl: 'http://gateway:3000',
        fetchImpl: jest.fn().mockResolvedValue({
          ok: true,
          json: async () => [{ role: { name: 'owner_console_owner' } }],
        }),
        verifyToken: jest.fn().mockReturnValue({ profileId: 'owner-profile' }),
      })
    ).resolves.toEqual({ authorized: true });
  });

  it('rejects a request without a bearer token', async () => {
    await expect(
      authorizeOwnerConsoleAdminRequest({
        authorization: undefined,
        jwtSecret: 'test-secret',
        gatewayUrl: 'http://gateway:3000',
        fetchImpl: jest.fn(),
        verifyToken: jest.fn(),
      })
    ).resolves.toEqual({ authorized: false, status: 401 });
  });

  it('rejects a verified non-owner token', async () => {
    await expect(
      authorizeOwnerConsoleAdminRequest({
        authorization: 'Bearer token',
        jwtSecret: 'test-secret',
        gatewayUrl: 'http://gateway:3000',
        fetchImpl: jest.fn().mockResolvedValue({
          ok: true,
          json: async () => [{ role: { name: 'member' } }],
        }),
        verifyToken: jest.fn().mockReturnValue({ profileId: 'member-profile' }),
      })
    ).resolves.toEqual({ authorized: false, status: 403 });
  });
});
