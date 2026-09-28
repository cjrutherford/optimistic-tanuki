import loadDatabase from './loadDatabase';
import { ConfigService } from '@nestjs/config';

const previousMigrationsFlag = process.env.OT_RUN_MIGRATIONS_ON_START;

afterEach(() => {
  if (previousMigrationsFlag === undefined) {
    delete process.env.OT_RUN_MIGRATIONS_ON_START;
  } else {
    process.env.OT_RUN_MIGRATIONS_ON_START = previousMigrationsFlag;
  }
});

describe('loadDatabase', () => {
  it('should return a valid database configuration', () => {
    delete process.env.OT_RUN_MIGRATIONS_ON_START;
    const configService = new ConfigService({
      database: {
        host: 'localhost',
        port: 5432,
        username: 'testuser',
        password: 'testpassword',
        database: 'testdb',
      },
    });

    const dbConfig = loadDatabase(configService);

    expect(dbConfig).toBeDefined();
    expect(dbConfig.type).toBe('postgres');
    expect(dbConfig.host).toBe('localhost');
    expect(dbConfig.port).toBe(5432);
    expect(dbConfig.username).toBe('testuser');
    expect(dbConfig.password).toBe('testpassword');
    expect(dbConfig.database).toBe('testdb');
    expect(dbConfig.entities).toBeInstanceOf(Array);
    expect(dbConfig.migrationsRun).toBe(false);
    expect(dbConfig.migrations).toHaveLength(7);
  });

  it('runs the bundled version-matched migrations only when opted in', () => {
    process.env.OT_RUN_MIGRATIONS_ON_START = 'true';
    const configService = new ConfigService({
      database: {
        host: 'postgres',
        port: 5432,
        username: 'hai',
        password: 'unused-test-secret',
        database: 'authentication',
      },
    });

    const dbConfig = loadDatabase(configService);

    expect(dbConfig.migrationsRun).toBe(true);
    expect(
      (dbConfig.migrations as Function[]).map((migration) => migration.name)
    ).toEqual(
      expect.arrayContaining([
        'Initial1729455565251',
        'HardenOAuthProviderIdentities1789200000000',
      ])
    );
  });
});
