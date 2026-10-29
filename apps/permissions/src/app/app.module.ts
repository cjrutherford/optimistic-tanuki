import {
  AccountDeletionSnapshotController,
  ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
} from '@optimistic-tanuki/storage';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { getRepositoryToken } from '@nestjs/typeorm';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';
import { Permission } from '../permissions/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import { PermissionsService } from './permissions.service';
import { RolesService } from './roles.service';
import { AppScopesService } from './app-scopes.service';
import { PermissionsController } from '../permissions/permissions.controller';
import { RolesController } from '../roles/roles.controller';
import { AppScopesController } from '../app-scopes/app-scopes.controller';
import { AccountExportService } from './account-export.service';
import { AccountExportController } from './account-export.controller';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileSnapshotClient,
  AccountDeletionAuthorityClient,
} from '@optimistic-tanuki/storage';
import { PermissionsAccountDeletionOwnerService } from './account-deletion-owner.service';
import { PermissionsAccountDeletionOwnerController } from './account-deletion-owner.controller';
import { PermissionsAccountExportOwnerService } from './account-export-owner.service';
import { PermissionsAccountExportSnapshotService } from './account-export-snapshot.service';
import { AccountExportSnapshotController } from './account-export-snapshot.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'permissions',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [
    AccountDeletionSnapshotController,
    PermissionsController,
    RolesController,
    AppScopesController,
    AccountExportController,
    AccountExportSnapshotController,
    PermissionsAccountDeletionOwnerController,
  ],
  providers: [
    {
      provide: ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
      useFactory: (
        snapshot: PermissionsAccountExportSnapshotService,
        authority: AccountDeletionAuthorityClient,
        spool: AccountExportOwnerSpoolService,
        database: { query(sql: string): Promise<unknown> }
      ) => ({ owner: 'permissions', snapshot, authority, spool, database }),
      inject: [
        PermissionsAccountExportSnapshotService,
        AccountDeletionAuthorityClient,
        AccountExportOwnerSpoolService,
        'PERMISSIONS_CONNECTION',
      ],
    },
    PermissionsService,
    PermissionsAccountDeletionOwnerService,
    {
      provide: AccountDeletionAuthorityClient,
      useFactory: (auth: ClientProxy) =>
        new AccountDeletionAuthorityClient(auth),
      inject: [ServiceTokens.AUTHENTICATION_SERVICE],
    },
    RolesService,
    AppScopesService,
    AccountExportService,
    AccountExportOwnerSpoolService,
    AccountExportProfileSnapshotClient,
    {
      provide: PermissionsAccountExportOwnerService,
      useFactory: (
        dataSource: DataSource,
        identities: AccountExportProfileSnapshotClient,
        authClient: ClientProxy
      ) =>
        new PermissionsAccountExportOwnerService(
          dataSource,
          identities,
          authClient
        ),
      inject: [
        'PERMISSIONS_CONNECTION',
        AccountExportProfileSnapshotClient,
        ServiceTokens.AUTHENTICATION_SERVICE,
      ],
    },
    {
      provide: PermissionsAccountExportSnapshotService,
      useFactory: (
        owner: PermissionsAccountExportOwnerService,
        spool: AccountExportOwnerSpoolService,
        authClient: ClientProxy
      ) =>
        new PermissionsAccountExportSnapshotService(owner, spool, authClient),
      inject: [
        PermissionsAccountExportOwnerService,
        AccountExportOwnerSpoolService,
        ServiceTokens.AUTHENTICATION_SERVICE,
      ],
    },
    {
      provide: ServiceTokens.AUTHENTICATION_SERVICE,
      useFactory: (config: ConfigService) => {
        const target = config.get<{ host: string; port: number }>(
          'services.authentication'
        );
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: target,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.PROFILE_SERVICE,
      useFactory: (config: ConfigService) => {
        const target = config.get<{ host: string; port: number }>(
          'services.profile'
        );
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: target,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: getRepositoryToken(Permission),
      useFactory: (ds: DataSource) => ds.getRepository(Permission),
      inject: ['PERMISSIONS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Role),
      useFactory: (ds: DataSource) => ds.getRepository(Role),
      inject: ['PERMISSIONS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(RoleAssignment),
      useFactory: (ds: DataSource) => ds.getRepository(RoleAssignment),
      inject: ['PERMISSIONS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(AppScope),
      useFactory: (ds: DataSource) => ds.getRepository(AppScope),
      inject: ['PERMISSIONS_CONNECTION'],
    },
  ],
})
export class AppModule {}
