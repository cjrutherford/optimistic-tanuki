import {
  OWNER_BOOTSTRAP_USAGE,
  bootstrapOwnerAccount,
  parseOwnerBootstrapArgs,
} from './owner-bootstrap-cli';

describe('parseOwnerBootstrapArgs', () => {
  const ownerBootstrapEnvironment = {
    OWNER_BOOTSTRAP_EMAIL: 'OWNER@EXAMPLE.COM',
    OWNER_BOOTSTRAP_NAME: 'Owner Console',
    OWNER_BOOTSTRAP_PASSWORD: 'secret',
  };

  it('reads owner bootstrap credentials from the environment', () => {
    expect(parseOwnerBootstrapArgs([], ownerBootstrapEnvironment)).toEqual({
      apiBaseUrl: 'http://127.0.0.1:8098/api',
      email: 'owner@example.com',
      markSetupComplete: false,
      name: 'Owner Console',
      password: 'secret',
    });
  });

  it('supports marking setup complete explicitly', () => {
    expect(
      parseOwnerBootstrapArgs(
        [
          '--mark-setup-complete',
          '--api-base-url',
          'http://admin-api:8098/api/',
        ],
        ownerBootstrapEnvironment
      )
    ).toEqual({
      apiBaseUrl: 'http://admin-api:8098/api',
      email: 'owner@example.com',
      markSetupComplete: true,
      name: 'Owner Console',
      password: 'secret',
    });
  });

  it('passes the deployment bootstrap token from the environment', () => {
    expect(
      parseOwnerBootstrapArgs([], {
        ...ownerBootstrapEnvironment,
        ADMIN_API_BOOTSTRAP_TOKEN: 'bootstrap-secret',
      })
    ).toEqual({
      apiBaseUrl: 'http://127.0.0.1:8098/api',
      bootstrapToken: 'bootstrap-secret',
      email: 'owner@example.com',
      markSetupComplete: false,
      name: 'Owner Console',
      password: 'secret',
    });
  });

  it('rejects missing owner bootstrap environment values with usage guidance', () => {
    expect(() =>
      parseOwnerBootstrapArgs([], {
        OWNER_BOOTSTRAP_EMAIL: 'owner@example.com',
      })
    ).toThrow(
      `${OWNER_BOOTSTRAP_USAGE}\n\nMissing required environment variable: OWNER_BOOTSTRAP_NAME`
    );
  });

  it('rejects password command-line arguments', () => {
    expect(() =>
      parseOwnerBootstrapArgs(
        ['--password', 'secret'],
        ownerBootstrapEnvironment
      )
    ).toThrow(`${OWNER_BOOTSTRAP_USAGE}\n\nUnknown argument: --password`);
  });

  it('returns the created profile id from the bootstrap endpoint', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 'owner-user-1',
          profileId: 'owner-profile-1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activated: true }),
      });

    await expect(
      bootstrapOwnerAccount(
        {
          apiBaseUrl: 'http://127.0.0.1:8098/api',
          email: 'owner@example.com',
          markSetupComplete: true,
          name: 'Owner Console',
          password: 'secret',
        },
        fetchImpl as any
      )
    ).resolves.toEqual({
      created: true,
      email: 'owner@example.com',
      name: 'Owner Console',
      profileId: 'owner-profile-1',
      setupComplete: true,
      userId: 'owner-user-1',
    });
  });

  it('sends the bootstrap token to both bootstrap operations', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 'owner-user-1',
          profileId: 'owner-profile-1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ activated: true }),
      });

    await bootstrapOwnerAccount(
      {
        apiBaseUrl: 'http://127.0.0.1:8098/api',
        bootstrapToken: 'bootstrap-secret',
        email: 'owner@example.com',
        markSetupComplete: true,
        name: 'Owner Console',
        password: 'secret',
      },
      fetchImpl as any
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-admin-bootstrap-token': 'bootstrap-secret',
        }),
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-admin-bootstrap-token': 'bootstrap-secret',
        }),
      })
    );
  });

  it('returns an explicit existing-owner result without completing setup', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        created: false,
        email: 'existing@example.com',
        name: 'Existing Owner',
        profileId: 'owner-profile-1',
        userId: 'owner-user-1',
      }),
    });

    await expect(
      bootstrapOwnerAccount(
        {
          apiBaseUrl: 'http://127.0.0.1:8098/api',
          email: 'owner@example.com',
          markSetupComplete: false,
          name: 'Owner Console',
          password: 'secret',
        },
        fetchImpl as any
      )
    ).resolves.toEqual({
      created: false,
      email: 'existing@example.com',
      name: 'Existing Owner',
      profileId: 'owner-profile-1',
      setupComplete: false,
      userId: 'owner-user-1',
    });
  });
});
