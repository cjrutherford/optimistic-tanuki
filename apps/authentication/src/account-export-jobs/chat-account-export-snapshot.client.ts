import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  ChatCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  ChatAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import {
  AccountExportProfileBoundSnapshotClient,
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';

export interface ChatAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: ChatAccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
}

export class ChatAccountExportSnapshotClientError extends Error {
  constructor() {
    super('CHAT_SNAPSHOT_UNAVAILABLE');
  }
}

@Injectable()
export class ChatAccountExportSnapshotClient {
  private readonly shared: AccountExportProfileBoundSnapshotClient;

  constructor(
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE)
    private readonly chatCollector: ClientProxy,
    pull: AccountExportSnapshotPullService
  ) {
    this.shared = new AccountExportProfileBoundSnapshotClient(pull, {
      participantId: 'chat-collector',
      sources: CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      errorFactory: () => new ChatAccountExportSnapshotClientError(),
      open: (payload, timeoutMs) =>
        this.rpc(ChatCommands.OPEN_ACCOUNT_EXPORT_CAPTURE, payload, timeoutMs),
      read: (payload, timeoutMs) =>
        this.rpc<AccountExportSnapshotReadResult>(
          ChatCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      release: (payload, timeoutMs) =>
        this.rpc(
          ChatCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
    });
  }

  capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<ChatAccountExportCapture> {
    return this.shared.capture(input, profileInput, renewLease);
  }

  private async rpc<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.chatCollector
          .send<T>({ cmd: command }, payload)
          .pipe(timeout({ first: timeoutMs }))
      );
    } catch {
      throw new ChatAccountExportSnapshotClientError();
    }
  }
}
