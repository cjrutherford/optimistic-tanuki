import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PermissionCommands } from '@optimistic-tanuki/constants';
import { PermissionsAccountExportSnapshotService } from './account-export-snapshot.service';

@Controller()
export class AccountExportSnapshotController {
  constructor(
    private readonly captures: PermissionsAccountExportSnapshotService
  ) {}

  @MessagePattern({ cmd: PermissionCommands.OPEN_ACCOUNT_EXPORT_CAPTURE })
  open(@Payload() input: unknown) {
    return this.captures.open(input);
  }

  @MessagePattern({ cmd: PermissionCommands.READ_ACCOUNT_EXPORT_CAPTURE })
  read(@Payload() input: unknown) {
    return this.captures.read(input);
  }

  @MessagePattern({ cmd: PermissionCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE })
  release(@Payload() input: unknown) {
    return this.captures.release(input);
  }
}
