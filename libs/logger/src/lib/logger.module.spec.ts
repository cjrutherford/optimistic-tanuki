import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from './logger.module';

describe('LoggerModule', () => {
  it('provides and exports a NestJS Logger instance', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule],
    }).compile();

    const logger = module.get<Logger>(Logger);

    expect(logger).toBeDefined();
    expect(logger).toBeInstanceOf(Logger);
  });
});
