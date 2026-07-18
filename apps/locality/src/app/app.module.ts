import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LocalityObservationEntity } from '../entities/locality-observation.entity';
import { LocalityController } from './locality.controller';
import { LOCALITY_NOW, LocalityService } from './locality.service';
import { loadConfig } from './config';
import loadDatabase from './loadDatabase';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfig] }),
    DatabaseModule.register({ name: 'locality', factory: loadDatabase }),
  ],
  controllers: [LocalityController],
  providers: [
    LocalityService,
    { provide: LOCALITY_NOW, useValue: () => new Date() },
    {
      provide: getRepositoryToken(LocalityObservationEntity),
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(LocalityObservationEntity),
      inject: ['LOCALITY_CONNECTION'],
    },
  ],
})
export class AppModule {}
