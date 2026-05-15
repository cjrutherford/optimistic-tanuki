import loadConfig from './config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('prefers POSTGRES_HOST over the asset default', () => {
    process.env = {
      ...originalEnv,
      POSTGRES_HOST: 'postgres',
    };

    const config = loadConfig();

    expect(config.database.host).toBe('postgres');
  });
});
