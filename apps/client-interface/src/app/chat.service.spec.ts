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
});
