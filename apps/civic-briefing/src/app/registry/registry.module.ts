import { Global, Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { LocalitySyncModule } from '../locality-sync/locality-sync.module';
import { LocalitySyncService } from '../locality-sync/locality-sync.service';
import { loadScheduleConfig } from '../schedule/schedule.config';
import { DbLocalityRegistrySource } from './db-locality-registry.source';
import { LocalityRegistrySource } from './locality-registry.source';

/** The database-built locality registry, under the abstract class token. Global, so any module (B's LocalitiesModule, health, schedule) can inject it. */
@Global()
@Module({
  imports: [LocalitySyncModule],
  providers: [
    // The lifecycle (start, stop) is the database source's own; consumers read
    // through the abstract class.
    { provide: DbLocalityRegistrySource, useExisting: LocalityRegistrySource },
    {
      provide: LocalityRegistrySource,
      useFactory: (dataSource: DataSource, sync: LocalitySyncService) =>
        new DbLocalityRegistrySource(
          dataSource,
          sync,
          loadScheduleConfig().generatedLocalitiesDir
        ),
      inject: [getDataSourceToken(), LocalitySyncService],
    },
  ],
  exports: [LocalityRegistrySource, DbLocalityRegistrySource],
})
export class RegistryModule {}
