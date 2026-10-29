import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentCommands } from '@optimistic-tanuki/payments-contracts';
import { PaymentsAccountExportSnapshotService } from './account-export-snapshot.service';

@Controller()
export class PaymentsAccountExportSnapshotController {
  constructor(
    private readonly captures: PaymentsAccountExportSnapshotService
  ) {}

  @MessagePattern({ cmd: PaymentCommands.OPEN_ACCOUNT_EXPORT_CAPTURE })
  open(@Payload() input: unknown) {
    return this.captures.open(input);
  }

  @MessagePattern({ cmd: PaymentCommands.READ_ACCOUNT_EXPORT_CAPTURE })
  read(@Payload() input: unknown) {
    return this.captures.read(input);
  }

  @MessagePattern({ cmd: PaymentCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE })
  release(@Payload() input: unknown) {
    return this.captures.release(input);
  }
}
