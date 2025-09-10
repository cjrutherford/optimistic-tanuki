import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PromptCommands } from '@optimistic-tanuki/constants';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
    appService = module.get<AppService>(AppService);
  });

  describe('sendMessage', () => {
    it('should call appService.sendMessage with the provided data', async () => {
      const testData = { model: 'test-model', stream: false, messages: [] };
      await appController.sendMessage(testData);
      expect(appService.sendMessage).toHaveBeenCalledWith(testData);
    });

    it('should return the result from appService.sendMessage', async () => {
      const testData = { model: 'test-model', stream: false, messages: [] };
      const expectedResult = { message: 'AI response' };
      jest.spyOn(appService, 'sendMessage').mockResolvedValue(expectedResult);

      const result = await appController.sendMessage(testData);
      expect(result).toEqual(expectedResult);
    });
  });
});
