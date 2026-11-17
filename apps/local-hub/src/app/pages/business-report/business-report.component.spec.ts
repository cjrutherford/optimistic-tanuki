import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';
import type { CreateListingReportRequest } from '@optimistic-tanuki/social-contracts';
import { CommunityService } from '../../services/community.service';
import {
  DirectoryRequestError,
  DirectoryService,
} from '../../services/directory.service';
import { BusinessReportComponent } from './business-report.component';

interface CommunityDouble {
  getCityBySlug: jest.Mock;
}
interface DirectoryDouble {
  getListing: jest.Mock;
  createReport: jest.Mock;
}

const LISTING_ID = '11111111-1111-4111-8111-111111111111';

describe('BusinessReportComponent', () => {
  let fixture: ComponentFixture<BusinessReportComponent>;
  let directory: DirectoryDouble;
  let community: CommunityDouble;

  const el = () => fixture.nativeElement as HTMLElement;
  const flush = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function setup(
    listing: unknown = { id: LISTING_ID, name: 'Pie Shop' }
  ) {
    community = {
      getCityBySlug: jest.fn().mockResolvedValue({ id: 'town-1', slug: 'v' }),
    };
    directory = {
      getListing: jest.fn().mockResolvedValue(listing),
      createReport: jest.fn().mockResolvedValue('RCPT-1234'),
    };
    await TestBed.configureTestingModule({
      imports: [BusinessReportComponent],
      providers: [
        provideRouter([]),
        { provide: CommunityService, useValue: community },
        { provide: DirectoryService, useValue: directory },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ slug: 'v', reference: 'r1' }),
            },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BusinessReportComponent);
    fixture.detectChanges();
    await flush();
  }

  const pickReason = (value: string) => {
    const radio = el().querySelector<HTMLInputElement>(
      `input[type=radio][value="${value}"]`
    );
    radio?.click();
    fixture.detectChanges();
  };
  const submit = async () => {
    el().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await flush();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
  };

  it('shows the heading, listing name and the reason radios', async () => {
    await setup();
    expect(el().querySelector('h1')?.textContent).toContain(
      'Report or correct this listing'
    );
    expect(el().textContent).toContain('Pie Shop');
    expect(el().querySelectorAll('fieldset input[type=radio]').length).toBe(6);
    expect(el().querySelector('legend')).toBeTruthy();
    expect(directory.getListing).toHaveBeenCalledWith('town-1', 'r1', true);
  });

  it('shows the expired copy when the listing id cannot be resolved', async () => {
    await setup(null);
    expect(el().textContent).toContain('expired');
    expect(el().querySelector('a')?.getAttribute('href')).toBe(
      '/city/v/businesses'
    );
  });

  it('requires a reason and focuses the error summary', async () => {
    await setup();
    await submit();
    expect(directory.createReport).not.toHaveBeenCalled();
    const summary = el().querySelector<HTMLElement>('.report-page__summary');
    expect(summary).toBeTruthy();
    expect(document.activeElement).toBe(summary);
    expect(el().querySelector('fieldset')?.getAttribute('aria-invalid')).toBe(
      'true'
    );
  });

  it('rejects a malformed email and an over-long note inline', async () => {
    await setup();
    pickReason('safety');
    const c = fixture.componentInstance;
    c.email.set('nope');
    c.note.set('x'.repeat(1001));
    await submit();
    expect(directory.createReport).not.toHaveBeenCalled();
    expect(el().querySelector('#email-error')).toBeTruthy();
    expect(el().querySelector('#note-error')).toBeTruthy();
    expect(
      el().querySelector('#report-email')?.getAttribute('aria-invalid')
    ).toBe('true');
  });

  it('sends the honeypot empty and the stable listing id', async () => {
    await setup();
    pickReason('duplicate');
    const trap = el().querySelector('.report-page__trap');
    expect(trap?.getAttribute('aria-hidden')).toBe('true');
    expect(trap?.querySelector('input')?.getAttribute('tabindex')).toBe('-1');
    expect(trap?.querySelector('input')?.getAttribute('autocomplete')).toBe(
      'off'
    );
    await submit();
    const body = directory.createReport.mock
      .calls[0][1] as CreateListingReportRequest;
    expect(directory.createReport.mock.calls[0][0]).toBe('town-1');
    expect(body).toEqual({
      listingId: LISTING_ID,
      reasonCode: 'duplicate',
      website: '',
    });
  });

  it('shows the receipt, focuses the acknowledgement and never echoes the email', async () => {
    await setup();
    pickReason('incorrect-details');
    fixture.componentInstance.email.set('me@example.com');
    await submit();
    const heading = el().querySelector<HTMLElement>('#ack-title');
    expect(heading?.textContent).toContain('Thanks — your report was received');
    expect(document.activeElement).toBe(heading);
    expect(el().querySelector('code')?.textContent).toContain('RCPT-1234');
    expect(el().textContent).not.toContain('me@example.com');
    expect(directory.createReport.mock.calls[0][1].email).toBe(
      'me@example.com'
    );
    const link = Array.from(el().querySelectorAll('a')).find((a) =>
      a.textContent?.includes('status')
    );
    expect(link?.getAttribute('href')).toBe('/directory/reports/status');
    expect(link?.getAttribute('href')).not.toContain('RCPT');
  });

  it.each([
    [429, 'Too many reports from this connection. Please try again later.'],
    [404, 'This listing is no longer available to report.'],
    [500, "We couldn't send your report. Please try again."],
    [null, "We couldn't send your report. Please try again."],
  ])('maps status %s to a generic message', async (status, message) => {
    await setup();
    directory.createReport.mockRejectedValue(new DirectoryRequestError(status));
    pickReason('other');
    await submit();
    expect(el().querySelector('.report-page__summary')?.textContent).toContain(
      message
    );
    expect(fixture.componentInstance.sending()).toBe(false);
    expect(
      el().querySelector('button[type=submit]')?.hasAttribute('disabled')
    ).toBe(false);
  });
});
