import {
  ACCOUNT_EXPORT_SNAPSHOT_LIMITS,
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  ProfileBoundAccountExportSnapshotDescriptor,
  isAccountExportCaptureGrant,
} from '@optimistic-tanuki/models';
import { firstValueFrom, timeout } from 'rxjs';
import { AccountExportSnapshotPullService } from './account-export-snapshot-pull.service';
import { OwnerSpoolHandle } from './account-export-owner-spool.service';

export interface AccountExportProfileBoundSnapshotClientOptions {
  participantId:
    | 'assets'
    | 'videos'
    | 'permissions'
    | 'social'
    | 'forum'
    | 'workspace';
  sources: readonly string[];
  open(payload: unknown, timeoutMs: number): Promise<unknown>;
  read(
    payload: unknown,
    timeoutMs: number
  ): Promise<AccountExportSnapshotReadResult>;
  release(payload: unknown, timeoutMs: number): Promise<unknown>;
  errorFactory(): Error;
}

export interface AccountExportProfileBoundCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: ProfileBoundAccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
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
const BOUND_FIELDS = [
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
  return { ...plainDataObject(value, keys as string[]) };
}

function cloneSnapshot(value: unknown): AccountExportSnapshotDescriptor {
  const source = plainDataObject(value, PARENT_FIELDS);
  if (!Array.isArray(source.sources)) throw new Error();
  const sources = source.sources.map((_item, index) => {
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

function cloneBoundDescriptor(
  value: unknown
): ProfileBoundAccountExportSnapshotDescriptor {
  const source = plainDataObject(value, BOUND_FIELDS);
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

/** Captures an Assets or Videos snapshot pinned to one leased Profile snapshot. */
export class AccountExportProfileBoundSnapshotClient {
  constructor(
    private readonly pull: AccountExportSnapshotPullService,
    private readonly options: AccountExportProfileBoundSnapshotClientOptions
  ) {}

  async capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<AccountExportProfileBoundCapture> {
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
      throw this.options.errorFactory();
    }

    let remoteHandleId: string | undefined;
    let handle: OwnerSpoolHandle<string> | undefined;
    const current = async () => {
      try {
        if (!(await renewLease())) throw new Error();
      } catch {
        throw this.options.errorFactory();
      }
    };
    const releaseRemote = async () => {
      if (remoteHandleId)
        await this.options.release(
          { ...grant, handleId: remoteHandleId },
          3000
        );
    };
    try {
      await current();
      const raw = await this.options.open(
        { ...grant, profileSnapshot: cloneSnapshot(parent) },
        55_000
      );
      let remote: ProfileBoundAccountExportSnapshotDescriptor;
      try {
        // A handle may be recoverable even if a different descriptor field is malformed.
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const descriptor = Object.getOwnPropertyDescriptor(raw, 'handleId');
          if (
            descriptor &&
            'value' in descriptor &&
            typeof descriptor.value === 'string' &&
            descriptor.value.length > 0 &&
            descriptor.value.length <= 64
          )
            remoteHandleId = descriptor.value;
        }
        remote = cloneBoundDescriptor(raw);
      } catch {
        throw this.options.errorFactory();
      }
      if (
        remote.participantId !== this.options.participantId ||
        remote.accountId !== grant.accountId ||
        remote.profileHandleId !== parent.handleId ||
        remote.profileCaptureId !== parent.captureId ||
        remote.profileSnapshotAt !== parent.snapshotAt ||
        !UUID.test(remote.profileHandleId) ||
        !UUID.test(remote.profileCaptureId) ||
        remote.identityCount !== 0
      )
        throw this.options.errorFactory();

      handle = await this.pull.capture({
        participantId: this.options.participantId,
        accountId: grant.accountId,
        sources: this.options.sources,
        snapshot: cloneSnapshot(
          Object.fromEntries(PARENT_FIELDS.map((key) => [key, remote[key]]))
        ),
        read: async (offset, length, signal) => {
          if (signal.aborted) throw this.options.errorFactory();
          await current();
          try {
            return await this.options.read(
              { ...grant, handleId: remote.handleId, offset, length },
              3000
            );
          } catch {
            throw this.options.errorFactory();
          }
        },
      });
      const resultHandle = handle;
      const resultDescriptor = cloneBoundDescriptor(remote);
      let closed = false;
      return {
        handle: resultHandle,
        descriptor: cloneBoundDescriptor(resultDescriptor),
        cleanup: async () => {
          if (closed) return;
          closed = true;
          let failure: unknown;
          try {
            await releaseRemote();
          } catch {
            failure = this.options.errorFactory();
          }
          try {
            await resultHandle.cleanup();
          } catch {
            failure = this.options.errorFactory();
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
        /* Keep the public error static. */
      }
      throw this.options.errorFactory();
    }
  }
}
