import { Test, TestingModule } from '@nestjs/testing';
import { AssetController } from './asset.controller';
import { of } from 'rxjs';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

describe('AssetController', () => {
  let controller: AssetController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ServiceTokens.AUTHENTICATION_SERVICE, useValue: { send: jest.fn().mockResolvedValue(of({})) } },
        { provide: ServiceTokens.ASSETS_SERVICE, useValue: { send: jest.fn().mockResolvedValue(of({})) } },
        { provide: ServiceTokens.PERMISSIONS_SERVICE, useValue: { send: jest.fn().mockResolvedValue(of({})) } },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        Logger
      ],
      controllers: [AssetController],
    }).compile();

    controller = module.get<AssetController>(AssetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
