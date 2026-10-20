import { ClientProxy } from '@nestjs/microservices';
import { ProfileCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  ACCOUNT_EXPORT_SNAPSHOT_LIMITS,
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotIdentityPage,
  AccountExportSnapshotIdentityRequest,
  isAccountExportCaptureGrant,
} from '@optimistic-tanuki/models';
import { Inject, Injectable } from '@nestjs/common';
import { Observable, firstValueFrom, takeUntil, timeout } from 'rxjs';

const RPC_TIMEOUT_MS = 3000;
const OPERATION_TIMEOUT_MS = ACCOUNT_EXPORT_SNAPSHOT_LIMITS.ttlMs;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface AssetsAccountExportProfileIdentityMetadata {
  accountId: string;
  handleId: string;
  captureId: string;
  snapshotAt: string;
  identityCount: number;
}

export type AssetsAccountExportProfileIdentityPageHandler = (
  profileIds: readonly string[],
  signal: AbortSignal
) => void | Promise<void>;

export class AssetsAccountExportProfileSnapshotError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'AssetsAccountExportProfileSnapshotError';
  }
}

/** Reads J6 identity pages without retaining the account's complete profile list. */
@Injectable()
export class AssetsAccountExportProfileSnapshotClient {
  constructor(
    @Inject(ServiceTokens.PROFILE_SERVICE) private readonly profile: ClientProxy
  ) {}

  async readIdentities(
    grantValue: AccountExportCaptureGrant,
    descriptorValue: AccountExportSnapshotDescriptor,
    onPage: AssetsAccountExportProfileIdentityPageHandler,
    externalSignal?: AbortSignal
  ): Promise<AssetsAccountExportProfileIdentityMetadata> {
    if (
      !isAccountExportCaptureGrant(grantValue) ||
      !this.validDescriptor(descriptorValue) ||
      typeof onPage !== 'function' ||
      externalSignal?.aborted
    ) {
      throw new AssetsAccountExportProfileSnapshotError(
        externalSignal?.aborted
          ? 'PROFILE_SNAPSHOT_ABORTED'
          : 'PROFILE_SNAPSHOT_INVALID'
      );
    }

    // Copy capability scope and descriptor metadata before any asynchronous work.
    const grant = {
      accountId: grantValue.accountId,
      appId: grantValue.appId,
      token: grantValue.token,
      jobId: grantValue.jobId,
      attempt: grantValue.attempt,
      leaseOwner: grantValue.leaseOwner,
    };
    const descriptor = {
      handleId: descriptorValue.handleId,
      participantId: descriptorValue.participantId,
      accountId: descriptorValue.accountId,
      captureId: descriptorValue.captureId,
      snapshotAt: descriptorValue.snapshotAt,
      identityCount: descriptorValue.identityCount,
    };
    if (
      descriptor.participantId !== 'profile' ||
      descriptor.accountId !== grant.accountId
    ) {
      throw new AssetsAccountExportProfileSnapshotError(
        'PROFILE_SNAPSHOT_INVALID'
      );
    }

    const controller = new AbortController();
    let failureCode:
      | 'PROFILE_SNAPSHOT_ABORTED'
      | 'PROFILE_SNAPSHOT_TIMEOUT'
      | undefined;
    const abortFromCaller = () => {
      failureCode = 'PROFILE_SNAPSHOT_ABORTED';
      controller.abort();
    };
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    const deadline = setTimeout(() => {
      failureCode = 'PROFILE_SNAPSHOT_TIMEOUT';
      controller.abort();
    }, OPERATION_TIMEOUT_MS);
    let removeAbortListener: (() => void) | undefined;
    const aborted = new Observable<void>((subscriber) => {
      const onAbort = () => {
        subscriber.next();
        subscriber.complete();
      };
      if (controller.signal.aborted) onAbort();
      else controller.signal.addEventListener('abort', onAbort, { once: true });
      return () => controller.signal.removeEventListener('abort', onAbort);
    });
    const abortPromise = new Promise<never>((_, reject) => {
      const onAbort = () => reject(this.abortError(failureCode));
      removeAbortListener = () =>
        controller.signal.removeEventListener('abort', onAbort);
      if (controller.signal.aborted) onAbort();
      else controller.signal.addEventListener('abort', onAbort, { once: true });
    });

    const operation =
      async (): Promise<AssetsAccountExportProfileIdentityMetadata> => {
        let previousId: string | undefined;
        const pages = Math.max(
          1,
          Math.ceil(
            descriptor.identityCount /
              ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize
          )
        );
        for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
          this.assertActive(controller.signal, failureCode);
          const offset =
            pageIndex * ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize;
          const expectedCount = Math.min(
            ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize,
            descriptor.identityCount - offset
          );
          const request: AccountExportSnapshotIdentityRequest = {
            ...grant,
            handleId: descriptor.handleId,
            offset,
            limit: ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize,
          };
          let result: AccountExportSnapshotIdentityPage;
          try {
            result = await firstValueFrom(
              this.profile
                .send<AccountExportSnapshotIdentityPage>(
                  { cmd: ProfileCommands.ReadAccountExportCaptureIdentities },
                  request
                )
                .pipe(timeout({ first: RPC_TIMEOUT_MS }), takeUntil(aborted))
            );
          } catch {
            this.assertActive(controller.signal, failureCode);
            throw new AssetsAccountExportProfileSnapshotError(
              'PROFILE_SNAPSHOT_UNAVAILABLE'
            );
          }
          this.assertActive(controller.signal, failureCode);
          const expectedNext =
            offset + expectedCount < descriptor.identityCount
              ? offset + expectedCount
              : null;
          if (
            !result ||
            result.handleId !== descriptor.handleId ||
            result.captureId !== descriptor.captureId ||
            result.accountId !== grant.accountId ||
            result.snapshotAt !== descriptor.snapshotAt ||
            result.total !== descriptor.identityCount ||
            !Array.isArray(result.profileIds) ||
            result.profileIds.length !== expectedCount ||
            result.nextOffset !== expectedNext ||
            (result.nextOffset !== null && result.nextOffset <= offset)
          ) {
            throw new AssetsAccountExportProfileSnapshotError(
              'PROFILE_SNAPSHOT_INVALID'
            );
          }
          for (const id of result.profileIds) {
            if (
              typeof id !== 'string' ||
              !UUID.test(id) ||
              (previousId !== undefined && id <= previousId)
            ) {
              throw new AssetsAccountExportProfileSnapshotError(
                'PROFILE_SNAPSHOT_INVALID'
              );
            }
            previousId = id;
          }
          if (expectedCount > 0) {
            this.assertActive(controller.signal, failureCode);
            try {
              await onPage(
                Object.freeze([...result.profileIds]),
                controller.signal
              );
            } catch {
              this.assertActive(controller.signal, failureCode);
              throw new AssetsAccountExportProfileSnapshotError(
                'PROFILE_SNAPSHOT_UNAVAILABLE'
              );
            }
            this.assertActive(controller.signal, failureCode);
          }
        }
        return {
          accountId: grant.accountId,
          handleId: descriptor.handleId,
          captureId: descriptor.captureId,
          snapshotAt: descriptor.snapshotAt,
          identityCount: descriptor.identityCount,
        };
      };

    try {
      return await Promise.race([operation(), abortPromise]);
    } finally {
      clearTimeout(deadline);
      externalSignal?.removeEventListener('abort', abortFromCaller);
      removeAbortListener?.();
    }
  }

  private validDescriptor(
    value: unknown
  ): value is AccountExportSnapshotDescriptor {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const descriptor = value as Partial<AccountExportSnapshotDescriptor>;
    return (
      typeof descriptor.handleId === 'string' &&
      UUID.test(descriptor.handleId) &&
      descriptor.participantId === 'profile' &&
      typeof descriptor.accountId === 'string' &&
      UUID.test(descriptor.accountId) &&
      typeof descriptor.captureId === 'string' &&
      UUID.test(descriptor.captureId) &&
      typeof descriptor.snapshotAt === 'string' &&
      descriptor.snapshotAt.length <= 128 &&
      Number.isFinite(Date.parse(descriptor.snapshotAt)) &&
      Number.isSafeInteger(descriptor.identityCount) &&
      descriptor.identityCount! >= 0 &&
      descriptor.identityCount! <=
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize *
          ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPages
    );
  }

  private assertActive(signal: AbortSignal, code?: string): void {
    if (signal.aborted) throw this.abortError(code);
  }

  private abortError(code?: string): AssetsAccountExportProfileSnapshotError {
    return new AssetsAccountExportProfileSnapshotError(
      code ?? 'PROFILE_SNAPSHOT_ABORTED'
    );
  }
}
