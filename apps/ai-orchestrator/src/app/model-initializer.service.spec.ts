import { Test, TestingModule } from '@nestjs/testing';
import { ModelInitializerService } from './model-initializer.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('ModelInitializerService', () => {
  let service: ModelInitializerService;
  let configService: ConfigService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelInitializerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ollama') {
                return { host: 'localhost', port: 11434 };
              }
              if (key === 'models') {
                return {
                  workflow_control: {
                    name: 'qwen2.5:3b',
                    temperature: 0.3,
                    pullOnStartup: true,
                  },
                  tool_calling: {
                    name: 'bjoernb/deepseek-r1-8b',
                    temperature: 0.5,
                    pullOnStartup: true,
                  },
                  conversational: {
                    name: 'bjoernb/deepseek-r1-8b',
                    temperature: 0.7,
                    pullOnStartup: false,
                  },
                };
              }
              return null;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ModelInitializerService>(ModelInitializerService);
    configService = module.get<ConfigService>(ConfigService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getModelConfig', () => {
    it('should return workflow control model config', () => {
      const config = service.getModelConfig('workflow_control');
      expect(config).toEqual({
        name: 'qwen2.5:3b',
        temperature: 0.3,
      });
    });

    it('should return tool calling model config', () => {
      const config = service.getModelConfig('tool_calling');
      expect(config).toEqual({
        name: 'bjoernb/deepseek-r1-8b',
        temperature: 0.5,
      });
    });

    it('should return conversational model config', () => {
      const config = service.getModelConfig('conversational');
      expect(config).toEqual({
        name: 'bjoernb/deepseek-r1-8b',
        temperature: 0.7,
      });
    });

    it('should return null for missing config', () => {
      const newService = new ModelInitializerService(
        {
          get: jest.fn(() => null),
        } as any,
        httpService
      );
      const config = newService.getModelConfig('workflow_control');
      expect(config).toBeNull();
    });
  });

  describe('getAllModelConfigs', () => {
    it('should return all model configs', () => {
      const configs = service.getAllModelConfigs();
      expect(configs).toEqual({
        workflow_control: {
          name: 'qwen2.5:3b',
          temperature: 0.3,
          pullOnStartup: true,
        },
        tool_calling: {
          name: 'bjoernb/deepseek-r1-8b',
          temperature: 0.5,
          pullOnStartup: true,
        },
        conversational: {
          name: 'bjoernb/deepseek-r1-8b',
          temperature: 0.7,
          pullOnStartup: false,
        },
      });
    });
  });

  describe('initializeModels', () => {
    it('should skip initialization when no models configured', async () => {
      const newService = new ModelInitializerService(
        {
          get: jest.fn(() => null),
        } as any,
        httpService
      );

      await newService.initializeModels();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should check if model exists before pulling', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: {
            models: [{ name: 'qwen2.5:3b' }, { name: 'bjoernb/deepseek-r1-8b' }],
          },
          status: 200,
        } as any)
      );

      await service.initializeModels();
      expect(httpService.get).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        { timeout: 10000 }
      );
      // Should not pull since models already exist
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should pull models that do not exist', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: { models: [] },
          status: 200,
        } as any)
      );

      jest.spyOn(httpService, 'post').mockReturnValue(
        of({
          status: 200,
        } as any)
      );

      await service.initializeModels();

      // Should pull workflow_control and tool_calling (pullOnStartup: true)
      expect(httpService.post).toHaveBeenCalledTimes(2);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/pull',
        { name: 'qwen2.5:3b' },
        expect.any(Object)
      );
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/pull',
        { name: 'bjoernb/deepseek-r1-8b' },
        expect.any(Object)
      );
    });

    it('should handle errors gracefully during model pulling', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: { models: [] },
          status: 200,
        } as any)
      );

      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(throwError(() => new Error('Network error')));

      // Should not throw
      await expect(service.initializeModels()).resolves.not.toThrow();
    });
  });
});
