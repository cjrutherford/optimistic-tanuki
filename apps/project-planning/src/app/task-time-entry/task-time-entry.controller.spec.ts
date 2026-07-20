import { Test, TestingModule } from '@nestjs/testing';
import { TaskTimeEntryController } from './task-time-entry.controller';
import { TaskTimeEntryService } from './task-time-entry.service';

describe('TaskTimeEntryController', () => {
  let controller: TaskTimeEntryController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    stop: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      stop: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskTimeEntryController],
      providers: [{ provide: TaskTimeEntryService, useValue: service }],
    }).compile();

    controller = module.get<TaskTimeEntryController>(TaskTimeEntryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes requestingUserId to create separately from the dto', async () => {
    await controller.create({
      taskId: 't1',
      createdBy: 'profile-1',
      requestingUserId: 'profile-1',
    } as never);
    expect(service.create).toHaveBeenCalledWith(
      { taskId: 't1', createdBy: 'profile-1' },
      'profile-1'
    );
  });

  it('passes requestingUserId to findAll separately from the query', async () => {
    await controller.findAll({
      taskId: 't1',
      requestingUserId: 'profile-1',
    } as never);
    expect(service.findAll).toHaveBeenCalledWith({ taskId: 't1' }, 'profile-1');
  });

  it('passes requestingUserId to findOne', async () => {
    await controller.findOne('e1', 'profile-1');
    expect(service.findOne).toHaveBeenCalledWith('e1', 'profile-1');
  });

  it('passes requestingUserId to update separately from the dto', async () => {
    await controller.update({
      id: 'e1',
      description: 'x',
      requestingUserId: 'profile-1',
    } as never);
    expect(service.update).toHaveBeenCalledWith(
      'e1',
      { id: 'e1', description: 'x' },
      'profile-1'
    );
  });

  it('passes requestingUserId to stop', async () => {
    await controller.stop({
      id: 'e1',
      updatedBy: 'profile-1',
      requestingUserId: 'profile-1',
    });
    expect(service.stop).toHaveBeenCalledWith('e1', 'profile-1', 'profile-1');
  });

  it('passes requestingUserId to remove', async () => {
    await controller.remove('e1', 'profile-1');
    expect(service.remove).toHaveBeenCalledWith('e1', 'profile-1');
  });
});
