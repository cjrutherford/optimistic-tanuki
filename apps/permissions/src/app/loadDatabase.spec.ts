import { ConfigService } from '@nestjs/config';
import loadDatabase from './loadDatabase';

describe('permissions loadDatabase', () => {
  const previous = process.env.OT_RUN_MIGRATIONS_ON_START;

  afterEach(() => {
    if (previous === undefined) delete process.env.OT_RUN_MIGRATIONS_ON_START;
    else process.env.OT_RUN_MIGRATIONS_ON_START = previous;
  });

  it('bundles both permissions migrations and leaves automatic execution opt-in', () => {
    delete process.env.OT_RUN_MIGRATIONS_ON_START;
    const config = new ConfigService({
      database: {
        host: 'postgres',
        port: 5432,
        username: 'hai',
        password: 'test',
        database: 'permissions',
      },
    });

    const options = loadDatabase(config);

    expect(options.migrationsRun).toBe(false);
    expect(options.migrations).toHaveLength(2);
    expect(options.synchronize).toBe(false);
  });
});
