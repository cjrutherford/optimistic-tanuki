jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import loadDatabase from './loadDatabase';

describe('loadDatabase', () => {
  const originalNodeEnv = process.env['NODE_ENV'];

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it.each(['production', 'development'])(
    'bounds %s PostgreSQL connects and keeps credentials redacted',
    (mode) => {
      process.env['NODE_ENV'] = mode;
      const database = {
        host: 'postgres.internal',
        port: 5432,
        username: 'videos-service',
        password: 'private-db-password',
        database: 'videos',
      };
      const config = {
        get: jest.fn((key: string) =>
          key === 'database' ? database : undefined
        ),
      };
      const log = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);

      const options = loadDatabase(config as never) as any;

      expect(options).toMatchObject({
        type: 'postgres',
        host: database.host,
        port: database.port,
        username: database.username,
        password: database.password,
        database: database.database,
        connectTimeoutMS: 3000,
        synchronize: false,
        logging: mode === 'development',
      });
      expect(options.entities).toHaveLength(8);
      expect(log).toHaveBeenCalledWith(
        'Database configuration:',
        expect.objectContaining({ password: '[REDACTED]' })
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain(database.password);
    }
  );
});
