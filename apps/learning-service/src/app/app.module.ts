import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmLearningRepository } from './typeorm.repository';
import { LEARNING_REPOSITORY } from './learning.repository';
import { AttemptEntity } from '../entities/attempt.entity';
import { EvaluationEntity } from '../entities/evaluation.entity';
import { CreditLedgerEntryEntity } from '../entities/credit-ledger-entry.entity';
import { ProgramTrackEntity } from '../entities/program-track.entity';
import { LessonProgressEntity } from '../entities/lesson-progress.entity';
import { EnrolmentEntity } from '../entities/enrolment.entity';
import { OfferingOwnershipEntity } from '../entities/offering-ownership.entity';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'learning',
      factory: loadDatabase,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    TypeOrmLearningRepository,
    {
      provide: LEARNING_REPOSITORY,
      useExisting: TypeOrmLearningRepository,
    },
    {
      provide: getRepositoryToken(ProgramTrackEntity),
      useFactory: (ds: DataSource) => ds.getRepository(ProgramTrackEntity),
      inject: ['LEARNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(AttemptEntity),
      useFactory: (ds: DataSource) => ds.getRepository(AttemptEntity),
      inject: ['LEARNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(EvaluationEntity),
      useFactory: (ds: DataSource) => ds.getRepository(EvaluationEntity),
      inject: ['LEARNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(CreditLedgerEntryEntity),
      useFactory: (ds: DataSource) => ds.getRepository(CreditLedgerEntryEntity),
      inject: ['LEARNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(LessonProgressEntity),
      useFactory: (ds: DataSource) => ds.getRepository(LessonProgressEntity),
      inject: ['LEARNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(EnrolmentEntity),
      useFactory: (ds: DataSource) => ds.getRepository(EnrolmentEntity),
      inject: ['LEARNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(OfferingOwnershipEntity),
      useFactory: (ds: DataSource) => ds.getRepository(OfferingOwnershipEntity),
      inject: ['LEARNING_CONNECTION'],
    },
  ],
})
export class AppModule {}
