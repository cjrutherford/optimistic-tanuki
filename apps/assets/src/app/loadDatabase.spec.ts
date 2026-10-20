import { ConfigService } from '@nestjs/config';
import loadDatabase from './loadDatabase';

describe('loadDatabase', () => {
  it('keeps the PostgreSQL options and redacts credentials from its allowlisted log', () => {
    const database = {
      host: 'postgres.internal',
      port: 5432,
      username: 'assets-service-user',
      password: 'private-assets-db-password',
      database: 'assets',
      name: 'fallback-assets',
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'database' ? database : undefined
      ),
    };
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const options = loadDatabase(config as unknown as ConfigService);

    expect(options).toMatchObject({
      type: 'postgres',
      host: database.host,
      port: database.port,
      connectTimeoutMS: 3000,
      username: database.username,
      password: database.password,
      database: database.database,
      entities: expect.arrayContaining([
        expect.any(Function),
        expect.any(Function),
      ]),
    });
    expect(options.entities).toHaveLength(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Database configuration:', {
      host: database.host,
      port: database.port,
      database: database.database,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(database.username);
    expect(JSON.stringify(log.mock.calls)).not.toContain(database.password);
  });

  it('preserves the existing database-name fallback', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'database'
          ? {
              host: 'postgres.internal',
              port: 5432,
              username: 'assets-service-user',
              password: 'secret',
              name: 'fallback-assets',
            }
          : undefined
      ),
    };
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(loadDatabase(config as unknown as ConfigService).database).toBe(
      'fallback-assets'
    );
  });
});
