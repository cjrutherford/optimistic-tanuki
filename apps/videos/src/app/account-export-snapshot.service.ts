import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileBoundSnapshotService,
} from '@optimistic-tanuki/storage';
import {
  VideosAccountExportOwnerService,
  VideosAccountExportSource,
} from './account-export-owner.service';

@Injectable()
export class VideosAccountExportSnapshotService extends AccountExportProfileBoundSnapshotService<VideosAccountExportSource> {
  constructor(
    owner: VideosAccountExportOwnerService,
    spoolService: AccountExportOwnerSpoolService,
    authClient: ClientProxy
  ) {
    super(owner, spoolService, authClient, {
      participantId: 'videos',
      sources: VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    });
  }
}
