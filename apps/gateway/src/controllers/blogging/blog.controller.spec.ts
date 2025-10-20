import { Test, TestingModule } from '@nestjs/testing';
import { BlogController } from './blog.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { Logger } from '@nestjs/common';

describe('BlogController', () => {
  let controller: BlogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlogController],
      providers: [
        {
          provide: ServiceTokens.BLOG_SERVICE,
          useValue: {
            send: jest.fn(),
            connect: jest.fn().mockResolvedValue(null),
            close: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BlogController>(BlogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
