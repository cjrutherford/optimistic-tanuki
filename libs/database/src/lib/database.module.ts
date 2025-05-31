import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
      const connection = {
        provide: connectionName,
        useFactory: async (config: ConfigService) => {
          const connectionOptions = factory(config);
          const ds = new DataSource(connectionOptions);
          await ds.initialize();

          // Detect entities and initialize them against the connection
          // const entities = (connectionOptions.entities || []) as EntitySchema<any>[];
          // for (const entity of entities) {
          //   console.dir(entity);
          //   repositories.push({
          //     provide: `${name.toUpperCase()}_${entity.options.name}_REPOSITORY`,
          //     useFactory: (dataSource: DataSource) => dataSource.getRepository(entity),
          //     inject: [connectionName],
          //   });
          // }

          return ds;
        },
        inject: [ConfigService],
      };
      connections.push(connection);
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
