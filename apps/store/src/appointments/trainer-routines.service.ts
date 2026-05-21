import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TrainerRoutineAssignmentEntity } from './entities/trainer-routine-assignment.entity';
import { TrainerProgressCheckInEntity } from './entities/trainer-progress-check-in.entity';

type CreateRoutineAssignment = {
  clientId: string;
  clientName: string;
  title: string;
  summary: string;
  focusAreas: string[];
};

type CreateProgressCheckIn = {
  clientId: string;
  assignmentId: string;
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

  async getAllRoutines(): Promise<TrainerRoutineAssignmentEntity[]> {
    return this.routineRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getClientRoutines(clientId: string): Promise<TrainerRoutineAssignmentEntity[]> {
    return this.routineRepository.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
  }

  async completeRoutine(id: string): Promise<TrainerRoutineAssignmentEntity | null> {
    await this.routineRepository.update(id, {
      status: 'completed',
      completedAt: new Date(),
    });

    return this.routineRepository.findOne({
      where: { id },
    });
  }

  async submitCheckIn(
    payload: CreateProgressCheckIn
  ): Promise<TrainerProgressCheckInEntity> {
    const checkIn = this.checkInRepository.create(payload);
    return this.checkInRepository.save(checkIn);
  }

  async getClientCheckIns(clientId: string): Promise<TrainerProgressCheckInEntity[]> {
    return this.checkInRepository.find({
      where: { clientId },
      order: { completedAt: 'DESC' },
    });
  }

  async getAllCheckIns(): Promise<TrainerProgressCheckInEntity[]> {
    return this.checkInRepository.find({
      order: { completedAt: 'DESC' },
    });
  }
}
