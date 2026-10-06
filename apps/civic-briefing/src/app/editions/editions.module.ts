import { Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { EditionsController } from './editions.controller';
import { EditionsQueryService } from './editions-query.service';

@Module({
  controllers: [EditionsController],
  providers: [
    {
      provide: EditionsQueryService,
      useFactory: (dataSource: DataSource) =>
        new EditionsQueryService(dataSource),
      inject: [getDataSourceToken()],
    },
  ],
})
export class EditionsModule {}
