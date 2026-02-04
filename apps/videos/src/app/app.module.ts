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
import { ChannelService } from './services/channel.service';
import { VideoService } from './services/video.service';
import { SubscriptionService } from './services/subscription.service';
import { VideoViewService } from './services/video-view.service';

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
  ],
})
export class AppModule {}
