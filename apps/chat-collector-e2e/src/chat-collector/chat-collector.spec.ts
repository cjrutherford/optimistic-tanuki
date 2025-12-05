import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ChatCommands } from '@optimistic-tanuki/constants';

describe('Chat Collector Microservice E2E Tests', () => {
  let client: ClientProxy;

  beforeAll(async () => {
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: '127.0.0.1',
        port: 3007,
      },
    });
    try {
      await client.connect();
    } catch (err) {
      console.warn('Could not connect to chat-collector service.', err);
    }
  });

  afterAll(async () => {
    await client.close();
  });

  it('should post a message', async () => {
    const messageData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      conversationId: '123e4567-e89b-12d3-a456-426614174001',
      senderName: 'Test Sender',
      senderId: 'test-sender-id',
      recipientId: ['test-recipient-id'],
      recipientName: ['Test Recipient'],
      content: 'Hello E2E',
      timestamp: new Date(),
      type: 'chat',
    };

    try {
      const result = await firstValueFrom(
        client.send({ cmd: ChatCommands.POST_MESSAGE }, messageData)
      );
      expect(result).toBeDefined();
    } catch (error) {
      console.error('Error posting message:', error);
      throw error;
    }
  });
});
