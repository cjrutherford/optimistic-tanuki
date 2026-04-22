import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LeadFlagReason } from '@optimistic-tanuki/leads-contracts';

import { LeadFlagsService } from './lead-flags.service';

describe('LeadFlagsService', () => {
  let service: LeadFlagsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(LeadFlagsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('creates a flag through the gateway API', () => {
    const flag = {
      id: 'flag-1',
      leadId: 'lead-1',
      reasons: [LeadFlagReason.SPAM],
      notes: 'Not a fit',
      createdAt: new Date(),
    };

    service
      .flagLead('lead-1', {
        reasons: [LeadFlagReason.SPAM],
        notes: 'Not a fit',
      })
      .subscribe((result) => {
        expect(result).toEqual(flag);
      });

    const req = httpMock.expectOne('/api/leads/lead-1/flags');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      reasons: [LeadFlagReason.SPAM],
      notes: 'Not a fit',
    });
    req.flush(flag);
  });
});
