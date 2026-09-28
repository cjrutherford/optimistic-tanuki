import { ConfigService } from '@nestjs/config';
import loadDatabase from './loadDatabase';

describe('profile loadDatabase', () => {
  const previous = process.env.OT_RUN_MIGRATIONS_ON_START;

  afterEach(() => {
    if (previous === undefined) delete process.env.OT_RUN_MIGRATIONS_ON_START;
    else process.env.OT_RUN_MIGRATIONS_ON_START = previous;
  });

  it('bundles both profile migrations and gates execution on the appliance flag', () => {
    process.env.OT_RUN_MIGRATIONS_ON_START = 'true';
    const config = new ConfigService({
      database: {
        host: 'postgres',
        port: 5432,
        username: 'hai',
        password: 'test',
        database: 'profile',
      },
    });

    const options = loadDatabase(config);

    expect(options.migrationsRun).toBe(true);
    expect(options.migrations).toHaveLength(2);
    expect(options.synchronize).not.toBe(true);
  });
});
