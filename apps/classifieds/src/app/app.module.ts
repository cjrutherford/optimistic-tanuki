import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { ClassifiedsController } from './classifieds.controller';
import { ClassifiedsService } from './classifieds.service';
import { ClassifiedAdEntity } from './entities/classified-ad.entity';
import loadDatabase from './loadDatabase';
import loadConfig from './config';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { DataSource } from 'typeorm';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { ClassifiedsAccountExportOwnerService } from './account-export-owner.service';
import { ClassifiedsAccountExportSnapshotService } from './account-export-snapshot.service';
import { ClassifiedsAccountExportSnapshotController } from './account-export-snapshot.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'classifieds',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [
    ClassifiedsController,
    ClassifiedsAccountExportSnapshotController,
  ],
  providers: [
    ClassifiedsService,
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
            host: process.env['SERVICE_PROFILE_HOST'] || 'profile',
            port: Number(process.env['SERVICE_PROFILE_PORT'] || 3002),
          },
        }),
    },
    {
      provide: 'CLASSIFIEDS_AUTH_PROXY',
      useFactory: () =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host:
              process.env['SERVICE_AUTHENTICATION_HOST'] || 'authentication',
            port: Number(process.env['SERVICE_AUTHENTICATION_PORT'] || 3001),
          },
        }),
    },
    {
      provide: ClassifiedsAccountExportOwnerService,
      useFactory: (
        ds: DataSource,
        identities: AccountExportProfileSnapshotClient,
        auth: ClientProxy
      ) => new ClassifiedsAccountExportOwnerService(ds, identities, auth),
      inject: [
        'CLASSIFIEDS_CONNECTION',
        AccountExportProfileSnapshotClient,
        'CLASSIFIEDS_AUTH_PROXY',
      ],
    },
    {
      provide: ClassifiedsAccountExportSnapshotService,
      useFactory: (
        owner: ClassifiedsAccountExportOwnerService,
        spool: AccountExportOwnerSpoolService,
        auth: ClientProxy
      ) => new ClassifiedsAccountExportSnapshotService(owner, spool, auth),
      inject: [
        ClassifiedsAccountExportOwnerService,
        AccountExportOwnerSpoolService,
        'CLASSIFIEDS_AUTH_PROXY',
      ],
    },
    {
      provide: ServiceTokens.SOCIAL_SERVICE,
      useFactory: () =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: process.env['SOCIAL_HOST'] || 'social',
            port: Number(process.env['SOCIAL_PORT'] || 3003),
          },
        }),
    },
    {
      provide: ServiceTokens.ASSETS_SERVICE,
      useFactory: () =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: process.env['ASSETS_HOST'] || 'assets',
            port: Number(process.env['ASSETS_PORT'] || 3005),
          },
        }),
    },
    {
      provide: getRepositoryToken(ClassifiedAdEntity),
      useFactory: (dataSource: any) =>
        dataSource.getRepository(ClassifiedAdEntity),
      inject: ['CLASSIFIEDS_CONNECTION'],
    },
  ],
})
export class AppModule {}
