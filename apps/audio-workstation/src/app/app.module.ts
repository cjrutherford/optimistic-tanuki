import { Module } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { DatabaseModule } from '@optimistic-tanuki/database';

import loadConfig, { TcpServiceConfig } from '../config';
import loadDatabase from './loadDatabase';

import { AppController } from './app.controller';
import { ProjectService } from './services/project.service';
import { TrackService } from './services/track.service';
import { GenerationService } from './services/generation.service';
import { MixService } from './services/mix.service';
import { ExportService } from './services/export.service';
import { FullAutoStrategy } from './strategies/full-auto.strategy';
import { CoverStrategy } from './strategies/cover.strategy';
import { FullCollabStrategy } from './strategies/full-collab.strategy';
import { StrategyFactory } from './strategies/strategy-factory';

import { AudioProjectEntity } from '../entities/audio-project.entity';
import { TrackEntity } from '../entities/track.entity';
import { ArrangementSectionEntity } from '../entities/arrangement-section.entity';
import { MixSnapshotEntity } from '../entities/mix-snapshot.entity';
import { AIGenerationRequestEntity } from '../entities/ai-generation-request.entity';
import { ExportJobEntity } from '../entities/export-job.entity';

const ENTITIES = [
  AudioProjectEntity,
  TrackEntity,
  ArrangementSectionEntity,
  MixSnapshotEntity,
  AIGenerationRequestEntity,
  ExportJobEntity,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'audio_workstation',
      factory: loadDatabase,
    }),
  ],
  controllers: [AppController],
  providers: [
    ProjectService,
    TrackService,
    GenerationService,
    MixService,
    ExportService,
    FullAutoStrategy,
    CoverStrategy,
    FullCollabStrategy,
    StrategyFactory,
    {
      provide: ServiceTokens.ASSETS_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.assets');
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host: serviceConfig.host, port: serviceConfig.port },
        });
      },
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.AI_ORCHESTRATION_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
          'services.ai_orchestrator'
        );
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host: serviceConfig.host, port: serviceConfig.port },
        });
      },
      inject: [ConfigService],
    },
    ...ENTITIES.map((entity) => ({
      provide: getRepositoryToken(entity),
      useFactory: (ds: DataSource) => ds.getRepository(entity),
      inject: ['AUDIO_WORKSTATION_CONNECTION'],
    })),
  ],
})
export class AppModule {}
