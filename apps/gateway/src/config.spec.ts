describe('gateway config oauth env loading', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GATEWAY_CONFIG_PATH;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('combines provider defaults with environment credentials when yaml omits oauth', async () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

    const { loadConfig } = await import('./config');
    const config = loadConfig();

    expect(config.oauth?.google?.clientId).toBe('google-client-id');
    expect(config.oauth?.google?.clientSecret).toBe('google-client-secret');
    expect(config.oauth?.google).toEqual(
      expect.objectContaining({
        enabled: true,
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
        scopes: ['openid', 'email', 'profile'],
      })
    );
  });

  it('loads yaml values and lets non-empty environment values override individual fields', async () => {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const configPath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-oauth-config-')),
      'config.yaml'
    );
    fs.writeFileSync(
      configPath,
      [
        'listenPort: 3000',
        'services: {}',
        'oauth:',
        '  google:',
        '    clientId: yaml-client-id',
        '    clientSecret: yaml-client-secret',
        '    redirectUri: https://yaml.example/oauth/callback/google',
      ].join('\n')
    );
    process.env.GATEWAY_CONFIG_PATH = configPath;
    process.env.GOOGLE_CLIENT_ID = 'env-client-id';
    process.env.GOOGLE_CLIENT_SECRET = '   ';

    const { loadConfig } = await import('./config');
    const config = loadConfig();

    expect(config.oauth?.google).toEqual(
      expect.objectContaining({
        clientId: 'env-client-id',
        clientSecret: 'yaml-client-secret',
        redirectUri: 'https://yaml.example/oauth/callback/google',
        enabled: true,
      })
    );
  });
});
