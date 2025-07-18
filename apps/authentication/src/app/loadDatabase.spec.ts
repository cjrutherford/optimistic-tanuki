import loadDatabase from './loadDatabase';
import { ConfigService } from '@nestjs/config';

describe('loadDatabase', () => {
  it('should return a valid database configuration', () => {
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
  });
});
