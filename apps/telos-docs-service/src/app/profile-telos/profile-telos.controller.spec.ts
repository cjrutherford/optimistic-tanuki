import { Test, TestingModule } from '@nestjs/testing';
import { ProfileTelosController } from './profile-telos.controller';

describe('ProfileTelosController', () => {
  let controller: ProfileTelosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileTelosController],
    }).compile();

    controller = module.get<ProfileTelosController>(ProfileTelosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
