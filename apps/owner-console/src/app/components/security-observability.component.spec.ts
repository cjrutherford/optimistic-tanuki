import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SecurityObservabilityComponent } from './security-observability.component';
import { SecurityObservabilityService } from '../services/security-observability.service';

describe('SecurityObservabilityComponent', () => {
  let fixture: ComponentFixture<SecurityObservabilityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityObservabilityComponent],
      providers: [
        {
          provide: SecurityObservabilityService,
          useValue: {
            events: () =>
              of({
                events: [
                  {
                    timestamp: '2026-07-24T12:00:00.000Z',
                    host: 'optimistic-tanuki.com',
                    path: '/wp-login.php',
                    method: 'GET',
                    status: 404,
                    classification: 'unsupported_url',
                    clientAddress: '203.0.113.*',
                  },
                ],
              }),
            metrics: () =>
              of({
                totals: {
                  requests: 12,
                  denied: 2,
                  rateLimited: 1,
                  blocked: 0,
                  errors: 0,
                  serverErrors: 1,
                },
                series: [],
                topPaths: [],
                topHosts: [],
              }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SecurityObservabilityComponent);
    fixture.detectChanges();
  });

  it('shows unsupported URL activity without exposing a full client address', () => {
    expect(fixture.nativeElement.textContent).toContain('Unsupported URLs');
    expect(fixture.nativeElement.textContent).toContain('/wp-login.php');
    expect(fixture.nativeElement.textContent).toContain('203.0.113.*');
    expect(fixture.nativeElement.textContent).not.toContain('203.0.113.42');
    expect(fixture.nativeElement.textContent).toContain('Request activity');
    expect(fixture.nativeElement.textContent).toContain('12');
  });
});
