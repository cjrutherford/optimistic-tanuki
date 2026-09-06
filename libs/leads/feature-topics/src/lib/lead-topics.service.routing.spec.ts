import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LeadTopicsService } from './lead-topics.service';

/**
 * The spec beside this one covers the narrow toggle payload. These pin the
 * remaining topic endpoints — whose only real behaviour is the verb and URL
 * they resolve to — as one table.
 */
describe('LeadTopicsService endpoint routing', () => {
  let service: LeadTopicsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LeadTopicsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each<[string, () => void, string, string]>([
    [
      'the topic list',
      () => service.getTopics().subscribe(),
      'GET',
      '/api/leads/topics',
    ],
    [
      'a discovery status check',
      () => service.getTopicDiscoveryStatus('topic-1').subscribe(),
      'GET',
      '/api/leads/topics/topic-1/discovery-status',
    ],
    [
      'a topic deletion',
      () => service.deleteTopic('topic-1').subscribe(),
      'DELETE',
      '/api/leads/topics/topic-1',
    ],
  ])('routes %s', (_case, call, method, url) => {
    call();

    const request = http.expectOne(url);
    expect(request.request.method).toBe(method);
    request.flush({});
  });

  it('posts the create payload unchanged', () => {
    const dto = { name: 'Robotics', enabled: true };

    service.createTopic(dto as never).subscribe();

    const request = http.expectOne('/api/leads/topics');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(dto);
    request.flush({});
  });

  it('kicks off discovery with an empty body', () => {
    service.runTopicDiscovery('topic-1').subscribe();

    const request = http.expectOne('/api/leads/topics/topic-1/discover');
    expect(request.request.method).toBe('POST');
    // Discovery takes no arguments — the topic is identified by the path.
    expect(request.request.body).toEqual({});
    request.flush({});
  });
});
