import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { StatusComponent } from './status.component';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { FieldFlowSyncService } from '../../services/field-flow-sync.service';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

const serverJob = {
  id: 'status-server-1',
  bookingId: 'booking-server-1',
  trackingCode: 'TRACK-SERVER-1',
  status: 'in_progress',
  customerName: 'Server Customer',
  customerPhone: '+1 912 555 0144',
  serviceName: 'Standard Care',
  serviceAddress: '412 Bull Street, Savannah, GA 31401',
  scheduledDate: '2026-10-01',
  arrivalWindow: '8:00 AM - 10:00 AM',
  depositPaid: true,
  depositAmount: 0,
  totalAmount: 100,
  notes: 'Server note',
  reviewPromptEligible: false,
  googleReviewUrl: 'https://example.com/review/server-1',
  updatedAt: '2026-09-24T12:00:00.000Z',
};

describe('StatusComponent', () => {
  let component: StatusComponent;
  let fixture: ComponentFixture<StatusComponent>;
  let httpMock: HttpTestingController;
  let syncService: FieldFlowSyncService;
  let routeId: string | null;

  beforeEach(async () => {
    routeId = 'job-42';
    await TestBed.configureTestingModule({
      imports: [StatusComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FieldFlowApiService,
        FieldFlowSyncService,
        BrandConfigService,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => routeId,
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    syncService = TestBed.inject(FieldFlowSyncService);
    syncService.isOnline.set(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const loadSuccessfulJob = (job: typeof serverJob = serverJob): void => {
    fixture.detectChanges();
    httpMock.expectOne('/api/v1/flow/status/job-42').flush(job);
    fixture.detectChanges();
  };

  it('shows loading and loads only the route id', () => {
    fixture.detectChanges();

    expect(component.jobId).toBe('job-42');
    expect(fixture.nativeElement.textContent).toContain('Loading job status');
    const request = httpMock.expectOne('/api/v1/flow/status/job-42');
    expect(request.request.method).toBe('GET');
    request.flush(serverJob);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Server Customer');
    expect(fixture.nativeElement.textContent).not.toContain('Marcus Bennett');
  });

  it('renders dispatch steps from the server job', () => {
    loadSuccessfulJob();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Scheduled');
    expect(element.textContent).toContain('En Route');
    expect(element.textContent).toContain('Work in Progress');
    expect(element.textContent).toContain('Completed');
  });

  it('renders the review prompt only when the server marks the completed job eligible', () => {
    loadSuccessfulJob({
      ...serverJob,
      status: 'completed',
      reviewPromptEligible: true,
    });

    expect(fixture.nativeElement.textContent).toContain(
      'Leave a Google review'
    );
  });

  it('does not render the review prompt when the server marks it ineligible', () => {
    loadSuccessfulJob({
      ...serverJob,
      status: 'completed',
      reviewPromptEligible: false,
    });

    expect(fixture.nativeElement.textContent).not.toContain(
      'Leave a Google review'
    );
  });

  it('renders an error and leaves the job empty when status loading fails', () => {
    fixture.detectChanges();
    const request = httpMock.expectOne('/api/v1/flow/status/job-42');
    request.flush('unavailable', {
      status: 503,
      statusText: 'Unavailable',
    });
    fixture.detectChanges();

    expect(component.job).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Unable to load job status'
    );
  });

  it('renders an empty state without loading a fallback job when the route has no id', () => {
    routeId = null;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No job status found');
    expect(component.job).toBeNull();
    httpMock.expectNone('/api/v1/flow/status/demo-job');
  });

  it('does not expose local authoritative status controls', () => {
    loadSuccessfulJob();

    expect(fixture.nativeElement.textContent).not.toContain('Advance status');
  });

  it('allows saving technician notes without changing status', () => {
    loadSuccessfulJob();
    syncService.isOnline.set(false);
    component.technicianInputNotes = 'Surface sealed with ceramic coat.';

    component.saveTechnicianNotes();

    expect(component.job?.status).toBe('in_progress');
    expect(component.job?.technicianNotes).toBe(
      'Surface sealed with ceramic coat.'
    );
  });

  it('never uses slice or whitebox in client copy', () => {
    loadSuccessfulJob();

    const text = fixture.nativeElement.textContent?.toLowerCase() || '';
    expect(text).not.toContain('slice');
    expect(text).not.toContain('whitebox');
  });
});
