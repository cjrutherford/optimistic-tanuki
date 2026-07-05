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
});
