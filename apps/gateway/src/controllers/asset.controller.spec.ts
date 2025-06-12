import { Test, TestingModule } from '@nestjs/testing';
import { AssetController } from './asset.controller';
import { of } from 'rxjs';
import { ServiceTokens } from '@optimistic-tanuki/constants';

describe('AssetController', () => {
  let controller: AssetController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ServiceTokens.ASSETS_SERVICE, useValue: { send: jest.fn().mockResolvedValue(of({})) } },
      ],
      controllers: [AssetController],
    }).compile();

    controller = module.get<AssetController>(AssetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
