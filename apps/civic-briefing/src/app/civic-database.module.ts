import {
  Global,
  Module,
  type DynamicModule,
  type Provider,
} from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { FOUNDATION_SCHEMAS } from '@optimistic-tanuki/civic-core';
import type { DataSource, EntitySchema } from 'typeorm';
import loadDatabase from './loadDatabase';

export const CIVIC_BRIEFING_CONNECTION = 'CIVIC_BRIEFING_CONNECTION';

const repositories: Provider[] = (
  FOUNDATION_SCHEMAS as readonly EntitySchema<unknown>[]
).map((schema) => ({
  provide: getRepositoryToken(schema),
  useFactory: (dataSource: DataSource) => dataSource.getRepository(schema),
  inject: [CIVIC_BRIEFING_CONNECTION],
}));

/**
 * The foundation database, the platform's way: DatabaseModule owns the
 * connection, and the TypeORM tokens the pipeline stages inject
 * (@InjectDataSource, @InjectRepository) resolve to it.
 */
@Global()
@Module({
  imports: [
    DatabaseModule.register({ name: 'civic_briefing', factory: loadDatabase }),
  ],
  providers: [
    { provide: getDataSourceToken(), useExisting: CIVIC_BRIEFING_CONNECTION },
    ...repositories,
  ],
  exports: [getDataSourceToken(), ...repositories],
})
export class CivicDatabaseModule {
  /**
   * The same tokens over a DataSource made elsewhere: the replay entry and
   * the stage tests open their own database and hand it to the stages.
   */
  static forDataSource(dataSource: DataSource): DynamicModule {
    const provided: Provider[] = (
      FOUNDATION_SCHEMAS as readonly EntitySchema<unknown>[]
    ).map((schema) => ({
      provide: getRepositoryToken(schema),
      useValue: dataSource.getRepository(schema),
    }));
    return {
      module: CivicDataSourceModule,
      global: true,
      providers: [
        { provide: getDataSourceToken(), useValue: dataSource },
        ...provided,
      ],
      exports: [getDataSourceToken(), ...provided],
    };
  }
}

@Module({})
class CivicDataSourceModule {}
