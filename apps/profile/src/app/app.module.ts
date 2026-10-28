import {
  ActivityRetentionService,
  activityRetentionRule,
} from '@optimistic-tanuki/logger';
import type { DataSource as RetentionDataSource } from 'typeorm';
import { ActivityRetentionController } from './activity-retention.controller';
import { GuardianProfileActivity as RetentionEntity0 } from '../profiles/entities/guardian-profile-activity.entity';
import {
  AccountDeletionSnapshotController,
  ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
} from '@optimistic-tanuki/storage';
import { ProfileAccountDeletionFinalizerService } from './account-deletion-finalizer.service';
import { ProfileAccountDeletionOwnerService } from './account-deletion-owner.service';
import { ProfileAccountDeletionOwnerController } from './account-deletion-owner.controller';
import { AccountDeletionAuthorityClient } from '@optimistic-tanuki/storage';
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
import { ProfileAccountExportSnapshotService } from './account-export-snapshot.service';
import { AccountExportOwnerSpoolService } from '@optimistic-tanuki/storage';
import { AccountExportController } from '../profiles/account-export.controller';
import { ProfileAuditErasureService } from './audit-erasure.service';

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
    ActivityRetentionController,
    AccountDeletionSnapshotController,
    AppController,
    ProfilesController,
    TimelinesController,
    AccountExportController,
    ProfileAccountDeletionOwnerController,
  ],
  providers: [
    {
      provide: ActivityRetentionService,
      useFactory: (db: RetentionDataSource) =>
        new ActivityRetentionService('profile', db, [
          activityRetentionRule(db.getMetadata(RetentionEntity0), 'createdAt'),
        ]),
      inject: ['PROFILE_CONNECTION'],
    },
    {
      provide: ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
      useFactory: (
        snapshot: ProfileAccountExportSnapshotService,
        authority: AccountDeletionAuthorityClient,
        spool: AccountExportOwnerSpoolService,
        audit: ProfileAuditErasureService,
        database: {
          query(sql: string, parameters?: unknown[]): Promise<unknown>;
        }
      ) => ({
        owner: 'profile',
        snapshot,
        authority,
        spool,
        database,
        scopeReadback: async (accountId: string) => {
          const rows = (await database.query(
            `SELECT count(*)::text n FROM (SELECT 1 FROM profile WHERE lower(btrim("userId"::text))=$1 AND ("appScope" IS NULL OR "appScope" NOT IN ('client-interface','local-hub')) LIMIT 100001) AS unresolved`,
            [accountId]
          )) as { n: string }[];
          return Array.isArray(rows) && rows.length === 1 && rows[0]?.n === '0'
            ? 0
            : 1;
        },
        audit,
      }),
      inject: [
        ProfileAccountExportSnapshotService,
        AccountDeletionAuthorityClient,
        AccountExportOwnerSpoolService,
        ProfileAuditErasureService,
        'PROFILE_CONNECTION',
      ],
    },
    ProfileAccountDeletionFinalizerService,
    AppService,
    ProfileService,
    TimelineService,
    ProfileAuditErasureService,
    ProfileAccountDeletionOwnerService,
    {
      provide: AccountDeletionAuthorityClient,
      useFactory: (auth: ClientProxy) =>
        new AccountDeletionAuthorityClient(auth),
      inject: [ServiceTokens.AUTHENTICATION_SERVICE],
    },
    ProfileAccountExportService,
    {
      provide: AccountExportOwnerSpoolService,
      useFactory: () => new AccountExportOwnerSpoolService(),
    },
    {
      provide: ProfileAccountExportOwnerService,
      useFactory: (dataSource: DataSource, authClient: ClientProxy) =>
        new ProfileAccountExportOwnerService(dataSource, authClient),
      inject: ['PROFILE_CONNECTION', ServiceTokens.AUTHENTICATION_SERVICE],
    },
    {
      provide: ProfileAccountExportSnapshotService,
      useFactory: (
        owner: ProfileAccountExportOwnerService,
        spool: AccountExportOwnerSpoolService,
        authClient: ClientProxy
      ) => new ProfileAccountExportSnapshotService(owner, spool, authClient),
      inject: [
        ProfileAccountExportOwnerService,
        AccountExportOwnerSpoolService,
        ServiceTokens.AUTHENTICATION_SERVICE,
      ],
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
  exports: [ProfileAuditErasureService],
})
export class AppModule {}
