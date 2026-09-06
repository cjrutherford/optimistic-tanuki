import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ChatService } from './chat.service';

describe('ClientInterface ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatService],
    });

    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches messages with no-cache headers and a cache-busting query param', async () => {
    const promise = service.getMessages('conversation-1');

    const request = httpMock.expectOne(
      (req) =>
        req.url === '/api/chat/messages/conversation-1' &&
        req.params.has('_ts') &&
        req.headers.get('Cache-Control') === 'no-cache' &&
        req.headers.get('Pragma') === 'no-cache'
    );
    expect(request.request.method).toBe('GET');

    request.flush([
      {
        id: 'message-1',
        conversationId: 'conversation-1',
        senderId: 'sender-1',
        content: 'hello',
        type: 'chat',
        recipients: ['recipient-1'],
        createdAt: '2026-07-05T19:10:00.000Z',
      },
    ]);

    await expect(promise).resolves.toEqual([
      expect.objectContaining({
        id: 'message-1',
        conversationId: 'conversation-1',
      }),
    ]);
  });

  it('sends a chat message to the messages endpoint', async () => {
    const promise = service.sendMessage({
      conversationId: 'room-1',
      content: 'hello',
      senderId: 'profile-1',
      recipientIds: ['profile-2'],
    });

    const request = httpMock.expectOne('/api/chat/messages');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      conversationId: 'room-1',
      content: 'hello',
      senderId: 'profile-1',
      recipientIds: ['profile-2'],
    });

    request.flush({
      id: 'message-1',
      conversationId: 'room-1',
      senderId: 'profile-1',
      content: 'hello',
      type: 'chat',
      recipients: ['profile-2'],
      createdAt: '2026-07-05T19:12:00.000Z',
    });

    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        id: 'message-1',
        conversationId: 'room-1',
      })
    );
  });

  it('sends only the recipient profile when starting a direct conversation', async () => {
    const promise = service.getOrCreateDirectChat('profile-2');

    const request = httpMock.expectOne(
      '/api/chat/conversations/direct/get-or-create'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ recipientProfileId: 'profile-2' });
    request.flush({
      id: 'conversation-1',
      participants: ['profile-1', 'profile-2'],
    });

    await expect(promise).resolves.toEqual(
      expect.objectContaining({ id: 'conversation-1' })
    );
  });

  it('lists conversations for a profile', async () => {
    const promise = service.getConversations('profile-1');

    const request = httpMock.expectOne(
      '/api/chat/conversations/find?profileId=profile-1'
    );
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 'conversation-1' }]);

    await expect(promise).resolves.toEqual([{ id: 'conversation-1' }]);
  });

  it('reads a single conversation by id', async () => {
    const promise = service.getConversation('conversation-1');

    const request = httpMock.expectOne(
      '/api/chat/conversations/id/conversation-1'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ id: 'conversation-1' });

    await expect(promise).resolves.toEqual({ id: 'conversation-1' });
  });

  it('creates a direct chat through the get-or-create endpoint', async () => {
    const promise = service.createDirectChat({
      recipientProfileId: 'profile-2',
    });

    const request = httpMock.expectOne(
      '/api/chat/conversations/direct/get-or-create'
    );
    expect(request.request.body).toEqual({ recipientProfileId: 'profile-2' });
    request.flush({ id: 'conversation-1' });

    await expect(promise).resolves.toEqual({ id: 'conversation-1' });
  });

  it('starts a direct chat through the get-or-create endpoint', async () => {
    const promise = service.startDirectChat('profile-2');

    const request = httpMock.expectOne(
      '/api/chat/conversations/direct/get-or-create'
    );
    request.flush({ id: 'conversation-1' });

    await expect(promise).resolves.toEqual({ id: 'conversation-1' });
  });

  it('creates a community chat', async () => {
    const promise = service.createCommunityChat({
      communityId: 'c1',
      name: 'General',
    });

    const request = httpMock.expectOne('/api/chat/conversations/community');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      communityId: 'c1',
      name: 'General',
    });
    request.flush({ id: 'conversation-1' });

    await expect(promise).resolves.toEqual({ id: 'conversation-1' });
  });

  it('deletes a conversation', async () => {
    const promise = service.deleteConversation('conversation-1');

    const request = httpMock.expectOne(
      '/api/chat/conversations/conversation-1'
    );
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    await expect(promise).resolves.toBeNull();
  });
});
