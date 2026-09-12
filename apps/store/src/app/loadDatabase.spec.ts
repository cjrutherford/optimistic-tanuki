import { ConfigService } from '@nestjs/config';
import loadDatabase from './loadDatabase';
import { CatalogEntity } from '../catalog/entities/catalog.entity';

describe('loadDatabase', () => {
  it('registers Store catalog metadata for the runtime connection', () => {
    const config = {
      get: jest.fn().mockReturnValue({
        host: 'localhost',
        port: 5432,
        username: 'store',
        password: 'store',
        database: 'ot_store',
      }),
    } as unknown as ConfigService;

    const database = loadDatabase(config);

    expect(database.entities).toContain(CatalogEntity);
  });
});
