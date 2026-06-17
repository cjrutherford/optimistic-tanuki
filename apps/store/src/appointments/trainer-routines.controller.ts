import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { TrainerRoutinesService } from './trainer-routines.service';

@Controller()
export class TrainerRoutinesController {
  constructor(
    private readonly trainerRoutinesService: TrainerRoutinesService
  ) {}

  @MessagePattern('trainer.owner.routines.assign')
  assignRoutine(@Payload() payload: Record<string, unknown>) {
    return this.trainerRoutinesService.assignRoutine(payload as any);
  }

  @MessagePattern('trainer.owner.routines.findAll')
  getAllRoutines() {
    return this.trainerRoutinesService.getAllRoutines();
  }

  @MessagePattern('trainer.client.routines.find')
  getClientRoutines(
    @Payload() payload: { clientId: string; ownerId?: string | null }
  ) {
    return this.trainerRoutinesService.getClientRoutines(
      payload.clientId,
      payload.ownerId ?? null
    );
  }

  @MessagePattern('trainer.client.routines.complete')
  completeRoutine(@Payload() payload: { id: string; ownerId?: string | null }) {
    return this.trainerRoutinesService.completeRoutine(
      payload.id,
      payload.ownerId ?? null
    );
  }

  @MessagePattern('trainer.client.checkins.create')
  submitCheckIn(@Payload() payload: Record<string, unknown>) {
    return this.trainerRoutinesService.submitCheckIn(payload as any);
  }

  @MessagePattern('trainer.client.checkins.find')
  getClientCheckIns(
    @Payload() payload: { clientId: string; ownerId?: string | null }
  ) {
    return this.trainerRoutinesService.getClientCheckIns(
      payload.clientId,
      payload.ownerId ?? null
    );
  }

  @MessagePattern('trainer.owner.checkins.findAll')
  getAllCheckIns() {
    return this.trainerRoutinesService.getAllCheckIns();
  }
}
