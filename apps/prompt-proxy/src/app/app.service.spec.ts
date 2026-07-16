import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

describe('AppService', () => {
  let service: AppService;
  let httpService: HttpService;
  let logger: Logger;
  const ORIGINAL_ENV = process.env;

  beforeEach(async () => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.PROMPT_PROXY_TIMEOUT_MS;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: 'API_BASE_URL',
          useValue: 'http://localhost:11434',
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            debug: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
            verbose: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    httpService = module.get<HttpService>(HttpService);
    logger = module.get<Logger>(Logger);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  describe('sendMessage', () => {
    const mockGeneratePrompt = {
      model: 'test-model',
      stream: false,
      messages: [],
    };

    it('should send a POST request with the default timeout and return data', async () => {
      const mockResponse = { data: { message: 'AI response' } };
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

      const result = await service.sendMessage(mockGeneratePrompt);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        mockGeneratePrompt,
        { timeout: 120000 }
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should use PROMPT_PROXY_TIMEOUT_MS when set', async () => {
      process.env.PROMPT_PROXY_TIMEOUT_MS = '5000';
      const mockResponse = { data: { message: 'AI response' } };
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

      await service.sendMessage(mockGeneratePrompt);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        mockGeneratePrompt,
        { timeout: 5000 }
      );
    });

    it('should fall back to the default timeout for an invalid env value', async () => {
      process.env.PROMPT_PROXY_TIMEOUT_MS = 'not-a-number';
      const mockResponse = { data: { message: 'AI response' } };
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

      await service.sendMessage(mockGeneratePrompt);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        mockGeneratePrompt,
        { timeout: 120000 }
      );
    });

    it('should log a structured usage line on success', async () => {
      const mockResponse = {
        data: {
          message: 'AI response',
          model: 'gemma3',
          prompt_eval_count: 42,
          eval_count: 17,
          total_duration: 2_500_000_000,
        },
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

      await service.sendMessage(mockGeneratePrompt);

      expect(logger.log).toHaveBeenCalledWith(
        'LLM usage model=gemma3 promptTokens=42 completionTokens=17 durationMs=2500'
      );
    });

    it('should default usage fields to 0 when missing', async () => {
      const mockResponse = { data: {} };
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

      await service.sendMessage(mockGeneratePrompt);

      expect(logger.log).toHaveBeenCalledWith(
        'LLM usage model=unknown promptTokens=0 completionTokens=0 durationMs=0'
      );
    });

    it('should throw RpcException on HTTP error', async () => {
      const errorMessage = 'Network error';
      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(throwError(() => new Error(errorMessage)));

      await expect(service.sendMessage(mockGeneratePrompt)).rejects.toThrow(
        RpcException
      );
      await expect(service.sendMessage(mockGeneratePrompt)).rejects.toThrow(
        errorMessage
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
