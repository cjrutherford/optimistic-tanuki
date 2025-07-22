import { Test, TestingModule } from '@nestjs/testing';
import { ChangeController } from './change.controller';
import { ChangeService } from './change.service';

describe('ChangeController', () => {
  let controller: ChangeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChangeController],
      providers: [ChangeService],
    }).compile();

    controller = module.get<ChangeController>(ChangeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
