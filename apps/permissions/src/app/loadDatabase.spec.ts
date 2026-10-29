jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import loadDatabase from './loadDatabase';

describe('permissions loadDatabase', () => {
  const previous = {
    migrations: process.env.OT_RUN_MIGRATIONS_ON_START,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
  };

  afterEach(() => {
    if (previous.migrations === undefined)
      delete process.env.OT_RUN_MIGRATIONS_ON_START;
    else process.env.OT_RUN_MIGRATIONS_ON_START = previous.migrations;
    if (previous.host === undefined) delete process.env.POSTGRES_HOST;
    else process.env.POSTGRES_HOST = previous.host;
    if (previous.database === undefined) delete process.env.POSTGRES_DB;
    else process.env.POSTGRES_DB = previous.database;
  });

  it('bundles the permissions migrations and leaves automatic execution opt-in', () => {
    delete process.env.OT_RUN_MIGRATIONS_ON_START;
    process.env.POSTGRES_HOST = 'override-host';
    process.env.POSTGRES_DB = 'override-database';
    const config = new ConfigService({
      database: {
        host: 'postgres',
        port: 5432,
        username: 'hai',
        password: 'test',
        database: 'permissions',
      },
    });

    const options = loadDatabase(config) as PostgresConnectionOptions;

    expect(options.migrationsRun).toBe(false);
    expect(options.migrations).toHaveLength(3);
    expect(options.synchronize).toBe(false);
    expect(options.connectTimeoutMS).toBe(3000);
    expect(options.host).toBe('override-host');
    expect(options.database).toBe('override-database');

    process.env.OT_RUN_MIGRATIONS_ON_START = 'true';
    expect(loadDatabase(config).migrationsRun).toBe(true);
  });
});
