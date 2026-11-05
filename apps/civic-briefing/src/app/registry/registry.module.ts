import { Global, Module } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { LocalitySyncModule } from '../locality-sync/locality-sync.module';
import { LocalitySyncService } from '../locality-sync/locality-sync.service';
import {
  TcpCivicCoreClient,
  civicCoreEndpoint,
} from '../civic-core/civic-core.client';
import { OfficialCandidatePuller } from '../officials/official-candidate-puller';
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
      // Civic Core's agenda-extracted names, pulled as candidates (D33).
      provide: OfficialCandidatePuller,
      useFactory: (dataSource: DataSource) =>
        new OfficialCandidatePuller(
          dataSource,
          new TcpCivicCoreClient(
            ClientProxyFactory.create({
              transport: Transport.TCP,
              options: civicCoreEndpoint(),
            })
          )
        ),
      inject: [getDataSourceToken()],
    },
    {
      provide: LocalityRegistrySource,
      useFactory: (
        dataSource: DataSource,
        sync: LocalitySyncService,
        officials: OfficialCandidatePuller
      ) =>
        new DbLocalityRegistrySource(
          dataSource,
          sync,
          loadScheduleConfig().generatedLocalitiesDir,
          undefined,
          officials
        ),
      inject: [
        getDataSourceToken(),
        LocalitySyncService,
        OfficialCandidatePuller,
      ],
    },
  ],
  exports: [LocalityRegistrySource, DbLocalityRegistrySource],
})
export class RegistryModule {}
