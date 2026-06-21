import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TrainerRoutineAssignmentEntity } from './entities/trainer-routine-assignment.entity';
import { TrainerProgressCheckInEntity } from './entities/trainer-progress-check-in.entity';

type CreateRoutineAssignment = {
  clientId: string;
  ownerId?: string | null;
  clientName: string;
  title: string;
  summary: string;
  focusAreas: string[];
};

type CreateProgressCheckIn = {
  clientId: string;
  assignmentId: string;
  ownerId?: string | null;
  notes: string;
  energy: number;
};

@Injectable()
export class TrainerRoutinesService {
  constructor(
    @InjectRepository(TrainerRoutineAssignmentEntity)
    private readonly routineRepository: Repository<TrainerRoutineAssignmentEntity>,
    @InjectRepository(TrainerProgressCheckInEntity)
    private readonly checkInRepository: Repository<TrainerProgressCheckInEntity>
  ) {}

  async assignRoutine(
    payload: CreateRoutineAssignment
  ): Promise<TrainerRoutineAssignmentEntity> {
    const routine = this.routineRepository.create(payload);
    return this.routineRepository.save(routine);
  }

  async getAllRoutines(
    ownerId?: string | null
  ): Promise<TrainerRoutineAssignmentEntity[]> {
    return this.routineRepository.find({
      where: ownerId ? ({ ownerId } as never) : undefined,
      order: { createdAt: 'DESC' },
    });
  }

  async getClientRoutines(
    clientId: string,
    ownerId?: string | null
  ): Promise<TrainerRoutineAssignmentEntity[]> {
    return this.routineRepository.find({
      where: ownerId
        ? ({ clientId, ownerId } as never)
        : ({ clientId } as never),
      order: { createdAt: 'DESC' },
    });
  }

  async completeRoutine(
    id: string,
    ownerId?: string | null
  ): Promise<TrainerRoutineAssignmentEntity | null> {
    const where = ownerId ? ({ id, ownerId } as never) : ({ id } as never);

    await this.routineRepository.update(where, {
      status: 'completed',
      completedAt: new Date(),
    });

    return this.routineRepository.findOne({
      where,
    });
  }

  async submitCheckIn(
    payload: CreateProgressCheckIn
  ): Promise<TrainerProgressCheckInEntity> {
    if (payload.ownerId) {
      const routine = await this.routineRepository.findOne({
        where: {
          id: payload.assignmentId,
          clientId: payload.clientId,
          ownerId: payload.ownerId,
        } as never,
      });
      if (!routine) {
        throw new NotFoundException(
          `Routine assignment not found for the given owner, client, and assignment.`
        );
      }
    }

    const checkIn = this.checkInRepository.create(payload);
    return this.checkInRepository.save(checkIn);
  }

  async getClientCheckIns(
    clientId: string,
    ownerId?: string | null
  ): Promise<TrainerProgressCheckInEntity[]> {
    return this.checkInRepository.find({
      where: ownerId
        ? ({ clientId, ownerId } as never)
        : ({ clientId } as never),
      order: { completedAt: 'DESC' },
    });
  }

  async getAllCheckIns(
    ownerId?: string | null
  ): Promise<TrainerProgressCheckInEntity[]> {
    return this.checkInRepository.find({
      where: ownerId ? ({ ownerId } as never) : undefined,
      order: { completedAt: 'DESC' },
    });
  }
}
