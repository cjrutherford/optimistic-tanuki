import { Test, TestingModule } from '@nestjs/testing';
import { ChangeController } from './change.controller';
import { ChangeService } from './change.service';

describe('ChangeController', () => {
  let controller: ChangeController;
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
      controllers: [ChangeController],
      providers: [{ provide: ChangeService, useValue: service }],
    }).compile();

    controller = module.get<ChangeController>(ChangeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes requestingUserId to create separately from the DTO', async () => {
    await controller.create({
      projectId: 'p1',
      requestor: 'profile-1',
      requestingUserId: 'profile-1',
    } as never);
    expect(service.create).toHaveBeenCalledWith(
      { projectId: 'p1', requestor: 'profile-1' },
      'profile-1'
    );
  });

  it('passes requestingUserId to update separately from the DTO', async () => {
    await controller.update({
      id: 'c1',
      changeDescription: 'y',
      requestingUserId: 'profile-1',
    } as never);
    expect(service.update).toHaveBeenCalledWith(
      'c1',
      { id: 'c1', changeDescription: 'y' },
      'profile-1'
    );
  });

  it('passes requestingUserId to findAll separately from the query', async () => {
    await controller.findAll({
      changeDescription: 'x',
      requestingUserId: 'profile-1',
    } as never);
    expect(service.findAll).toHaveBeenCalledWith(
      { changeDescription: 'x' },
      'profile-1'
    );
  });

  it('passes requestingUserId to findOne', async () => {
    await controller.findOne('c1', 'profile-1');
    expect(service.findOne).toHaveBeenCalledWith('c1', 'profile-1');
  });

  it('passes requestingUserId to remove', async () => {
    await controller.remove('c1', 'profile-1');
    expect(service.remove).toHaveBeenCalledWith('c1', 'profile-1');
  });
});
