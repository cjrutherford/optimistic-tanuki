import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Profile } from '../profiles/entities/profile.entity';
import { ProfileService } from './profile.service';
import { ProfilesController } from '../profiles/profiles.controller';
import { Timeline } from '../timelines/entities/timeline.entity';
import { TimelineService } from './timeline.service';
import { TimelinesController } from '../timelines/timelines.controller';
import { getRepositoryToken } from '@nestjs/typeorm';
import loadConfig, { ProfileConfigType } from '../config';
import loadDatabase from './loadDatabase';
import { ServiceTokens } from '@optimistic-tanuki/constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'profile',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [AppController, ProfilesController, TimelinesController],
  providers: [
    AppService,
    ProfileService,
    TimelineService,
    {
      provide: getRepositoryToken(Profile),
      useFactory: (ds: DataSource) => ds.getRepository(Profile),
      inject: ['PROFILE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Timeline),
      useFactory: (ds: DataSource) => ds.getRepository(Timeline),
      inject: ['PROFILE_CONNECTION'],
    },
    {
      provide: ServiceTokens.PERMISSIONS_SERVICE,
      useFactory: (configService: ConfigService) => {
        const config = configService.get<
          ProfileConfigType['services']['permissions']
        >('services.permissions');
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: config.host,
            port: config.port,
          },
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
