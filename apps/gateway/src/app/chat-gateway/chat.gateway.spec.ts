import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { LoggerModule } from '@optimistic-tanuki/logger'

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        ChatGateway,
        { provide: 'CHAT_COLLECTOR_SERVICE', useValue: { send: jest.fn() } },
        { provide: 'AI_ORCHESTRATION_SERVICE', useValue: { send: jest.fn() } },
        { provide: 'TELOS_DOCS_SERVICE', useValue: { send: jest.fn() } },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
