import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LeadsApiService } from './leads-api.service';
import { LeadSource, LeadStatus } from './leads.types';

describe('LeadsApiService', () => {
  let service: LeadsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(LeadsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches leads from the gateway API', () => {
    const leads = [
      {
        id: 'lead-1',
        name: 'Test Lead',
        source: LeadSource.REMOTE_OK,
        status: LeadStatus.NEW,
        value: 1000,
        notes: '',
        isAutoDiscovered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isFlagged: false,
      },
    ];

    service.getLeads().subscribe((result) => {
      expect(result).toEqual(leads);
    });

    const req = httpMock.expectOne('/api/leads');
    expect(req.request.method).toBe('GET');
    req.flush(leads);
  });

  it('patches lead updates through the gateway API', () => {
    service
      .updateLead('lead-1', { status: LeadStatus.CONTACTED })
      .subscribe((result) => {
        expect(result.status).toBe(LeadStatus.CONTACTED);
      });

    const req = httpMock.expectOne('/api/leads/lead-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: LeadStatus.CONTACTED });
    req.flush({
      id: 'lead-1',
      name: 'Updated Lead',
      source: LeadSource.REMOTE_OK,
      status: LeadStatus.CONTACTED,
      value: 1500,
      notes: 'Updated',
      isAutoDiscovered: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isFlagged: false,
    });
  });
});
