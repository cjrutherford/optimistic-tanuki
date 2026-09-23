import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ChatMessageDto,
  MessageType,
  PostMessageDto,
  SendMessageDto,
} from './chat-message';

const validMessage = {
  conversationId: 'conv-1',
  senderId: 'profile-1',
  content: 'Hello',
  recipientIds: ['profile-2'],
  type: MessageType.CHAT,
};

describe('MessageType', () => {
  it('keeps the four legacy values so existing rows still validate', () => {
    expect(Object.values(MessageType).sort()).toEqual(
      ['chat', 'info', 'warning', 'system'].sort()
    );
  });
});

describe('ChatMessageDto', () => {
  it('accepts a complete payload', async () => {
    const dto = plainToInstance(ChatMessageDto, {
      ...validMessage,
      isEdited: false,
      createdAt: '2026-09-17T00:00:00.000Z',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.createdAt).toBeInstanceOf(Date);
  });

  it('accepts a minimal payload', async () => {
    const dto = plainToInstance(ChatMessageDto, validMessage);
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects missing required fields', async () => {
    const dto = plainToInstance(ChatMessageDto, {
      conversationId: 'conv-1',
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property).sort()).toEqual(
      ['senderId', 'content', 'recipientIds', 'type'].sort()
    );
  });

  it('rejects an unknown message type', async () => {
    const dto = plainToInstance(ChatMessageDto, {
      ...validMessage,
      type: 'shout',
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toEqual(['type']);
  });
});

describe('PostMessageDto', () => {
  it('validates like ChatMessageDto', async () => {
    const dto = plainToInstance(PostMessageDto, validMessage);
    expect(await validate(dto)).toEqual([]);
  });
});

describe('SendMessageDto', () => {
  it('accepts the gateway body shape (no sender)', async () => {
    const dto = plainToInstance(SendMessageDto, {
      conversationId: 'conv-1',
      content: 'Hello',
      recipientIds: ['profile-2'],
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a missing recipient list', async () => {
    const dto = plainToInstance(SendMessageDto, {
      conversationId: 'conv-1',
      content: 'Hello',
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toEqual(['recipientIds']);
  });
});
