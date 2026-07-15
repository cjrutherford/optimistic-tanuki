import { Test, TestingModule } from '@nestjs/testing';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';

describe('RiskController', () => {
  let controller: RiskController;
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
      controllers: [RiskController],
      providers: [{ provide: RiskService, useValue: service }],
    }).compile();

    controller = module.get<RiskController>(RiskController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes requestingUserId to findAll separately from the query', async () => {
    await controller.findAll({
      description: 'x',
      requestingUserId: 'profile-1',
    } as never);
    expect(service.findAll).toHaveBeenCalledWith(
      { description: 'x' },
      'profile-1'
    );
  });

  it('passes requestingUserId to findOne', async () => {
    await controller.findOne('r1', 'profile-1');
    expect(service.findOne).toHaveBeenCalledWith('r1', 'profile-1');
  });

  it('passes requestingUserId to remove', async () => {
    await controller.remove('r1', 'profile-1');
    expect(service.remove).toHaveBeenCalledWith('r1', 'profile-1');
  });
});
