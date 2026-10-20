import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  AssetCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  ACCOUNT_EXPORT_SNAPSHOT_LIMITS,
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  AssetsAccountExportSnapshotDescriptor,
  isAccountExportCaptureGrant,
} from '@optimistic-tanuki/models';
import {
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';

export const ASSETS_CAPTURE_SOURCES = ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES;

export interface AssetsAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: AssetsAccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
}

export class AssetsAccountExportSnapshotClientError extends Error {
  constructor() {
    super('ASSETS_SNAPSHOT_UNAVAILABLE');
  }
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PARENT_FIELDS = [
  'handleId',
  'participantId',
  'accountId',
  'captureId',
  'snapshotAt',
  'sizeBytes',
  'sha256',
  'rowCount',
  'sources',
  'sourceRowCounts',
  'sourceDispositions',
  'identityCount',
  'expiresAt',
] as const;
const ASSET_FIELDS = [
  ...PARENT_FIELDS,
  'profileHandleId',
  'profileCaptureId',
  'profileSnapshotAt',
] as const;

function plainDataObject(
  value: unknown,
  allowed: readonly string[]
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error();
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new Error();
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || !allowed.includes(key)))
    throw new Error();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new Error();
    result[key] = descriptor.value;
  }
  return result;
}

function cloneMap(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error();
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) throw new Error();
  const map = plainDataObject(value, keys as string[]);
  return { ...map };
}

function cloneSnapshot(value: unknown): AccountExportSnapshotDescriptor {
  const source = plainDataObject(value, PARENT_FIELDS);
  if (!Array.isArray(source.sources)) throw new Error();
  const sources = source.sources.map((item, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      source.sources,
      String(index)
    );
    if (
      !descriptor ||
      !('value' in descriptor) ||
      typeof descriptor.value !== 'string'
    )
      throw new Error();
    return descriptor.value;
  });
  if (Reflect.ownKeys(source.sources).length !== sources.length + 1)
    throw new Error();
  return {
    handleId: source.handleId as string,
    participantId: source.participantId as string,
    accountId: source.accountId as string,
    captureId: source.captureId as string,
    snapshotAt: source.snapshotAt as string,
    sizeBytes: source.sizeBytes as number,
    sha256: source.sha256 as string,
    rowCount: source.rowCount as number,
    sources,
    sourceRowCounts: cloneMap(source.sourceRowCounts) as Record<string, number>,
    sourceDispositions: cloneMap(source.sourceDispositions) as Record<
      string,
      string
    >,
    identityCount: source.identityCount as number,
    expiresAt: source.expiresAt as string,
  };
}

function cloneAssetsDescriptor(
  value: unknown
): AssetsAccountExportSnapshotDescriptor {
  const source = plainDataObject(value, ASSET_FIELDS);
  const common = cloneSnapshot(
    Object.fromEntries(PARENT_FIELDS.map((key) => [key, source[key]]))
  );
  return {
    ...common,
    profileHandleId: source.profileHandleId as string,
    profileCaptureId: source.profileCaptureId as string,
    profileSnapshotAt: source.profileSnapshotAt as string,
  };
}

@Injectable()
export class AssetsAccountExportSnapshotClient {
  constructor(
    @Inject(ServiceTokens.ASSETS_SERVICE) private readonly assets: ClientProxy,
    private readonly pull: AccountExportSnapshotPullService
  ) {}

  async capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<AssetsAccountExportCapture> {
    let grant: AccountExportCaptureGrant;
    let parent: AccountExportSnapshotDescriptor;
    try {
      const inputFields = plainDataObject(input, [
        'accountId',
        'appId',
        'token',
        'jobId',
        'attempt',
        'leaseOwner',
      ]);
      if (!isAccountExportCaptureGrant(inputFields)) throw new Error();
      // Freeze capability and parent metadata before the first asynchronous boundary.
      grant = {
        accountId: inputFields.accountId as string,
        appId: inputFields.appId as string,
        token: inputFields.token as string,
        jobId: inputFields.jobId as string,
        attempt: inputFields.attempt as number,
        leaseOwner: inputFields.leaseOwner as string,
      };
      parent = cloneSnapshot(profileInput);
      if (
        parent.participantId !== 'profile' ||
        parent.accountId !== grant.accountId ||
        !UUID.test(parent.handleId) ||
        !UUID.test(parent.captureId) ||
        typeof parent.snapshotAt !== 'string' ||
        parent.snapshotAt.length > 64 ||
        !Number.isFinite(Date.parse(parent.snapshotAt)) ||
        !Number.isSafeInteger(parent.identityCount) ||
        parent.identityCount < 0 ||
        parent.identityCount >
          ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPages *
            ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize
      )
        throw new Error();
    } catch {
      throw new AssetsAccountExportSnapshotClientError();
    }

    let remote: AssetsAccountExportSnapshotDescriptor | undefined;
    let remoteHandleId: string | undefined;
    let handle: OwnerSpoolHandle<string> | undefined;
    const current = async () => {
      try {
        if (!(await renewLease())) throw new Error();
      } catch {
        throw new AssetsAccountExportSnapshotClientError();
      }
    };
    const releaseRemote = async () => {
      if (remoteHandleId)
        await this.rpc(AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: remoteHandleId,
        });
    };
    try {
      await current();
      const raw = await this.rpc<unknown>(
        AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        {
          ...grant,
          profileSnapshot: cloneSnapshot(parent),
        },
        55_000
      );
      // Preserve the remote handle for release even when another descriptor field is invalid.
      try {
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const handleDescriptor = Object.getOwnPropertyDescriptor(
            raw,
            'handleId'
          );
          if (
            handleDescriptor &&
            'value' in handleDescriptor &&
            typeof handleDescriptor.value === 'string' &&
            handleDescriptor.value.length > 0 &&
            handleDescriptor.value.length <= 64
          )
            remoteHandleId = handleDescriptor.value;
        }
        remote = cloneAssetsDescriptor(raw);
      } catch {
        throw new AssetsAccountExportSnapshotClientError();
      }
      const result = remote;
      if (
        result.participantId !== 'assets' ||
        result.accountId !== grant.accountId ||
        result.profileHandleId !== parent.handleId ||
        result.profileCaptureId !== parent.captureId ||
        result.profileSnapshotAt !== parent.snapshotAt ||
        !UUID.test(result.profileHandleId) ||
        !UUID.test(result.profileCaptureId) ||
        result.identityCount !== 0
      )
        throw new AssetsAccountExportSnapshotClientError();

      handle = await this.pull.capture({
        participantId: 'assets',
        accountId: grant.accountId,
        sources: ASSETS_CAPTURE_SOURCES,
        snapshot: cloneSnapshot(
          Object.fromEntries(PARENT_FIELDS.map((key) => [key, result[key]]))
        ),
        read: async (offset, length, signal) => {
          if (signal.aborted)
            throw new AssetsAccountExportSnapshotClientError();
          await current();
          return this.rpc<AccountExportSnapshotReadResult>(
            AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE,
            {
              ...grant,
              handleId: result.handleId,
              offset,
              length,
            }
          );
        },
      });
      const resultHandle = handle;
      const resultDescriptor = cloneAssetsDescriptor(result);
      let closed = false;
      return {
        handle: resultHandle,
        descriptor: cloneAssetsDescriptor(resultDescriptor),
        cleanup: async () => {
          if (closed) return;
          closed = true;
          let failure: unknown;
          try {
            await releaseRemote();
          } catch {
            failure = new AssetsAccountExportSnapshotClientError();
          }
          try {
            await resultHandle.cleanup();
          } catch {
            failure = new AssetsAccountExportSnapshotClientError();
          }
          if (failure) throw failure;
        },
      };
    } catch {
      try {
        await releaseRemote();
      } catch {
        /* Keep the public error static. */
      }
      try {
        if (handle) await handle.cleanup();
      } catch {
        /* Still keep the public error static. */
      }
      throw new AssetsAccountExportSnapshotClientError();
    }
  }

  private async rpc<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs = 3000
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.assets
          .send<T>({ cmd: command }, payload)
          .pipe(timeout({ first: timeoutMs }))
      );
    } catch {
      throw new AssetsAccountExportSnapshotClientError();
    }
  }
}
