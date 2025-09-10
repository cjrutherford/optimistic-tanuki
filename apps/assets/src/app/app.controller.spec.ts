import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetCommands } from '@optimistic-tanuki/constants';
import { AssetHandle, CreateAssetDto } from '@optimistic-tanuki/models';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            createAsset: jest.fn(),
            removeAsset: jest.fn(),
            retrieveAsset: jest.fn(),
            readAsset: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = moduleRef.get<AppController>(AppController);
    appService = moduleRef.get<AppService>(AppService);
  });

  describe('createAsset', () => {
    it('should call appService.createAsset with the correct data', async () => {
      const dto: CreateAssetDto = { name: 'test', type: 'image' } as any;
      const result = { id: '1', ...dto };
      (appService.createAsset as jest.Mock).mockResolvedValue(result);

      const response = await appController.createAsset(dto);

      expect(appService.createAsset).toHaveBeenCalledWith(dto);
      expect(response).toEqual(result);
    });
  });

  describe('removeAsset', () => {
    it('should call appService.removeAsset with the correct data', async () => {
      const handle: AssetHandle = { id: '1' } as any;
      const result = { success: true };
      (appService.removeAsset as jest.Mock).mockResolvedValue(result);

      const response = await appController.removeAsset(handle);

      expect(appService.removeAsset).toHaveBeenCalledWith(handle);
      expect(response).toEqual(result);
    });
  });

  describe('retrieveAsset', () => {
    it('should call appService.retrieveAsset with the correct data', async () => {
      const handle: AssetHandle = { id: '1' } as any;
      const result = { id: '1', name: 'test', type: 'image' };
      (appService.retrieveAsset as jest.Mock).mockResolvedValue(result);

      const response = await appController.retrieveAsset(handle);

      expect(appService.retrieveAsset).toHaveBeenCalledWith(handle);
      expect(response).toEqual(result);
    });
  });

    describe('readAsset', () => {
    it('should call appService.readAsset with the correct data', async () => {
      const handle: AssetHandle = { id: '1' } as any;
      const result = 'base64encodedstring';
      (appService.readAsset as jest.Mock).mockResolvedValue(result);

      const response = await appController.readAsset(handle);

      expect(appService.readAsset).toHaveBeenCalledWith(handle);
      expect(response).toEqual(result);
    });
  });
});
