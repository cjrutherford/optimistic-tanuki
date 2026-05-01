import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ChatService } from './chat.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatService, { provide: API_BASE_URL, useValue: '/api' }],
    });

    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('gets or creates a direct chat through the HTTP chat API', async () => {
    const promise = service.getOrCreateDirectChat(['buyer-1', 'seller-1']);

    const request = httpMock.expectOne(
      '/api/chat/conversations/direct/get-or-create'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      participantIds: ['buyer-1', 'seller-1'],
    });

    request.flush({
      id: 'conversation-1',
      title: 'Buyer and Seller',
      type: 'direct',
      participants: ['buyer-1', 'seller-1'],
      isDeleted: false,
      createdAt: '2026-04-29T12:00:00.000Z',
      updatedAt: '2026-04-29T12:00:00.000Z',
    });

    await expect(promise).resolves.toMatchObject({
      id: 'conversation-1',
      participants: ['buyer-1', 'seller-1'],
    });
  });

  it('fetches messages through the HTTP chat API', async () => {
    const promise = service.getMessages('conversation-1');

    const request = httpMock.expectOne('/api/chat/messages/conversation-1');
    expect(request.request.method).toBe('GET');

    request.flush([
      {
        id: 'message-1',
        conversationId: 'conversation-1',
        senderId: 'seller-1',
        content: 'Still available.',
        type: 'chat',
        recipients: ['buyer-1'],
        createdAt: '2026-04-29T12:05:00.000Z',
      },
    ]);

    await expect(promise).resolves.toEqual([
      expect.objectContaining({
        id: 'message-1',
        conversationId: 'conversation-1',
        recipients: ['buyer-1'],
      }),
    ]);
  });

  it('posts a message through the HTTP chat API', async () => {
    const promise = service.sendMessage({
      conversationId: 'conversation-1',
      content: 'Interested in this listing.',
      senderId: 'buyer-1',
      recipientIds: ['seller-1'],
      type: 'system',
    });

    const request = httpMock.expectOne('/api/chat/messages');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      conversationId: 'conversation-1',
      content: 'Interested in this listing.',
      senderId: 'buyer-1',
      recipientIds: ['seller-1'],
      type: 'system',
    });

    request.flush({
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'buyer-1',
      content: 'Interested in this listing.',
      type: 'system',
      recipients: ['seller-1'],
      createdAt: '2026-04-29T12:00:00.000Z',
    });

    await expect(promise).resolves.toMatchObject({
      id: 'message-1',
      conversationId: 'conversation-1',
      recipients: ['seller-1'],
    });
  });
});

  it('gets or creates a direct chat through the HTTP chat API', async () => {
    const promise = service.getOrCreateDirectChat(['buyer-1', 'seller-1']);

    const request = httpMock.expectOne(
      '/api/chat/conversations/direct/get-or-create'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      participantIds: ['buyer-1', 'seller-1'],
    });

    request.flush({
      id: 'conversation-1',
      title: 'Buyer and Seller',
      type: 'direct',
      participants: ['buyer-1', 'seller-1'],
      isDeleted: false,
      createdAt: '2026-04-29T12:00:00.000Z',
      updatedAt: '2026-04-29T12:00:00.000Z',
    });

    await expect(promise).resolves.toMatchObject({
      id: 'conversation-1',
      participants: ['buyer-1', 'seller-1'],
    });
  });

  it('fetches messages through the HTTP chat API', async () => {
    const promise = service.getMessages('conversation-1');

    const request = httpMock.expectOne('/api/chat/messages/conversation-1');
    expect(request.request.method).toBe('GET');

    request.flush([
      {
        id: 'message-1',
        conversationId: 'conversation-1',
        senderId: 'seller-1',
        content: 'Still available.',
        type: 'chat',
        recipients: ['buyer-1'],
        createdAt: '2026-04-29T12:05:00.000Z',
      },
    ]);

    await expect(promise).resolves.toEqual([
      expect.objectContaining({
        id: 'message-1',
        conversationId: 'conversation-1',
        recipients: ['buyer-1'],
      }),
    ]);
  });

  it('posts a message through the HTTP chat API', async () => {
    const promise = service.sendMessage({
      conversationId: 'conversation-1',
      content: 'Interested in this listing.',
      senderId: 'buyer-1',
      recipientIds: ['seller-1'],
      type: 'system',
    });

    const request = httpMock.expectOne('/api/chat/messages');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      conversationId: 'conversation-1',
      content: 'Interested in this listing.',
      senderId: 'buyer-1',
      recipientIds: ['seller-1'],
      type: 'system',
    });

    request.flush({
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'buyer-1',
      content: 'Interested in this listing.',
      type: 'system',
      recipients: ['seller-1'],
      createdAt: '2026-04-29T12:00:00.000Z',
    });

    await expect(promise).resolves.toMatchObject({
      id: 'message-1',
      conversationId: 'conversation-1',
      recipients: ['seller-1'],
    });
  });
});
