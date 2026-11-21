import { Injectable } from '@nestjs/common';
import { DIRECTORY_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
} from '@optimistic-tanuki/models';
import {
  AccountExportProfileBoundSnapshotClient,
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { DirectoryOwnerHttpClient } from '../account-deletion/directory-owner-http.client';

export interface DirectoryAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: AccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
}

export class DirectoryAccountExportSnapshotClientError extends Error {
  constructor() {
    super('DIRECTORY_SNAPSHOT_UNAVAILABLE');
  }
}

/** Same open/read/release protocol as the TCP owners, carried over Directory's internal HTTP route. */
@Injectable()
export class DirectoryAccountExportSnapshotClient {
  private readonly shared: AccountExportProfileBoundSnapshotClient;

  constructor(
    private readonly directory: DirectoryOwnerHttpClient,
    pull: AccountExportSnapshotPullService
  ) {
    this.shared = new AccountExportProfileBoundSnapshotClient(pull, {
      participantId: 'directory',
      sources: DIRECTORY_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      errorFactory: () => new DirectoryAccountExportSnapshotClientError(),
      open: (payload, timeoutMs) => this.call('open', payload, timeoutMs),
      read: (payload, timeoutMs) =>
        this.call(
          'read',
          payload,
          timeoutMs
        ) as Promise<AccountExportSnapshotReadResult>,
      release: (payload, timeoutMs) => this.call('release', payload, timeoutMs),
    });
  }

  capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<DirectoryAccountExportCapture> {
    return this.shared.capture(input, profileInput, renewLease);
  }

  private async call(
    operation: 'open' | 'read' | 'release',
    payload: unknown,
    timeoutMs: number
  ): Promise<unknown> {
    try {
      return await this.directory.exportCapture(operation, payload, timeoutMs);
    } catch {
      throw new DirectoryAccountExportSnapshotClientError();
    }
  }
}
