import { Repository } from 'typeorm';

import { TrainerRoutinesService } from './trainer-routines.service';
import { TrainerRoutineAssignmentEntity } from './entities/trainer-routine-assignment.entity';
import { TrainerProgressCheckInEntity } from './entities/trainer-progress-check-in.entity';

describe('TrainerRoutinesService', () => {
  let routineRepository: jest.Mocked<
    Repository<TrainerRoutineAssignmentEntity>
  >;
  let checkInRepository: jest.Mocked<Repository<TrainerProgressCheckInEntity>>;
  let service: TrainerRoutinesService;

  beforeEach(() => {
    routineRepository = {
      create: jest.fn((payload) => payload as TrainerRoutineAssignmentEntity),
      save: jest.fn(
        async (payload) => payload as TrainerRoutineAssignmentEntity
      ),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<TrainerRoutineAssignmentEntity>>;

    checkInRepository = {
      create: jest.fn((payload) => payload as TrainerProgressCheckInEntity),
      save: jest.fn(async (payload) => payload as TrainerProgressCheckInEntity),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<TrainerProgressCheckInEntity>>;

    service = new TrainerRoutinesService(routineRepository, checkInRepository);
  });

  it('filters client routines by owner when owner scope is provided', async () => {
    routineRepository.find.mockResolvedValue([]);

    await service.getClientRoutines('client-1', 'owner-user-handyman');

    expect(routineRepository.find).toHaveBeenCalledWith({
      where: {
        clientId: 'client-1',
        ownerId: 'owner-user-handyman',
      },
      order: { createdAt: 'DESC' },
    });
  });

  it('completes a routine only within the matching owner scope', async () => {
    routineRepository.update.mockResolvedValue({} as never);
    routineRepository.findOne.mockResolvedValue({
      id: 'routine-1',
      ownerId: 'owner-user-handyman',
      status: 'completed',
    } as unknown as TrainerRoutineAssignmentEntity);

    await service.completeRoutine('routine-1', 'owner-user-handyman');

    expect(routineRepository.update).toHaveBeenCalledWith(
      {
        id: 'routine-1',
        ownerId: 'owner-user-handyman',
      },
      expect.objectContaining({ status: 'completed' })
    );
    expect(routineRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'routine-1',
        ownerId: 'owner-user-handyman',
      },
    });
  });

  it('stores owner scope on routine assignments and client check-ins', async () => {
    routineRepository.findOne.mockResolvedValue({
      id: 'routine-1',
      clientId: 'client-1',
      ownerId: 'owner-user-handyman',
    } as unknown as TrainerRoutineAssignmentEntity);

    await service.assignRoutine({
      clientId: 'client-1',
      clientName: 'Client One',
      ownerId: 'owner-user-handyman',
      title: 'Strength reset',
      summary: 'Three weekly sessions.',
      focusAreas: ['Strength'],
    });

    await service.submitCheckIn({
      clientId: 'client-1',
      assignmentId: 'routine-1',
      ownerId: 'owner-user-handyman',
      notes: 'Feeling strong.',
      energy: 8,
    });

    expect(routineRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner-user-handyman' })
    );
    expect(checkInRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner-user-handyman' })
    );
  });
});
