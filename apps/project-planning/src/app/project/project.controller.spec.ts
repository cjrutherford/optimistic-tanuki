import { Test, TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

describe('ProjectController', () => {
  let controller: ProjectController;
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
      controllers: [ProjectController],
      providers: [{ provide: ProjectService, useValue: service }],
    }).compile();

    controller = module.get<ProjectController>(ProjectController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes requestingUserId to findAll separately from the query', async () => {
    await controller.findAll({ name: 'x', requestingUserId: 'profile-1' });
    expect(service.findAll).toHaveBeenCalledWith({ name: 'x' }, 'profile-1');
  });

  it('passes requestingUserId to findOne', async () => {
    await controller.findOne('p1', 'profile-1');
    expect(service.findOne).toHaveBeenCalledWith('p1', 'profile-1');
  });

  it('passes requestingUserId to update separately from the dto', async () => {
    await controller.update({
      id: 'p1',
      name: 'x',
      requestingUserId: 'profile-1',
    });
    expect(service.update).toHaveBeenCalledWith(
      'p1',
      { id: 'p1', name: 'x' },
      'profile-1'
    );
  });

  it('passes requestingUserId to remove', async () => {
    await controller.remove('p1', 'profile-1');
    expect(service.remove).toHaveBeenCalledWith('p1', 'profile-1');
  });
});
