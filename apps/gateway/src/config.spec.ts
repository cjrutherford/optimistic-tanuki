describe('gateway config oauth env loading', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('loads oauth provider values from environment variables when yaml omits oauth', async () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_REDIRECT_URI =
      'https://example.com/oauth/callback/google';

    const { loadConfig } = await import('./config');
    const config = loadConfig();

    expect(config.oauth?.google?.clientId).toBe('google-client-id');
    expect(config.oauth?.google?.clientSecret).toBe('google-client-secret');
    expect(config.oauth?.google?.redirectUri).toBe(
      'https://example.com/oauth/callback/google'
    );
    expect(config.oauth?.google?.enabled).toBe(true);
  });
});
