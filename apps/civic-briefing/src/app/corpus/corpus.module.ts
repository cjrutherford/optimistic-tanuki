import { Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { CorpusController } from './corpus.controller';
import { CorpusQueryService } from './corpus-query.service';

@Module({
  controllers: [CorpusController],
  providers: [
    {
      // A factory, so the service's test clock is not taken for a dependency.
      provide: CorpusQueryService,
      useFactory: (dataSource: DataSource) =>
        new CorpusQueryService(dataSource),
      inject: [getDataSourceToken()],
    },
  ],
})
export class CorpusModule {}
