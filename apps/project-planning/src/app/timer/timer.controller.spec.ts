import { Test, TestingModule } from '@nestjs/testing';
import { TimerController } from './timer.controller';
import { TimerService } from './timer.service';

describe('TimerController', () => {
  let controller: TimerController;
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
      controllers: [TimerController],
      providers: [{ provide: TimerService, useValue: service }],
    }).compile();

    controller = module.get<TimerController>(TimerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes requestingUserId to findAll', async () => {
    await controller.findAll('profile-1');
    expect(service.findAll).toHaveBeenCalledWith('profile-1');
  });

  it('passes requestingUserId to findOne', async () => {
    await controller.findOne('tm1', 'profile-1');
    expect(service.findOne).toHaveBeenCalledWith('tm1', 'profile-1');
  });

  it('passes requestingUserId to remove', async () => {
    await controller.remove('tm1', 'profile-1');
    expect(service.remove).toHaveBeenCalledWith('tm1', 'profile-1');
  });
});
