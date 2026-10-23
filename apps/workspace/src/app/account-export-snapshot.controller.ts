import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WorkspaceCommands } from '@optimistic-tanuki/constants';
import { WorkspaceAccountExportSnapshotService } from './account-export-snapshot.service';

@Controller()
export class WorkspaceAccountExportSnapshotController {
  constructor(
    private readonly captures: WorkspaceAccountExportSnapshotService
  ) {}
  @MessagePattern({ cmd: WorkspaceCommands.OPEN_ACCOUNT_EXPORT_CAPTURE })
  open(@Payload() input: unknown) {
    return this.captures.open(input);
  }
  @MessagePattern({ cmd: WorkspaceCommands.READ_ACCOUNT_EXPORT_CAPTURE })
  read(@Payload() input: unknown) {
    return this.captures.read(input);
  }
  @MessagePattern({ cmd: WorkspaceCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE })
  release(@Payload() input: unknown) {
    return this.captures.release(input);
  }
}
