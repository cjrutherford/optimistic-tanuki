import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { BroadcastBannerComponent } from './broadcast-banner.component';
import { CivicApiService } from '../../services/civic-api.service';

describe('BroadcastBannerComponent', () => {
  let fixture: ComponentFixture<BroadcastBannerComponent>;
  let apiMock: { watchBroadcasts: jest.Mock };

  const setup = async (broadcasts: unknown[] | Error) => {
    apiMock = {
      watchBroadcasts: jest
        .fn()
        .mockReturnValue(broadcasts instanceof Error ? of([]) : of(broadcasts)),
    };

    await TestBed.configureTestingModule({
      imports: [BroadcastBannerComponent],
      providers: [{ provide: CivicApiService, useValue: apiMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(BroadcastBannerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('announces active broadcasts through a live region', async () => {
    await setup([
      { id: 'b-1', severity: 'warning', headline: 'Flash flood watch' },
    ]);

    const banner = fixture.nativeElement.querySelector('.broadcast-banner');
    expect(banner).toBeTruthy();
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.getAttribute('aria-live')).toBe('assertive');
    expect(banner.textContent).toContain('Flash flood watch');
    expect(banner.textContent).toContain('warning');
  });

  it('renders nothing when no broadcasts are active', async () => {
    await setup([]);

    expect(fixture.nativeElement.querySelector('.broadcast-banner')).toBeNull();
  });

  it('expires old advisories locally while retaining active ones during an SSE outage', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-27T14:00:00.000Z'));
    const snapshots = new Subject<unknown[]>();
    apiMock = { watchBroadcasts: jest.fn().mockReturnValue(snapshots) };

    await TestBed.configureTestingModule({
      imports: [BroadcastBannerComponent],
      providers: [{ provide: CivicApiService, useValue: apiMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(BroadcastBannerComponent);
    fixture.detectChanges();
    snapshots.next([
      {
        id: 'b-expiring',
        severity: 'warning',
        headline: 'Short flood watch',
        expiresAt: '2026-09-27T14:01:00.000Z',
      },
      {
        id: 'b-active',
        severity: 'emergency',
        headline: 'Shelter remains open',
      },
    ]);
    fixture.detectChanges();

    jest.advanceTimersByTime(61_000);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain(
      'Short flood watch'
    );
    expect(fixture.nativeElement.textContent).toContain('Shelter remains open');
    fixture.destroy();
    jest.useRealTimers();
  });
});
