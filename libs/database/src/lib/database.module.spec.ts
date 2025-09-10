import { DynamicModule, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DatabaseModule } from './database.module';
import { validateRequiredFields, validateObjectValues } from './validator';

// Mock the DataSource to prevent actual database connections
jest.mock('typeorm', () => ({
  DataSource: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    // Add other mocked methods if needed by the module
  })),
}));

describe('DatabaseModule', () => {
  it('should be defined', () => {
    expect(DatabaseModule).toBeDefined();
  });

  it('should register a connection', async () => {
    const mockConfigService = new ConfigService();

    const module: DynamicModule = DatabaseModule.register({
      name: 'test',
      factory: (config: ConfigService) => ({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'user',
        password: 'password',
        database: 'testdb',
        entities: [],
        synchronize: false,
      }),
    });

    expect(module).toBeDefined();
    expect(module.module).toEqual(DatabaseModule);
    expect(module.global).toBe(true);
    expect(module.providers).toBeDefined();
    expect(module.providers?.length).toBe(1); // Expecting one connection provider
    expect(module.exports).toBeDefined();
    expect(module.exports?.length).toBe(1); // Expecting one connection export

    const connectionProvider = module.providers?.[0] as Provider & { provide: string, useFactory: (...args: any[]) => any };
    expect(connectionProvider.provide).toEqual('TEST_CONNECTION');

    // Test the factory function by calling it
    const dsInstance = await connectionProvider.useFactory(mockConfigService);
    expect(dsInstance.initialize).toHaveBeenCalled();
  });
});

describe('validator', () => {
  it('should validate required fields', () => {
    interface TestObject {
      a: number;
      b: string;
      c: any;
      d: string;
      e: any;
    }
    const obj: Partial<TestObject> = { a: 1, b: 'test', c: null, d: '' };
    const requiredFields: (keyof TestObject)[] = ['a', 'b', 'c', 'd', 'e'];
    const missing = validateRequiredFields(obj, requiredFields);
    expect(missing).toEqual(['c', 'd', 'e']);
  });

  it('should validate object values', () => {
    const obj = { a: 1, b: 'test', c: 10 };
    const fields = {
      a: (value: number) => value > 0,
      b: (value: string) => value.length > 0,
      c: (value: number) => value < 5,
    };
    expect(validateObjectValues(obj, fields)).toBe(false);

    const obj2 = { a: 1, b: 'test', c: 3 };
    expect(validateObjectValues(obj2, fields)).toBe(true);

    const obj3 = { a: 1, b: 'test' };
    expect(validateObjectValues(obj3, fields)).toBe(false);
  });
});
