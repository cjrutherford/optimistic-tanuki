import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { bootstrap } from './main';

describe('bootstrap', () => {
  let appMock: any;
  let createSpy: jest.SpyInstance;
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

    createSpy = jest.spyOn(NestFactory, 'create').mockResolvedValue(appMock);
    createMicroserviceSpy = jest
      .spyOn(NestFactory, 'createMicroservice')
      .mockResolvedValue(appMock);
    listenSpy = jest.spyOn(appMock, 'listen');
    jest.spyOn(Logger, 'log').mockImplementation((...args) => {
      console.log(...args); // Mock Logger.log to console.log for visibility in tests
    }); // Mock Logger.log
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not auto-bootstrap when the module is imported', async () => {
    expect(createSpy).not.toHaveBeenCalled();
    expect(createMicroserviceSpy).not.toHaveBeenCalled();
  });

  it('should bootstrap the application and start listening', async () => {
    await bootstrap();
    expect(createMicroserviceSpy).toHaveBeenCalled();
    expect(listenSpy).toHaveBeenCalled();
  });

  it('defaults the bootstrap HTTP listener to loopback', async () => {
    const originalHost = process.env.BOOTSTRAP_HTTP_HOST;
    delete process.env.BOOTSTRAP_HTTP_HOST;

    try {
      await bootstrap();
      expect(listenSpy.mock.calls[0]).toEqual([3099, '127.0.0.1']);
    } finally {
      if (originalHost === undefined) {
        delete process.env.BOOTSTRAP_HTTP_HOST;
      } else {
        process.env.BOOTSTRAP_HTTP_HOST = originalHost;
      }
    }
  });

  it('binds the bootstrap HTTP listener to an explicitly configured host', async () => {
    const originalHost = process.env.BOOTSTRAP_HTTP_HOST;
    process.env.BOOTSTRAP_HTTP_HOST = '10.0.0.8';

    try {
      await bootstrap();
      expect(listenSpy.mock.calls[0]).toEqual([3099, '10.0.0.8']);
    } finally {
      if (originalHost === undefined) {
        delete process.env.BOOTSTRAP_HTTP_HOST;
      } else {
        process.env.BOOTSTRAP_HTTP_HOST = originalHost;
      }
    }
  });
});
