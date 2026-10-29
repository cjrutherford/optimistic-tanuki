import {
  ActivityRetentionService,
  activityRetentionRule,
} from '@optimistic-tanuki/logger';
import type { DataSource as RetentionDataSource } from 'typeorm';
import { ActivityRetentionController } from './activity-retention.controller';
import { ForumModerationAction as RetentionEntity0 } from '../entities/forum-moderation-action.entity';
import {
  AccountDeletionSnapshotController,
  ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
} from '@optimistic-tanuki/storage';
import { ForumAccountDeletionOwnerService } from './account-deletion-owner.service';
import { ForumAccountDeletionOwnerController } from './account-deletion-owner.controller';
import { AccountDeletionAuthorityClient } from '@optimistic-tanuki/storage';
import { ForumAccessService } from './services/forum-access.service';
import { Module } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import loadConfig from '../config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadDatabase from './loadDatabase';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Topic } from '../entities/topic.entity';
import { Thread } from '../entities/thread.entity';
import { ForumPost } from '../entities/forum-post.entity';
import { ForumLink } from '../entities/forum-link.entity';
import { ForumReport } from '../entities/forum-report.entity';
import { ForumModerationAction } from '../entities/forum-moderation-action.entity';
import { DataSource } from 'typeorm';
import { TopicService } from './services/topic.service';
import { ThreadService } from './services/thread.service';
import { ForumPostService } from './services/forum-post.service';
import { ForumModerationService } from './services/forum-moderation.service';
import { ForumSeedService } from './services/forum-seed.service';
import { ForumAccountExportService } from './account-export.service';
import { ForumAccountExportController } from './account-export.controller';
import { ForumAccountExportOwnerService } from './account-export-owner.service';
import { ForumAccountExportSnapshotService } from './account-export-snapshot.service';
import { ForumAccountExportSnapshotController } from './account-export-snapshot.controller';
import { ForumAuditErasureService } from './audit-erasure.service';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'forum',
      factory: loadDatabase,
    }),
  ],
  controllers: [
    ActivityRetentionController,
    AccountDeletionSnapshotController,
    ForumAccountDeletionOwnerController,
    AppController,
    ForumAccountExportController,
    ForumAccountExportSnapshotController,
  ],
  providers: [
    {
      provide: ActivityRetentionService,
      useFactory: (db: RetentionDataSource) =>
        new ActivityRetentionService('forum', db, [
          activityRetentionRule(db.getMetadata(RetentionEntity0), 'createdAt'),
        ]),
      inject: ['FORUM_CONNECTION'],
    },
    {
      provide: ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
      useFactory: (
        snapshot: ForumAccountExportSnapshotService,
        authority: AccountDeletionAuthorityClient,
        spool: AccountExportOwnerSpoolService,
        audit: ForumAuditErasureService,
        database: { query(sql: string): Promise<unknown> }
      ) => ({ owner: 'forum', snapshot, authority, spool, database, audit }),
      inject: [
        ForumAccountExportSnapshotService,
        AccountDeletionAuthorityClient,
        AccountExportOwnerSpoolService,
        ForumAuditErasureService,
        'FORUM_CONNECTION',
      ],
    },
    ForumAccountDeletionOwnerService,
    {
      provide: AccountDeletionAuthorityClient,
      useFactory: (auth: ClientProxy) =>
        new AccountDeletionAuthorityClient(auth),
      inject: [ServiceTokens.AUTHENTICATION_SERVICE],
    },
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
    ForumAccountExportService,
    ForumAuditErasureService,
    AccountExportOwnerSpoolService,
    AccountExportProfileSnapshotClient,
    {
      provide: ForumAccountExportOwnerService,
      useFactory: (
        ds: DataSource,
        identities: AccountExportProfileSnapshotClient,
        auth: any
      ) => new ForumAccountExportOwnerService(ds, identities, auth),
      inject: [
        'FORUM_CONNECTION',
        AccountExportProfileSnapshotClient,
        ServiceTokens.AUTHENTICATION_SERVICE,
      ],
    },
    {
      provide: ForumAccountExportSnapshotService,
      useFactory: (
        owner: ForumAccountExportOwnerService,
        spool: AccountExportOwnerSpoolService,
        auth: any
      ) => new ForumAccountExportSnapshotService(owner, spool, auth),
      inject: [
        ForumAccountExportOwnerService,
        AccountExportOwnerSpoolService,
        ServiceTokens.AUTHENTICATION_SERVICE,
      ],
    },
    {
      provide: ServiceTokens.ASSETS_SERVICE,
      useFactory: () =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: process.env.SERVICE_ASSETS_HOST || 'assets',
            port: Number(process.env.SERVICE_ASSETS_PORT || 3005),
          },
        }),
    },
    ForumAccessService,
    TopicService,
    ThreadService,
    ForumPostService,
    ForumModerationService,
    ForumSeedService,
    {
      provide: getRepositoryToken(Topic),
      useFactory: (ds: DataSource) => ds.getRepository(Topic),
      inject: ['FORUM_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Thread),
      useFactory: (ds: DataSource) => ds.getRepository(Thread),
      inject: ['FORUM_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ForumPost),
      useFactory: (ds: DataSource) => ds.getRepository(ForumPost),
      inject: ['FORUM_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ForumLink),
      useFactory: (ds: DataSource) => ds.getRepository(ForumLink),
      inject: ['FORUM_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ForumReport),
      useFactory: (ds: DataSource) => ds.getRepository(ForumReport),
      inject: ['FORUM_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ForumModerationAction),
      useFactory: (ds: DataSource) => ds.getRepository(ForumModerationAction),
      inject: ['FORUM_CONNECTION'],
    },
  ],
  exports: [ForumAuditErasureService],
})
export class AppModule {}
