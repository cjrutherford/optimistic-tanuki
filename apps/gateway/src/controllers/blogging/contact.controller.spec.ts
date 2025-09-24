import { Test, TestingModule } from '@nestjs/testing';
import { ContactController } from './contact.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { Logger } from '@nestjs/common';

describe('ContactController', () => {
  let controller: ContactController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
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

    controller = module.get<ContactController>(ContactController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
