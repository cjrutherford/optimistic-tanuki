import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { EmailAuthClientService } from './email-auth.service';

describe('EmailAuthClientService', () => {
  let service: EmailAuthClientService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EmailAuthClientService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(EmailAuthClientService);
    http = TestBed.inject(HttpTestingController);
  });

  it('sends the canonical app id when requesting a magic link', () => {
    service
      .request('video-platform', 'person@example.com', 'magic-link', '/channel')
      .subscribe();
    const request = http.expectOne('/api/authentication/email-action/request');
    expect(request.request.headers.get('x-ot-app-id')).toBe('video-platform');
    expect(request.request.body).toEqual({
      email: 'person@example.com',
      purpose: 'magic-link',
      returnPath: '/channel',
    });
    request.flush({ accepted: true });
  });
});
