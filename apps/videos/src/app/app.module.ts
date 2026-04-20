import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
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
  controllers: [AppController],
  providers: [
    AppService,
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
