import { Test, TestingModule } from '@nestjs/testing';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';

describe('RiskController', () => {
  let controller: RiskController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RiskController],
      providers: [RiskService],
    }).compile();

    controller = module.get<RiskController>(RiskController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
