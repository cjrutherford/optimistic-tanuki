import { Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { LocalityRegistrySource } from '../registry/locality-registry.source';
import { OfficialCandidatesController } from './official-candidates.controller';
import { OfficialCandidatesService } from './official-candidates.service';

/** Serves OFFICIAL_CANDIDATES, ACCEPT_ and REJECT_OFFICIAL_CANDIDATE. Needs the global LocalityRegistrySource. */
@Module({
  controllers: [OfficialCandidatesController],
  providers: [
    {
      provide: OfficialCandidatesService,
      useFactory: (dataSource: DataSource, registry: LocalityRegistrySource) =>
        new OfficialCandidatesService(dataSource, registry),
      inject: [getDataSourceToken(), LocalityRegistrySource],
    },
  ],
})
export class OfficialCandidatesModule {}
