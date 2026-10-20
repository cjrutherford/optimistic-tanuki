import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
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
import { GuardianProfileActivity } from '../profiles/entities/guardian-profile-activity.entity';
import { TimelinesController } from '../timelines/timelines.controller';
import { getRepositoryToken } from '@nestjs/typeorm';
import loadConfig, { ProfileConfigType } from '../config';
import loadDatabase from './loadDatabase';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { ProfileAccountExportService } from './account-export.service';
import { ProfileAccountExportOwnerService } from './account-export-owner.service';
import { AccountExportController } from '../profiles/account-export.controller';

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
  controllers: [
    AppController,
    ProfilesController,
    TimelinesController,
    AccountExportController,
  ],
  providers: [
    AppService,
    ProfileService,
    TimelineService,
    ProfileAccountExportService,
    {
      provide: ProfileAccountExportOwnerService,
      useFactory: (dataSource: DataSource, authClient: ClientProxy) =>
        new ProfileAccountExportOwnerService(dataSource, authClient),
      inject: ['PROFILE_CONNECTION', ServiceTokens.AUTHENTICATION_SERVICE],
    },
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
      provide: getRepositoryToken(GuardianProfileActivity),
      useFactory: (ds: DataSource) => ds.getRepository(GuardianProfileActivity),
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
    {
      provide: ServiceTokens.AUTHENTICATION_SERVICE,
      useFactory: (configService: ConfigService) => {
        const config = configService.get<
          ProfileConfigType['services']['authentication']
        >('services.authentication');
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host: config.host, port: config.port },
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
