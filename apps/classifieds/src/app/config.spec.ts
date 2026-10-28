import loadConfig from './config';
import * as fs from 'fs';
jest.mock('fs', () => ({ readFileSync: jest.fn() }));
describe('Classifieds configured database selection', () => {
  const original = process.env['POSTGRES_DB'];
  beforeEach(() => {
    (fs.readFileSync as jest.Mock).mockReturnValue(
      'listenPort: 3017\ndatabase:\n  host: db\n  port: 5432\n  username: fixture\n  password: fixture\n  database: legacy_classifieds\n'
    );
    delete process.env['POSTGRES_DB'];
  });
  afterEach(() => {
    if (original === undefined) delete process.env['POSTGRES_DB'];
    else process.env['POSTGRES_DB'] = original;
  });
  it('retains a configured database when no override is supplied', () => {
    expect(loadConfig().database.database).toBe('legacy_classifieds');
  });
  it('uses the migration-managed database override without changing other connection fields', () => {
    process.env['POSTGRES_DB'] = 'ot_classifieds';
    expect(loadConfig().database).toMatchObject({
      database: 'ot_classifieds',
      host: 'db',
      port: 5432,
      username: 'fixture',
    });
  });
});
