import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpClient,
  HttpClientModule,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { LearningInterceptor } from './learning.interceptor';

describe('LearningInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, HttpClientModule],
      providers: [
        provideHttpClient(withInterceptors([LearningInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // The registered scope is lowercase 'learning'. A stray capital here matches
  // no app scope in default-permissions.json and silently strips authorization.
  it('sends the registered lowercase learning app scope', fakeAsync(() => {
    httpClient.get('/api/data').subscribe();

    const testReq = httpMock.expectOne('/api/data');
    expect(testReq.request.headers.get('X-ot-appscope')).toBe('learning');
    expect(testReq.request.headers.get('X-ot-session-mode')).toBe('cookie');
    expect(testReq.request.withCredentials).toBe(true);
    testReq.flush({});
    tick();
  }));
});
