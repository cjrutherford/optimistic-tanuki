import {
  OWNER_BOOTSTRAP_USAGE,
  bootstrapOwnerAccount,
  parseOwnerBootstrapArgs,
} from './owner-bootstrap-cli';

describe('parseOwnerBootstrapArgs', () => {
  it('parses required owner bootstrap arguments', () => {
    expect(
      parseOwnerBootstrapArgs([
        '--name',
        'Owner Console',
        '--email',
        'OWNER@EXAMPLE.COM',
        '--password',
        'secret',
      ])
    ).toEqual({
      apiBaseUrl: 'http://127.0.0.1:8098/api',
      email: 'owner@example.com',
      markSetupComplete: false,
      name: 'Owner Console',
      password: 'secret',
    });
  });

  it('supports marking setup complete explicitly', () => {
    expect(
      parseOwnerBootstrapArgs([
        '--name',
        'Owner Console',
        '--email',
        'owner@example.com',
        '--password',
        'secret',
        '--mark-setup-complete',
        '--api-base-url',
        'http://admin-api:8098/api/',
      ])
    ).toEqual({
      apiBaseUrl: 'http://admin-api:8098/api',
      email: 'owner@example.com',
      markSetupComplete: true,
      name: 'Owner Console',
      password: 'secret',
    });
  });

  it('rejects missing required arguments with usage guidance', () => {
    expect(() =>
      parseOwnerBootstrapArgs(['--email', 'owner@example.com'])
    ).toThrow(`${OWNER_BOOTSTRAP_USAGE}\n\nMissing required argument: --name`);
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
      email: 'owner@example.com',
      name: 'Owner Console',
      profileId: 'owner-profile-1',
      setupComplete: true,
      userId: 'owner-user-1',
    });
  });
});
