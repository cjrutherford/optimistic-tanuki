import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

describe('TaskController', () => {
  let controller: TaskController;
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
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: service }],
    }).compile();

    controller = module.get<TaskController>(TaskController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes requestingUserId to create separately from the dto', async () => {
    await controller.create({
      title: 'x',
      requestingUserId: 'profile-1',
    } as never);
    expect(service.create).toHaveBeenCalledWith({ title: 'x' }, 'profile-1');
  });

  it('passes requestingUserId to findAll separately from the query', async () => {
    await controller.findAll({ title: 'x', requestingUserId: 'profile-1' });
    expect(service.findAll).toHaveBeenCalledWith({ title: 'x' }, 'profile-1');
  });

  it('passes requestingUserId to findOne', async () => {
    await controller.findOne('t1', 'profile-1');
    expect(service.findOne).toHaveBeenCalledWith('t1', 'profile-1');
  });

  it('passes requestingUserId to update separately from the dto', async () => {
    await controller.update({
      id: 't1',
      title: 'x',
      requestingUserId: 'profile-1',
    });
    expect(service.update).toHaveBeenCalledWith(
      't1',
      { id: 't1', title: 'x' },
      'profile-1'
    );
  });

  it('passes requestingUserId to remove', async () => {
    await controller.remove('t1', 'profile-1');
    expect(service.remove).toHaveBeenCalledWith('t1', 'profile-1');
  });
});
