import { Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { LocalitiesController } from './localities.controller';
import { LocalityRegistrySource } from './locality-registry.source';
import { SourceRequestsController } from './source-requests.controller';
import { SourceRequestsService } from './source-requests.service';

/** Serves LIST_LOCALITIES, SOURCE_STATUS and REQUEST_SOURCES. Needs LocalityRegistrySource from the module that provides it (global or imported). */
@Module({
  controllers: [LocalitiesController, SourceRequestsController],
  providers: [
    {
      provide: SourceRequestsService,
      useFactory: (dataSource: DataSource, registry: LocalityRegistrySource) =>
        new SourceRequestsService(dataSource, registry),
      inject: [getDataSourceToken(), LocalityRegistrySource],
    },
  ],
})
export class LocalitiesModule {}
