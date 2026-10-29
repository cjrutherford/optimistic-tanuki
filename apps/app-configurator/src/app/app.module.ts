import {
  AccountDeletionSnapshotController,
  ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
} from '@optimistic-tanuki/storage';
import { AppConfiguratorAccountDeletionOwnerService } from './account-deletion-owner.service';
import { AppConfiguratorAccountDeletionOwnerController } from './account-deletion-owner.controller';
import { AccountDeletionAuthorityClient } from '@optimistic-tanuki/storage';
import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { getRepositoryToken } from '@nestjs/typeorm';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';
import { ConfigurationsService } from './configurations.service';
import { ConfigurationsController } from '../configurations/configurations.controller';
import {
  ClientProxyFactory,
  Transport,
  ClientProxy,
} from '@nestjs/microservices';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { AppConfiguratorAccountExportOwnerService } from './account-export-owner.service';
import { AppConfiguratorAccountExportSnapshotService } from './account-export-snapshot.service';
import { AppConfiguratorAccountExportSnapshotController } from './account-export-snapshot.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'app-configurator',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [
    AccountDeletionSnapshotController,
    AppConfiguratorAccountDeletionOwnerController,
    ConfigurationsController,
    AppConfiguratorAccountExportSnapshotController,
  ],
  providers: [
    {
      provide: ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
      useFactory: (
        snapshot: AppConfiguratorAccountExportSnapshotService,
        authority: AccountDeletionAuthorityClient,
        spool: AccountExportOwnerSpoolService,
        database: { query(sql: string): Promise<unknown> }
      ) => ({
        owner: 'app-configurator',
        snapshot,
        authority,
        spool,
        database,
      }),
      inject: [
        AppConfiguratorAccountExportSnapshotService,
        AccountDeletionAuthorityClient,
        AccountExportOwnerSpoolService,
        'APP-CONFIGURATOR_CONNECTION',
      ],
    },
    AppConfiguratorAccountDeletionOwnerService,
    {
      provide: AccountDeletionAuthorityClient,
      useFactory: (auth: ClientProxy) =>
        new AccountDeletionAuthorityClient(auth),
      inject: ['APP_CONFIGURATOR_AUTH_PROXY'],
    },
    ConfigurationsService,
    Logger,
    AccountExportOwnerSpoolService,
    {
      provide: AppConfiguratorAccountExportOwnerService,
      useFactory: (
        ds: DataSource,
        identities: AccountExportProfileSnapshotClient,
        auth: any
      ) => new AppConfiguratorAccountExportOwnerService(ds, identities, auth),
      inject: [
        'APP-CONFIGURATOR_CONNECTION',
        AccountExportProfileSnapshotClient,
        'APP_CONFIGURATOR_AUTH_PROXY',
      ],
    },
    {
      provide: AccountExportProfileSnapshotClient,
      useFactory: (profile: any) =>
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
      provide: 'APP_CONFIGURATOR_AUTH_PROXY',
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
      provide: AppConfiguratorAccountExportSnapshotService,
      useFactory: (
        owner: AppConfiguratorAccountExportOwnerService,
        spool: AccountExportOwnerSpoolService,
        auth: ClientProxy
      ) => new AppConfiguratorAccountExportSnapshotService(owner, spool, auth),
      inject: [
        AppConfiguratorAccountExportOwnerService,
        AccountExportOwnerSpoolService,
        'APP_CONFIGURATOR_AUTH_PROXY',
      ],
    },
    {
      provide: getRepositoryToken(AppConfigurationEntity),
      useFactory: (ds: DataSource) => ds.getRepository(AppConfigurationEntity),
      inject: ['APP-CONFIGURATOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(AppInstanceEntity),
      useFactory: (ds: DataSource) => ds.getRepository(AppInstanceEntity),
      inject: ['APP-CONFIGURATOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(AppMembershipEntity),
      useFactory: (ds: DataSource) => ds.getRepository(AppMembershipEntity),
      inject: ['APP-CONFIGURATOR_CONNECTION'],
    },
  ],
})
export class AppModule {}
