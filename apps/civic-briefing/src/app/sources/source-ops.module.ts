import { Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { LocalityRegistrySource } from '../registry/locality-registry.source';
import { SourceOpsController } from './source-ops.controller';
import { SourceOpsService } from './source-ops.service';

/** Serves the sources admin commands (SD.6). Needs the global LocalityRegistrySource. */
@Module({
  controllers: [SourceOpsController],
  providers: [
    {
      provide: SourceOpsService,
      useFactory: (dataSource: DataSource, registry: LocalityRegistrySource) =>
        new SourceOpsService(dataSource, registry),
      inject: [getDataSourceToken(), LocalityRegistrySource],
    },
  ],
})
export class SourceOpsModule {}
