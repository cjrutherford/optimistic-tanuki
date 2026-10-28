import {
  AccountDeletionSnapshotController,
  ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
} from '@optimistic-tanuki/storage';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileSnapshotClient,
  AccountDeletionAuthorityClient,
} from '@optimistic-tanuki/storage';
import { VideosAccountDeletionOwnerService } from './account-deletion-owner.service';
import { VideosAccountDeletionOwnerController } from './account-deletion-owner.controller';
import { VideoDeletionProcessingFenceService } from './services/video-deletion-processing-fence.service';
import { VideosAccountExportOwnerService } from './account-export-owner.service';
import { VideosAccountExportSnapshotService } from './account-export-snapshot.service';
import { AccountExportController } from './account-export.controller';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { DataSource } from 'typeorm';
import loadConfig from '../config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import loadDatabase from './loadDatabase';
import { Channel } from '../entities/channel.entity';
import { Video } from '../entities/video.entity';
import { ChannelSubscription } from '../entities/channel-subscription.entity';
import { VideoView } from '../entities/video-view.entity';
import { ChannelFeed } from '../entities/channel-feed.entity';
import { ProgramBlock } from '../entities/program-block.entity';
import { LiveSession } from '../entities/live-session.entity';
import { ChannelService } from './services/channel.service';
import { VideoService } from './services/video.service';
import { SubscriptionService } from './services/subscription.service';
import { VideoViewService } from './services/video-view.service';
import { BroadcastService } from './services/broadcast.service';
import { VideoProcessingService } from './services/video-processing.service';
import { VIDEO_PROCESSING_CONFIG } from './services/video-processing.service';
import { VideoTranscodeClientService } from './services/video-transcode-client.service';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'videos',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [
    AccountDeletionSnapshotController,
    AppController,
    AccountExportController,
    VideosAccountDeletionOwnerController,
  ],
  providers: [
    {
      provide: ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
      useFactory: (
        snapshot: VideosAccountExportSnapshotService,
        authority: AccountDeletionAuthorityClient,
        spool: AccountExportOwnerSpoolService,
        database: { query(sql: string): Promise<unknown> }
      ) => ({ owner: 'videos', snapshot, authority, spool, database }),
      inject: [
        VideosAccountExportSnapshotService,
        AccountDeletionAuthorityClient,
        AccountExportOwnerSpoolService,
        'VIDEOS_CONNECTION',
      ],
    },
    AppService,
    VideosAccountDeletionOwnerService,
    VideoDeletionProcessingFenceService,
    {
      provide: AccountDeletionAuthorityClient,
      useFactory: (auth: ClientProxy) =>
        new AccountDeletionAuthorityClient(auth),
      inject: [ServiceTokens.AUTHENTICATION_SERVICE],
    },
    AccountExportOwnerSpoolService,
    AccountExportProfileSnapshotClient,
    {
      provide: ServiceTokens.AUTHENTICATION_SERVICE,
      useFactory: (config: ConfigService) =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host:
              process.env['SERVICE_AUTHENTICATION_HOST'] ||
              config.get<string>('services.authentication.host') ||
              'authentication',
            port:
              Number(process.env['SERVICE_AUTHENTICATION_PORT']) ||
              config.get<number>('services.authentication.port') ||
              3001,
          },
        }),
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.PROFILE_SERVICE,
      useFactory: (config: ConfigService) =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host:
              process.env['SERVICE_PROFILE_HOST'] ||
              config.get<string>('services.profile.host') ||
              'profile',
            port:
              Number(process.env['SERVICE_PROFILE_PORT']) ||
              config.get<number>('services.profile.port') ||
              3002,
          },
        }),
      inject: [ConfigService],
    },
    {
      provide: VideosAccountExportOwnerService,
      useFactory: (
        dataSource: DataSource,
        identities: AccountExportProfileSnapshotClient,
        auth: ClientProxy
      ) => new VideosAccountExportOwnerService(dataSource, identities, auth),
      inject: [
        'VIDEOS_CONNECTION',
        AccountExportProfileSnapshotClient,
        ServiceTokens.AUTHENTICATION_SERVICE,
      ],
    },
    {
      provide: VideosAccountExportSnapshotService,
      useFactory: (
        owner: VideosAccountExportOwnerService,
        spool: AccountExportOwnerSpoolService,
        auth: ClientProxy
      ) => new VideosAccountExportSnapshotService(owner, spool, auth),
      inject: [
        VideosAccountExportOwnerService,
        AccountExportOwnerSpoolService,
        ServiceTokens.AUTHENTICATION_SERVICE,
      ],
    },
    ChannelService,
    VideoService,
    SubscriptionService,
    VideoViewService,
    BroadcastService,
    VideoProcessingService,
    VideoTranscodeClientService,
    {
      provide: VIDEO_PROCESSING_CONFIG,
      useValue: {
        assetStorageRoot:
          process.env['LOCAL_STORAGE_PATH'] || '/usr/src/app/storage',
      },
    },
    {
      provide: ServiceTokens.ASSETS_SERVICE,
      useFactory: () =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: process.env['ASSETS_HOST'] || 'assets',
            port: Number.parseInt(process.env['ASSETS_PORT'] || '3005', 10),
          },
        }),
    },
    {
      provide: getRepositoryToken(Channel),
      useFactory: (ds: DataSource) => ds.getRepository(Channel),
      inject: ['VIDEOS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Video),
      useFactory: (ds: DataSource) => ds.getRepository(Video),
      inject: ['VIDEOS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ChannelSubscription),
      useFactory: (ds: DataSource) => ds.getRepository(ChannelSubscription),
      inject: ['VIDEOS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(VideoView),
      useFactory: (ds: DataSource) => ds.getRepository(VideoView),
      inject: ['VIDEOS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ChannelFeed),
      useFactory: (ds: DataSource) => ds.getRepository(ChannelFeed),
      inject: ['VIDEOS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ProgramBlock),
      useFactory: (ds: DataSource) => ds.getRepository(ProgramBlock),
      inject: ['VIDEOS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(LiveSession),
      useFactory: (ds: DataSource) => ds.getRepository(LiveSession),
      inject: ['VIDEOS_CONNECTION'],
    },
  ],
})
export class AppModule {}
