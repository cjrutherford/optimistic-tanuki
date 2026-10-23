import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ClassifiedCommands } from '@optimistic-tanuki/constants';
import { ClassifiedsAccountExportSnapshotService } from './account-export-snapshot.service';

@Controller()
export class ClassifiedsAccountExportSnapshotController {
  constructor(
    private readonly captures: ClassifiedsAccountExportSnapshotService
  ) {}
  @MessagePattern({ cmd: ClassifiedCommands.OPEN_ACCOUNT_EXPORT_CAPTURE }) open(
    @Payload() input: unknown
  ) {
    return this.captures.open(input);
  }
  @MessagePattern({ cmd: ClassifiedCommands.READ_ACCOUNT_EXPORT_CAPTURE }) read(
    @Payload() input: unknown
  ) {
    return this.captures.read(input);
  }
  @MessagePattern({ cmd: ClassifiedCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE })
  release(@Payload() input: unknown) {
    return this.captures.release(input);
  }
}
