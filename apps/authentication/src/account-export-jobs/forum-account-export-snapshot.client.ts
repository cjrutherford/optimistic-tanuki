import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  ForumCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  ForumAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import {
  AccountExportProfileBoundSnapshotClient,
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';

export interface ForumAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: ForumAccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
}

export class ForumAccountExportSnapshotClientError extends Error {
  constructor() {
    super('FORUM_SNAPSHOT_UNAVAILABLE');
  }
}

@Injectable()
export class ForumAccountExportSnapshotClient {
  private readonly shared: AccountExportProfileBoundSnapshotClient;

  constructor(
    @Inject(ServiceTokens.FORUM_SERVICE) private readonly forum: ClientProxy,
    pull: AccountExportSnapshotPullService
  ) {
    this.shared = new AccountExportProfileBoundSnapshotClient(pull, {
      participantId: 'forum',
      sources: FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      errorFactory: () => new ForumAccountExportSnapshotClientError(),
      open: (payload, timeoutMs) =>
        this.rpc(ForumCommands.OPEN_ACCOUNT_EXPORT_CAPTURE, payload, timeoutMs),
      read: (payload, timeoutMs) =>
        this.rpc<AccountExportSnapshotReadResult>(
          ForumCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      release: (payload, timeoutMs) =>
        this.rpc(
          ForumCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
    });
  }

  capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<ForumAccountExportCapture> {
    return this.shared.capture(input, profileInput, renewLease);
  }

  private async rpc<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.forum
          .send<T>({ cmd: command }, payload)
          .pipe(timeout({ first: timeoutMs }))
      );
    } catch {
      throw new ForumAccountExportSnapshotClientError();
    }
  }
}
