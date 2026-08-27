import { Test, TestingModule } from '@nestjs/testing';
import { TaskNoteController } from './task-note.controller';
import { TaskNoteService } from './task-note.service';

describe('TaskNoteController', () => {
  let controller: TaskNoteController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskNoteController],
      providers: [{ provide: TaskNoteService, useValue: service }],
    }).compile();

    controller = module.get<TaskNoteController>(TaskNoteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes requestingUserId to create separately from the dto', async () => {
    await controller.create({
      taskId: 't1',
      profileId: 'profile-1',
      content: 'hi',
      requestingUserId: 'profile-1',
    } as never);
    expect(service.create).toHaveBeenCalledWith(
      { taskId: 't1', profileId: 'profile-1', content: 'hi' },
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
    await controller.findOne('n1', 'profile-1');
    expect(service.findOne).toHaveBeenCalledWith('n1', 'profile-1');
  });

  it('passes requestingUserId to update separately from the dto', async () => {
    await controller.update({
      id: 'n1',
      content: 'x',
      requestingUserId: 'profile-1',
    } as never);
    expect(service.update).toHaveBeenCalledWith(
      'n1',
      { id: 'n1', content: 'x' },
      'profile-1'
    );
  });

  it('passes requestingUserId to remove', async () => {
    await controller.remove('n1', 'profile-1');
    expect(service.remove).toHaveBeenCalledWith('n1', 'profile-1');
  });
});
