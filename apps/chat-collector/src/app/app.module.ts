import { Module } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadConfig from './loadConfig';
import loadDatabase from './loadDatabase';
import { Conversation, Message } from './entities';
import { DataSource } from 'typeorm';
import {
  ClientProxy,
  ClientProxyFactory,
  ClientsModule,
  Transport,
} from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { LoggerModule } from '@optimistic-tanuki/logger';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { ChatAccountExportOwnerService } from './account-export-owner.service';
import { ChatAccountExportSnapshotService } from './account-export-snapshot.service';
import { ChatAccountExportSnapshotController } from './account-export-snapshot.controller';

@Module({
  imports: [
    LoggerModule,
    ClientsModule.register([
      {
        name: ServiceTokens.SOCIAL_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.SOCIAL_HOST || 'social',
          port: Number(process.env.SOCIAL_PORT || 3003),
        },
      },
      {
        name: ServiceTokens.PROJECT_PLANNING_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.PROJECT_PLANNING_HOST || 'project-planning',
          port: Number(process.env.PROJECT_PLANNING_PORT || 3006),
        },
      },
    ]),
    ConfigModule.forRoot({
      load: [loadConfig],
      isGlobal: true,
    }),
    DatabaseModule.register({
      name: 'chat_collector',
      factory: loadDatabase,
    }),
  ],
  controllers: [AppController, ChatAccountExportSnapshotController],
  providers: [
    AppService,
    AccountExportOwnerSpoolService,
    {
      provide: AccountExportProfileSnapshotClient,
      useFactory: (profile: ClientProxy) =>
        new AccountExportProfileSnapshotClient(profile),
      inject: [ServiceTokens.PROFILE_SERVICE],
    },
    {
      provide: ServiceTokens.PROFILE_SERVICE,
      useFactory: () =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: process.env.SERVICE_PROFILE_HOST || 'profile',
            port: Number(process.env.SERVICE_PROFILE_PORT || 3002),
          },
        }),
    },
    {
      provide: 'CHAT_COLLECTOR_AUTH_PROXY',
      useFactory: () =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: process.env.SERVICE_AUTHENTICATION_HOST || 'authentication',
            port: Number(process.env.SERVICE_AUTHENTICATION_PORT || 3001),
          },
        }),
    },
    {
      provide: ChatAccountExportOwnerService,
      useFactory: (
        dataSource: DataSource,
        identities: AccountExportProfileSnapshotClient,
        auth: ClientProxy
      ) => new ChatAccountExportOwnerService(dataSource, identities, auth),
      inject: [
        'CHAT_COLLECTOR_CONNECTION',
        AccountExportProfileSnapshotClient,
        'CHAT_COLLECTOR_AUTH_PROXY',
      ],
    },
    {
      provide: ChatAccountExportSnapshotService,
      useFactory: (
        owner: ChatAccountExportOwnerService,
        spool: AccountExportOwnerSpoolService,
        auth: ClientProxy
      ) => new ChatAccountExportSnapshotService(owner, spool, auth),
      inject: [
        ChatAccountExportOwnerService,
        AccountExportOwnerSpoolService,
        'CHAT_COLLECTOR_AUTH_PROXY',
      ],
    },
    {
      provide: getRepositoryToken(Message),
      useFactory: (ds: DataSource) => ds.getRepository(Message),
      inject: ['CHAT_COLLECTOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Conversation),
      useFactory: (ds: DataSource) => ds.getRepository(Conversation),
      inject: ['CHAT_COLLECTOR_CONNECTION'],
    },
  ],
})
export class AppModule {}
