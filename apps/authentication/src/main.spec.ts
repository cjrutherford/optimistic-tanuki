import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { bootstrap } from './main';

describe('bootstrap', () => {
  let appMock: any;
  let createMicroserviceSpy: jest.SpyInstance;
  let listenSpy: jest.SpyInstance;

  beforeEach(() => {
    appMock = {
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      get: jest.fn((token) => {
        if (token === ConfigService) {
          return {
            get: jest.fn((key) => {
              if (key === 'listenPort') return 3001;
              return undefined;
            }),
          };
        }
        return undefined;
      }),
    };

    jest.spyOn(NestFactory, 'create').mockResolvedValue(appMock);
    createMicroserviceSpy = jest.spyOn(NestFactory, 'createMicroservice').mockResolvedValue(appMock);
    listenSpy = jest.spyOn(appMock, 'listen');
    jest.spyOn(Logger, 'log').mockImplementation(() => {}); // Mock Logger.log
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should bootstrap the application and start listening', async () => {
    await bootstrap();
    expect(createMicroserviceSpy).toHaveBeenCalled();
    expect(listenSpy).toHaveBeenCalled();
  });
});