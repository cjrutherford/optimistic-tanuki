import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { WellnessController } from './wellness.controller';
import { DailyFourService, DailySixService } from './services';
import { DailyFourEntity, DailySixEntity } from './entities';
import loadDatabase from './loadDatabase';
import loadConfig from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'wellness',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [WellnessController],
  providers: [
    DailyFourService,
    DailySixService,
    {
      provide: getRepositoryToken(DailyFourEntity),
      useFactory: (dataSource: any) => dataSource.getRepository(DailyFourEntity),
      inject: ['WELLNESS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(DailySixEntity),
      useFactory: (dataSource: any) => dataSource.getRepository(DailySixEntity),
      inject: ['WELLNESS_CONNECTION'],
    },
  ],
})
export class AppModule {}
