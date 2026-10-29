import {
  AccountDeletionSnapshotController,
  ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
} from '@optimistic-tanuki/storage';
import { WorkspaceAccountDeletionOwnerService } from './account-deletion-owner.service';
import { WorkspaceAccountDeletionOwnerController } from './account-deletion-owner.controller';
import { AccountDeletionAuthorityClient } from '@optimistic-tanuki/storage';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { DataSource } from 'typeorm';
import loadConfig from '../config';
import { Workspace } from '../entities/workspace.entity';
import { AppController } from './app.controller';
import loadDatabase from './loadDatabase';
import { WorkspaceService } from './services/workspace.service';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { WorkspaceAccountExportOwnerService } from './account-export-owner.service';
import { WorkspaceAccountExportSnapshotService } from './account-export-snapshot.service';
import { WorkspaceAccountExportSnapshotController } from './account-export-snapshot.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfig] }),
    DatabaseModule.register({ name: 'workspace', factory: loadDatabase }),
  ],
  controllers: [
    AccountDeletionSnapshotController,
    WorkspaceAccountDeletionOwnerController,
    AppController,
    WorkspaceAccountExportSnapshotController,
  ],
  providers: [
    {
      provide: ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
      useFactory: (
        snapshot: WorkspaceAccountExportSnapshotService,
        authority: AccountDeletionAuthorityClient,
        spool: AccountExportOwnerSpoolService,
        database: { query(sql: string): Promise<unknown> }
      ) => ({ owner: 'workspace', snapshot, authority, spool, database }),
      inject: [
        WorkspaceAccountExportSnapshotService,
        AccountDeletionAuthorityClient,
        AccountExportOwnerSpoolService,
        'WORKSPACE_CONNECTION',
      ],
    },
    WorkspaceAccountDeletionOwnerService,
    {
      provide: AccountDeletionAuthorityClient,
      useFactory: (auth: ClientProxy) =>
        new AccountDeletionAuthorityClient(auth),
      inject: [ServiceTokens.AUTHENTICATION_SERVICE],
    },
    WorkspaceService,
    AccountExportOwnerSpoolService,
    AccountExportProfileSnapshotClient,
    {
      provide: ServiceTokens.AUTHENTICATION_SERVICE,
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
      provide: WorkspaceAccountExportOwnerService,
      useFactory: (
        ds: DataSource,
        identities: AccountExportProfileSnapshotClient,
        auth: any
      ) => new WorkspaceAccountExportOwnerService(ds, identities, auth),
      inject: [
        'WORKSPACE_CONNECTION',
        AccountExportProfileSnapshotClient,
        ServiceTokens.AUTHENTICATION_SERVICE,
      ],
    },
    {
      provide: WorkspaceAccountExportSnapshotService,
      useFactory: (
        owner: WorkspaceAccountExportOwnerService,
        spool: AccountExportOwnerSpoolService,
        auth: any
      ) => new WorkspaceAccountExportSnapshotService(owner, spool, auth),
      inject: [
        WorkspaceAccountExportOwnerService,
        AccountExportOwnerSpoolService,
        ServiceTokens.AUTHENTICATION_SERVICE,
      ],
    },
    {
      provide: getRepositoryToken(Workspace),
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(Workspace),
      inject: ['WORKSPACE_CONNECTION'],
    },
  ],
})
export class AppModule {}
