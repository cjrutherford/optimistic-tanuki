describe('authentication config oauth env loading', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.AUTHENTICATION_CONFIG_PATH;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.SERVICE_ASSETS_HOST;
    delete process.env.SERVICE_ASSETS_PORT;
    delete process.env.SERVICE_VIDEOS_HOST;
    delete process.env.SERVICE_VIDEOS_PORT;
    delete process.env.SERVICE_PROFILE_HOST;
    delete process.env.SERVICE_PROFILE_PORT;
    delete process.env.SERVICE_PERMISSIONS_HOST;
    delete process.env.SERVICE_PERMISSIONS_PORT;
    delete process.env.SERVICE_SOCIAL_HOST;
    delete process.env.SERVICE_SOCIAL_PORT;
    delete process.env.SERVICE_FORUM_HOST;
    delete process.env.SERVICE_FORUM_PORT;
    delete process.env.SERVICE_WORKSPACE_HOST;
    delete process.env.SERVICE_WORKSPACE_PORT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('combines provider defaults with environment credentials', async () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

    const { default: loadConfig } = await import('./config');
    const config = loadConfig();

    expect(config.oauth.google?.clientId).toBe('google-client-id');
    expect(config.oauth.google?.clientSecret).toBe('google-client-secret');
    expect(config.oauth.google).toEqual(
      expect.objectContaining({
        enabled: true,
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
        scopes: ['openid', 'email', 'profile'],
      })
    );
  });

  it('keeps explicitly enabled providers available without gateway secrets', async () => {
    const { default: loadConfig } = await import('./config');
    const config = loadConfig();

    expect(config.oauth.google).toEqual(
      expect.objectContaining({
        enabled: true,
        clientId: '',
        clientSecret: '',
      })
    );
  });

  it('loads the Assets participant target with environment overrides', async () => {
    const { default: loadConfig } = await import('./config');
    expect(loadConfig().services?.assets).toEqual({
      host: 'assets',
      port: 3005,
    });
    process.env.SERVICE_ASSETS_HOST = 'assets-internal';
    process.env.SERVICE_ASSETS_PORT = '43005';
    expect(loadConfig().services?.assets).toEqual({
      host: 'assets-internal',
      port: 43005,
    });
  });

  it('loads the profile participant target from config with environment overrides', async () => {
    const { default: loadConfig } = await import('./config');
    expect(loadConfig().services?.profile).toEqual({
      host: 'profile',
      port: 3002,
    });

    process.env.SERVICE_PROFILE_HOST = 'profile-internal';
    process.env.SERVICE_PROFILE_PORT = '43002';
    expect(loadConfig().services?.profile).toEqual({
      host: 'profile-internal',
      port: 43002,
    });
  });

  it('loads the Permissions participant target with environment overrides', async () => {
    const { default: loadConfig } = await import('./config');
    expect(loadConfig().services?.permissions).toEqual({
      host: 'permissions',
      port: 3012,
    });
    process.env.SERVICE_PERMISSIONS_HOST = 'permissions-internal';
    process.env.SERVICE_PERMISSIONS_PORT = '43012';
    expect(loadConfig().services?.permissions).toEqual({
      host: 'permissions-internal',
      port: 43012,
    });
  });

  it('loads the Social participant target with environment overrides', async () => {
    const { default: loadConfig } = await import('./config');
    expect(loadConfig().services?.social).toEqual({
      host: 'social',
      port: 3003,
    });
    process.env.SERVICE_SOCIAL_HOST = 'social-internal';
    process.env.SERVICE_SOCIAL_PORT = '43003';
    expect(loadConfig().services?.social).toEqual({
      host: 'social-internal',
      port: 43003,
    });
  });

  it('loads the Forum participant target from defaults and environment overrides', async () => {
    const { default: loadConfig } = await import('./config');
    expect(loadConfig().services?.forum).toEqual({ host: 'forum', port: 3015 });

    process.env.SERVICE_FORUM_HOST = 'forum-internal';
    process.env.SERVICE_FORUM_PORT = '43015';
    expect(loadConfig().services?.forum).toEqual({
      host: 'forum-internal',
      port: 43015,
    });
  });

  it('loads the Workspace participant target from defaults and environment overrides', async () => {
    const { default: loadConfig } = await import('./config');
    expect(loadConfig().services?.workspace).toEqual({
      host: 'workspace',
      port: 3024,
    });

    process.env.SERVICE_WORKSPACE_HOST = 'workspace-internal';
    process.env.SERVICE_WORKSPACE_PORT = '43024';
    expect(loadConfig().services?.workspace).toEqual({
      host: 'workspace-internal',
      port: 43024,
    });
  });

  it('loads yaml values and lets non-empty environment values override individual fields', async () => {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const configPath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'authentication-oauth-config-')),
      'config.yaml'
    );
    fs.writeFileSync(
      configPath,
      [
        'listenPort: 3001',
        'database:',
        '  host: db',
        '  port: 5432',
        '  username: postgres',
        '  password: postgres',
        '  database: ot_authentication',
        'auth:',
        '  jwtSecret: test-secret',
        'oauth:',
        '  google:',
        '    clientId: yaml-client-id',
        '    clientSecret: yaml-client-secret',
        '    redirectUri: https://yaml.example/oauth/callback/google',
      ].join('\n')
    );
    process.env.AUTHENTICATION_CONFIG_PATH = configPath;
    process.env.GOOGLE_CLIENT_ID = 'env-client-id';
    process.env.GOOGLE_CLIENT_SECRET = '   ';

    const { default: loadConfig } = await import('./config');
    const config = loadConfig();

    expect(config.auth.jwt_secret).toBe('test-secret');

    expect(config.oauth.google).toEqual(
      expect.objectContaining({
        clientId: 'env-client-id',
        clientSecret: 'yaml-client-secret',
        redirectUri: 'https://yaml.example/oauth/callback/google',
        enabled: true,
      })
    );
    expect(config.oauth.github?.enabled).toBe(false);
  });

  it('reads JSON-as-YAML authentication config values without corrupting passwords', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const configDir = path.resolve('tmp/authentication-config-test');
    const configPath = path.join(configDir, 'config.yaml');
    const password = 'colon: # "quoted"\nwith whitespace';
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        listenPort: 3001,
        database: {
          host: '127.0.0.1',
          port: 5432,
          name: 'ot_authentication',
          username: 'postgres',
          password,
        },
        auth: {},
        oauth: {},
      })
    );

    const originalPath = process.env.AUTHENTICATION_CONFIG_PATH;
    const originalPassword = process.env.POSTGRES_PASSWORD;
    process.env.AUTHENTICATION_CONFIG_PATH = configPath;
    delete process.env.POSTGRES_PASSWORD;

    try {
      const { default: loadConfig } = await import('./config');
      expect(loadConfig().database.password).toBe(password);
    } finally {
      if (originalPath === undefined) {
        delete process.env.AUTHENTICATION_CONFIG_PATH;
      } else {
        process.env.AUTHENTICATION_CONFIG_PATH = originalPath;
      }
      if (originalPassword === undefined) {
        delete process.env.POSTGRES_PASSWORD;
      } else {
        process.env.POSTGRES_PASSWORD = originalPassword;
      }
      fs.rmSync(configDir, { recursive: true, force: true });
    }
  });
  it('defaults and overrides the Videos snapshot RPC endpoint', async () => {
    const { default: loadConfig } = await import('./config');
    const initial = loadConfig();
    expect(initial.services?.videos).toEqual({ host: 'videos', port: 3022 });
    process.env.SERVICE_VIDEOS_HOST = 'private-videos';
    process.env.SERVICE_VIDEOS_PORT = '43022';
    expect(loadConfig().services?.videos).toEqual({
      host: 'private-videos',
      port: 43022,
    });
  });
});
