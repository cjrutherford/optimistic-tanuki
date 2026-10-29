import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AssetCommands } from '@optimistic-tanuki/constants';
import { AssetsAccountExportSnapshotService } from './account-export-snapshot.service';

@Controller()
export class AccountExportController {
  constructor(private readonly snapshots: AssetsAccountExportSnapshotService) {}

  @MessagePattern({ cmd: AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE })
  open(@Payload() request: unknown) {
    return this.snapshots.open(request);
  }

  @MessagePattern({ cmd: AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE })
  read(@Payload() request: unknown) {
    return this.snapshots.read(request);
  }

  @MessagePattern({ cmd: AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE })
  release(@Payload() request: unknown) {
    return this.snapshots.release(request);
  }
}
