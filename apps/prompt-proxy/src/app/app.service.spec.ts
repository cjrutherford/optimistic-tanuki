import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

describe('AppService', () => {
  let service: AppService;
  let httpService: HttpService;

  beforeEach(async () => {
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
          },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    httpService = module.get<HttpService>(HttpService);
  });

  describe('sendMessage', () => {
    const mockGeneratePrompt = {
      model: 'test-model',
      stream: false,
      messages: [],
    };

    it('should send a POST request and return data', async () => {
      const mockResponse = { data: { message: 'AI response' } };
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

      const result = await service.sendMessage(mockGeneratePrompt);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        mockGeneratePrompt,
        { timeout: 3600000 }
      );
      expect(result).toEqual(mockResponse.data);
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
    });
  });
});
