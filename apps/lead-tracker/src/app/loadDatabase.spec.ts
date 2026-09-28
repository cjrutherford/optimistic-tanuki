import { ConfigService } from '@nestjs/config';
import loadDatabase from './loadDatabase';

describe('lead-tracker loadDatabase', () => {
  const previous = process.env.OT_RUN_MIGRATIONS_ON_START;

  afterEach(() => {
    if (previous === undefined) delete process.env.OT_RUN_MIGRATIONS_ON_START;
    else process.env.OT_RUN_MIGRATIONS_ON_START = previous;
  });

  it('registers the full version-matched migration chain and gates execution', () => {
    process.env.OT_RUN_MIGRATIONS_ON_START = 'true';
    const config = new ConfigService({
      database: {
        host: 'postgres',
        port: 5432,
        username: 'hai',
        password: 'test',
        database: 'lead_tracker',
      },
    });

    const options = loadDatabase(config);

    expect(options.migrationsRun).toBe(true);
    expect(options.migrations).toHaveLength(24);
    expect(options.entities).toContainEqual(expect.any(Function));
  });
});
