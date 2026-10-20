import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ServiceTokens,
  VideoCommands,
  VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  VideosAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import {
  AccountExportProfileBoundSnapshotClient,
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';

export interface VideosAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: VideosAccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
}

export class VideosAccountExportSnapshotClientError extends Error {
  constructor() {
    super('VIDEOS_SNAPSHOT_UNAVAILABLE');
  }
}

@Injectable()
export class VideosAccountExportSnapshotClient {
  private readonly shared: AccountExportProfileBoundSnapshotClient;

  constructor(
    @Inject(ServiceTokens.VIDEOS_SERVICE) private readonly videos: ClientProxy,
    pull: AccountExportSnapshotPullService
  ) {
    this.shared = new AccountExportProfileBoundSnapshotClient(pull, {
      participantId: 'videos',
      sources: VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      errorFactory: () => new VideosAccountExportSnapshotClientError(),
      open: (payload, timeoutMs) =>
        this.rpc(VideoCommands.OPEN_ACCOUNT_EXPORT_CAPTURE, payload, timeoutMs),
      read: (payload, timeoutMs) =>
        this.rpc<AccountExportSnapshotReadResult>(
          VideoCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      release: (payload, timeoutMs) =>
        this.rpc(
          VideoCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
    });
  }

  capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<VideosAccountExportCapture> {
    return this.shared.capture(input, profileInput, renewLease);
  }

  private async rpc<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.videos
          .send<T>({ cmd: command }, payload)
          .pipe(timeout({ first: timeoutMs }))
      );
    } catch {
      throw new VideosAccountExportSnapshotClientError();
    }
  }
}
