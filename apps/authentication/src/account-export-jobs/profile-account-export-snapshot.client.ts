import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ServiceTokens,
  ProfileCommands,
  PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotIdentityPage,
  AccountExportSnapshotReadResult,
  isAccountExportCaptureGrant,
} from '@optimistic-tanuki/models';
import {
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';

// Shared with Profile's reader by protocol; no cross-app source imports.
export const PROFILE_CAPTURE_SOURCES = PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES;

export interface ProfileAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: AccountExportSnapshotDescriptor;
  identities(
    offset: number,
    limit: number
  ): Promise<AccountExportSnapshotIdentityPage>;
  cleanup(): Promise<void>;
}

export class ProfileAccountExportSnapshotClientError extends Error {
  constructor() {
    super('PROFILE_SNAPSHOT_UNAVAILABLE');
  }
}

@Injectable()
export class ProfileAccountExportSnapshotClient {
  constructor(
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profile: ClientProxy,
    private readonly pull: AccountExportSnapshotPullService
  ) {}

  async capture(
    input: AccountExportCaptureGrant,
    renewLease: () => Promise<boolean>
  ): Promise<ProfileAccountExportCapture> {
    if (!isAccountExportCaptureGrant(input))
      throw new ProfileAccountExportSnapshotClientError();
    const grant = {
      accountId: input.accountId,
      appId: input.appId,
      token: input.token,
      jobId: input.jobId,
      attempt: input.attempt,
      leaseOwner: input.leaseOwner,
    };
    let descriptor: AccountExportSnapshotDescriptor | undefined;
    let handle: OwnerSpoolHandle<string> | undefined;
    const current = async () => {
      if (!(await renewLease()))
        throw new ProfileAccountExportSnapshotClientError();
    };
    const releaseRemote = async () => {
      if (descriptor)
        await this.rpc(ProfileCommands.ReleaseAccountExportCapture, {
          ...grant,
          handleId: descriptor.handleId,
        });
    };
    try {
      await current();
      descriptor = await this.rpc<AccountExportSnapshotDescriptor>(
        ProfileCommands.OpenAccountExportCapture,
        grant,
        55_000
      );
      // The puller validates descriptor scope, source set, counts and byte proof.
      handle = await this.pull.capture({
        participantId: 'profile',
        accountId: grant.accountId,
        sources: PROFILE_CAPTURE_SOURCES,
        snapshot: descriptor,
        read: async (offset, length, signal) => {
          if (signal.aborted)
            throw new ProfileAccountExportSnapshotClientError();
          await current();
          return this.rpc<AccountExportSnapshotReadResult>(
            ProfileCommands.ReadAccountExportCapture,
            {
              ...grant,
              handleId: descriptor!.handleId,
              offset,
              length,
            }
          );
        },
      });
      const resultHandle = handle;
      const resultDescriptor = JSON.parse(
        JSON.stringify(descriptor)
      ) as AccountExportSnapshotDescriptor;
      let closed = false;
      return {
        handle: resultHandle,
        descriptor: JSON.parse(JSON.stringify(resultDescriptor)),
        identities: async (offset, limit) => {
          if (
            closed ||
            !Number.isSafeInteger(offset) ||
            offset < 0 ||
            offset > resultDescriptor.identityCount ||
            !Number.isSafeInteger(limit) ||
            limit < 1 ||
            limit > 100
          )
            throw new ProfileAccountExportSnapshotClientError();
          await current();
          const page = await this.rpc<AccountExportSnapshotIdentityPage>(
            ProfileCommands.ReadAccountExportCaptureIdentities,
            { ...grant, handleId: resultDescriptor.handleId, offset, limit }
          );
          const end = Math.min(offset + limit, resultDescriptor.identityCount);
          if (
            !page ||
            page.handleId !== resultDescriptor.handleId ||
            page.captureId !== resultDescriptor.captureId ||
            page.accountId !== grant.accountId ||
            page.snapshotAt !== resultDescriptor.snapshotAt ||
            page.total !== resultDescriptor.identityCount ||
            !Array.isArray(page.profileIds) ||
            page.profileIds.length !== end - offset ||
            page.nextOffset !== (end < page.total ? end : null) ||
            page.profileIds.some(
              (id, index) =>
                typeof id !== 'string' ||
                !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  id
                ) ||
                (index > 0 && id <= page.profileIds[index - 1])
            )
          )
            throw new ProfileAccountExportSnapshotClientError();
          return page;
        },
        cleanup: async () => {
          if (closed) return;
          closed = true;
          try {
            await releaseRemote();
          } finally {
            await resultHandle.cleanup();
          }
        },
      };
    } catch {
      try {
        await releaseRemote();
      } finally {
        if (handle) await handle.cleanup();
      }
      throw new ProfileAccountExportSnapshotClientError();
    }
  }

  private async rpc<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs = 3000
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.profile
          .send<T>({ cmd: command }, payload)
          .pipe(timeout({ first: timeoutMs }))
      );
    } catch {
      throw new ProfileAccountExportSnapshotClientError();
    }
  }
}
