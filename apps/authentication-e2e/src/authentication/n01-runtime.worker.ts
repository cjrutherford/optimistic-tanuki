/** Private N01 process fixture. Never starts without the exact isolated target. */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { AssetType as ModelAssetType } from '@optimistic-tanuki/models';
import {
  LocalStorageAdapter,
  FileValidationService,
} from '@optimistic-tanuki/storage';
import { AppService as AssetsService } from '../../../assets/src/app/app.service';
import AssetEntity from '../../../assets/src/entities/asset.entity';
import { GuardianAssetActivity } from '../../../assets/src/entities/guardian-asset-activity.entity';
import { NotificationService } from '../../../social/src/app/services/notification.service';
import { Notification } from '../../../social/src/entities/notification.entity';
import loadAuthDatabase from '../../../authentication/src/app/loadDatabase';
import { AccountExportJobEntity } from '../../../authentication/src/account-export-jobs/entities/account-export-job.entity';
import { AccountExportJobService } from '../../../authentication/src/account-export-jobs/account-export-job.service';
import { AccountExportController } from '../../../authentication/src/app/account-export.controller';
import { GuardianPermissionEntity } from '../../../authentication/src/guardian-permissions/entities/guardian-permission.entity';
import { GuardianPolicyNoticeEntity } from '../../../authentication/src/guardian-permissions/entities/guardian-policy-notice.entity';
import { UserEntity } from '../../../authentication/src/user/entities/user.entity';
import { GuardianPolicyNoticeService } from '../../../authentication/src/guardian-permissions/guardian-policy-notice.service';
import { HttpApiEmailProvider } from '../../../../libs/email/src/lib/providers/http-api-email.provider';
import * as path from 'node:path';

Logger.overrideLogger(false);
if (
  process.env.N01_PRIVATE_MARKER !== 'private-n01-otts-v1' ||
  process.env.E2E_DB_PORT !== '15561' ||
  !process.send
)
  throw new Error('PRIVATE_N01_WORKER_REQUIRED');
const root = process.env.N01_STORAGE_ROOT || '';
if (
  !root.startsWith(
    path.join(
      process.cwd(),
      '.runtime-artifacts/account-rights/finish-sequence/background-work/runtime/storage/'
    )
  )
)
  throw new Error('PRIVATE_N01_STORAGE_REQUIRED');
const options = {
  type: 'postgres' as const,
  host: '127.0.0.1',
  port: 15561,
  username: 'postgres',
  password: 'postgres',
  synchronize: false,
  migrationsRun: false,
};
const assets = new DataSource({
  ...options,
  database: 'ot_assets',
  entities: [AssetEntity, GuardianAssetActivity],
});
const social = new DataSource({
  ...options,
  database: 'ot_social',
  entities: [Notification],
});
const auth = new DataSource({
  ...loadAuthDatabase(
    new ConfigService({
      database: { ...options, database: 'ot_authentication' },
    })
  ),
  synchronize: false,
  migrationsRun: false,
});
let releaseWrite: (() => void) | undefined;
let fault = '';
const base = new LocalStorageAdapter(new Logger(), root);
const adapter = Object.create(base);
adapter.create = async (data: unknown) => {
  const stored = await base.create(data as never);
  process.send!({
    event: 'asset-written',
    id: stored.id,
    storagePath: stored.storagePath,
  });
  if (fault === 'blocked' || fault === 'remove-failed')
    await new Promise<void>((done) => {
      releaseWrite = done;
    });
  if (fault === 'partial-write') throw new Error('N01_INJECTED_PARTIAL_WRITE');
  return stored;
};
adapter.remove = async (data: unknown) => {
  if (fault === 'remove-failed')
    throw Object.assign(new Error('N01_INJECTED_EIO'), { code: 'EIO' });
  return base.remove(data as never);
};
// Deliberately controlled antivirus boundary; this fixture proves lifecycle safety, not malware detection.
const assetService = new AssetsService(
  new Logger(),
  assets.getRepository(AssetEntity),
  adapter,
  new FileValidationService(),
  {
    scanFile: async () => ({
      isClean: true,
      scanner: 'N01-controlled-antivirus-boundary',
    }),
  } as never
);
const notifications = new NotificationService(
  social.getRepository(Notification)
);
const authClient = ClientProxyFactory.create({
  transport: Transport.TCP,
  options: { host: '127.0.0.1', port: 14901 },
});
const validator = {
  validateToken: (token: string, appId: string) =>
    firstValueFrom(
      authClient
        .send({ cmd: AuthCommands.Validate }, { token, appId })
        .pipe(timeout({ first: 5000 }))
    ),
};
const jobs = new (AccountExportJobService as any)(
  auth.getRepository(AccountExportJobEntity),
  auth,
  validator,
  ...Array.from({ length: 13 }, () => ({}))
);
const controller = new AccountExportController({} as never, jobs, {} as never);
const provider = new HttpApiEmailProvider({
  apiUrl: process.env.N01_PROVIDER_URL || 'http://127.0.0.1:14990/',
  apiKey: 'N01-private-provider-key',
});
const notices = new GuardianPolicyNoticeService(
  auth.getRepository(GuardianPermissionEntity),
  auth.getRepository(UserEntity),
  auth.getRepository(GuardianPolicyNoticeEntity),
  { sendEmail: (message: any) => provider.sendEmail(message) } as never
);
const active = new Set<Promise<void>>();

async function dispatch(op: string, data: any) {
  switch (op) {
    case 'asset-create':
      fault = data.fault || '';
      return assetService.createAsset({
        name: data.name,
        profileId: data.profileId,
        type: ModelAssetType.IMAGE,
        fileExtension: 'png',
        content: Buffer.from(data.bytes, 'base64'),
      });
    case 'asset-release':
      releaseWrite?.();
      return true;
    case 'asset-cleanup':
      fault = '';
      return assetService.cleanupPendingAssets();
    case 'asset-startup':
      fault = '';
      assetService.onModuleInit();
      return true;
    case 'asset-read':
      return (await base.read(data)).toString('base64');
    case 'asset-remove':
      await base.remove(data);
      return assets.getRepository(AssetEntity).delete({ id: data.id });
    case 'notification-queue':
      await notifications.queueNotification(data);
      return true;
    case 'notification-flush':
      await (notifications as any).flushNotification(
        (notifications as any).getNotificationKey(data)
      );
      return true;
    case 'notification-cancel':
      return notifications.cancelPendingForRecipient(data.recipientId);
    case 'notification-stop':
      await notifications.onModuleDestroy();
      return true;
    case 'job-cancel':
      return controller.cancelExportJob(data);
    case 'job-finish':
      return jobs.finish(
        data.claim,
        'complete',
        { artifactAvailable: true },
        null
      );
    case 'job-claim':
      return jobs.claim(data.jobId);
    case 'notice-deliver':
      return notices.deliverDueNotices(new Date(data.now));
    case 'notice-suppress':
      return notices.suppressPendingForGuardian(
        data.guardianUserId,
        data.appId
      );
    case 'stop':
      await notifications.onModuleDestroy();
      await notices.onModuleDestroy();
      assetService.onModuleDestroy();
      await Promise.all([assets.destroy(), social.destroy(), auth.destroy()]);
      authClient.close();
      return true;
    default:
      throw new Error('PRIVATE_N01_UNKNOWN_COMMAND');
  }
}
async function main() {
  await Promise.all([
    assets.initialize(),
    social.initialize(),
    auth.initialize(),
  ]);
  process.on('message', (message: any) => {
    const work = (async () => {
      try {
        const value = await dispatch(message.op, message.data);
        process.send!({ requestId: message.requestId, value });
        if (message.op === 'stop') process.disconnect();
      } catch (error: any) {
        process.send!({
          requestId: message.requestId,
          error: {
            code:
              error.getError?.()?.code || error.code || 'N01_OPERATION_FAILED',
          },
        });
      }
    })();
    active.add(work);
    void work.finally(() => active.delete(work));
  });
  process.send!({ event: 'ready' });
}
void main().catch(() => {
  process.send!({ event: 'startup-failed' });
  process.exitCode = 1;
});
