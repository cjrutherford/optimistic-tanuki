import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions, EntitySchema } from 'typeorm';
export { FindOptionsBuilder } from './findOptionsBuilder';

@Module({
})
export class DatabaseModule implements DynamicModule {
  module!: Type<DatabaseModule>;
  static register(...opts: { name: string, factory: (config: ConfigService) => DataSourceOptions}[]): DynamicModule {
    const connections = [];
    const repositories: Provider[] = [];

    for (const { name, factory } of opts) {
      const connectionName = name.toUpperCase() + '_CONNECTION';
      
      // Store entities reference for later use
      let entitiesRef: any[] = [];
      
      const connection = {
        provide: connectionName,
        useFactory: async (config: ConfigService) => {
          const connectionOptions = factory(config);
          entitiesRef = connectionOptions.entities || [];
          const ds = new DataSource(connectionOptions);
          await ds.initialize();

          return ds;
        },
        inject: [ConfigService],
      };
      connections.push(connection);

      // Create a temporary ConfigService to extract entities at registration time
      // This is a workaround - in real scenarios, the entities array is typically static
      const tempConfig = new ConfigService({});
      try {
        const tempOptions = factory(tempConfig);
        const entities = tempOptions.entities || [];
        
        // Create repository providers for each entity
        for (const entity of entities) {
          const repositoryProvider: Provider = {
            provide: getRepositoryToken(entity as Function | string | EntitySchema),
            useFactory: (ds: DataSource) => ds.getRepository(entity as Function | string | EntitySchema),
            inject: [connectionName],
          };
          repositories.push(repositoryProvider);
        }
      } catch (error) {
        // If factory fails without proper config, we can't extract entities at registration time
        console.warn(`Could not extract entities for ${name} at registration time:`, error);
      }
    }

    return {
      module: DatabaseModule,
      global: true,
      imports: [],
      providers: [...connections, ...repositories],
      exports: [
        ...connections,
        ...repositories,
      ],
    };
  }
}
