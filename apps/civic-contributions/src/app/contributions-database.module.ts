import {
  Global,
  Module,
  type DynamicModule,
  type Provider,
} from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import type { DataSource } from 'typeorm';
import { COMMUNITY_ENTITIES } from './entities';
import loadDatabase from './loadDatabase';

export const CIVIC_CONTRIBUTIONS_CONNECTION = 'CIVIC_CONTRIBUTIONS_CONNECTION';

const repositories: Provider[] = COMMUNITY_ENTITIES.map((entity) => ({
  provide: getRepositoryToken(entity),
  useFactory: (dataSource: DataSource) => dataSource.getRepository(entity),
  inject: [CIVIC_CONTRIBUTIONS_CONNECTION],
}));

/**
 * The contributions database, the platform's way: DatabaseModule owns the
 * connection, and the TypeORM tokens the services inject resolve to it.
 */
@Global()
@Module({
  imports: [
    DatabaseModule.register({
      name: 'civic_contributions',
      factory: loadDatabase,
    }),
  ],
  providers: [
    {
      provide: getDataSourceToken(),
      useExisting: CIVIC_CONTRIBUTIONS_CONNECTION,
    },
    ...repositories,
  ],
  exports: [getDataSourceToken(), ...repositories],
})
export class ContributionsDatabaseModule {
  /** The same tokens over a DataSource made elsewhere (tests). */
  static forDataSource(dataSource: DataSource): DynamicModule {
    const provided: Provider[] = COMMUNITY_ENTITIES.map((entity) => ({
      provide: getRepositoryToken(entity),
      useValue: dataSource.getRepository(entity),
    }));
    return {
      module: ContributionsDataSourceModule,
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
class ContributionsDataSourceModule {}
