import { TrainerRoutinesService } from './trainer-routines.service';

describe('TrainerRoutinesService', () => {
  const routineRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
  };

  const checkInRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  function createService() {
    return new TrainerRoutinesService(
      routineRepo as never,
      checkInRepo as never
    );
  }

  it('creates and queries routine assignments by clientId', async () => {
    const payload = {
      clientId: 'profile-1',
      clientName: 'Client One',
      title: 'Strength block',
      summary: 'Three focused sessions per week.',
      focusAreas: ['Strength', 'Mobility'],
    };
    const savedRoutine = {
      id: 'routine-1',
      createdAt: '2026-05-03T21:00:00.000Z',
      ...payload,
    };

    routineRepo.create.mockReturnValue(savedRoutine);
    routineRepo.save.mockResolvedValue(savedRoutine);
    routineRepo.find.mockResolvedValue([savedRoutine]);

    const service = createService();

    await expect(service.assignRoutine(payload)).resolves.toEqual(savedRoutine);
    await expect(service.getClientRoutines('profile-1')).resolves.toEqual([
      savedRoutine,
    ]);
    await expect(service.getAllRoutines()).resolves.toEqual([savedRoutine]);

    expect(routineRepo.create).toHaveBeenCalledWith(payload);
    expect(routineRepo.find).toHaveBeenNthCalledWith(1, {
      where: { clientId: 'profile-1' },
      order: { createdAt: 'DESC' },
    });
    expect(routineRepo.find).toHaveBeenNthCalledWith(2, {
      order: { createdAt: 'DESC' },
    });
  });

  it('creates and queries client check-ins by clientId', async () => {
    const payload = {
      clientId: 'profile-1',
      assignmentId: 'routine-1',
      notes: 'Feeling strong',
      energy: 8,
    };
    const savedCheckIn = {
      id: 'checkin-1',
      completedAt: '2026-05-03T21:10:00.000Z',
      ...payload,
    };

    checkInRepo.create.mockReturnValue(savedCheckIn);
    checkInRepo.save.mockResolvedValue(savedCheckIn);
    checkInRepo.find.mockResolvedValue([savedCheckIn]);

    const service = createService();

    await expect(service.submitCheckIn(payload)).resolves.toEqual(savedCheckIn);
    await expect(service.getClientCheckIns('profile-1')).resolves.toEqual([
      savedCheckIn,
    ]);

    expect(checkInRepo.create).toHaveBeenCalledWith(payload);
    expect(checkInRepo.find).toHaveBeenCalledWith({
      where: { clientId: 'profile-1' },
      order: { completedAt: 'DESC' },
    });
  });

  it('marks a routine assignment complete', async () => {
    const savedRoutine = {
      id: 'routine-1',
      clientId: 'profile-1',
      status: 'completed',
      completedAt: '2026-05-07T21:10:00.000Z',
    };

    routineRepo.update = jest.fn().mockResolvedValue({ affected: 1 });
    routineRepo.findOne = jest.fn().mockResolvedValue(savedRoutine);

    const service = createService() as TrainerRoutinesService & {
      completeRoutine(id: string): Promise<unknown>;
    };

    await expect(service.completeRoutine('routine-1')).resolves.toEqual(
      savedRoutine
    );
    expect(routineRepo.update).toHaveBeenCalledWith('routine-1', {
      status: 'completed',
      completedAt: expect.any(Date),
    });
  });
});
