import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LeadTopicsService } from './lead-topics.service';
import {
  LeadDiscoverySource,
  LeadTopicDiscoveryIntent,
} from './leads.types';

describe('LeadTopicsService', () => {
  let service: LeadTopicsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(LeadTopicsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('toggles a topic with a narrow PATCH payload', () => {
    service
      .toggleTopic({
        id: 'topic-1',
        name: 'Cloud',
        description: 'Cloud work',
        keywords: ['aws'],
        excludedTerms: [],
        discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
        sources: [LeadDiscoverySource.REMOTE_OK],
        enabled: true,
        leadCount: 0,
      })
      .subscribe((result) => {
        expect(result.enabled).toBe(false);
      });

    const req = httpMock.expectOne('/api/leads/topics/topic-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ enabled: false });
    req.flush({
      id: 'topic-1',
      name: 'Cloud',
      enabled: false,
    });
  });
});
