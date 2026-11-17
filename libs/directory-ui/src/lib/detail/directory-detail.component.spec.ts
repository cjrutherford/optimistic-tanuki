import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DirectoryDetailComponent } from './directory-detail.component';
import { LocalDirectoryListing } from '../models';

const listing: LocalDirectoryListing = {
  name: 'Pineview Grocery',
  category: 'convenience_store',
  attribution: ['Overture Maps Foundation'],
  notices: ['CDLA Permissive 2.0'],
  termsUrls: ['https://cdla.dev/permissive-2.0/'],
};

describe('DirectoryDetailComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([])] })
  );

  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(DirectoryDetailComponent);
    for (const [k, v] of Object.entries(inputs))
      fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows attribution, terms, limitation and the report and back links', () => {
    const el = render({
      listing,
      backLink: ['/city', 'x', 'businesses'],
      reportLink: ['/city', 'x', 'businesses', 'ref', 'report'],
    });
    expect(el.querySelector('h1')?.textContent).toBe('Pineview Grocery');
    expect(el.textContent).toContain('Directory listing (not claimed)');
    expect(el.textContent).toContain('Overture Maps Foundation');
    expect(el.textContent).toContain('CDLA Permissive 2.0');
    expect(
      el.querySelector('[data-testid="source-limitation"]')?.textContent
    ).toContain('may be incomplete');
    expect(
      el.querySelector('[data-testid="detail-report"]')?.getAttribute('href')
    ).toBe('/city/x/businesses/ref/report');
    expect(
      el.querySelector('[data-testid="detail-report"]')?.textContent
    ).toContain('Report or correct this listing');
    expect(
      el.querySelector('[data-testid="detail-back"]')?.getAttribute('href')
    ).toBe('/city/x/businesses');
  });

  it('adds the coverage caveat when coverage is partial or acquiring', () => {
    const el = render({
      listing,
      coverage: { state: 'partial', withheldReviewedDetails: 1 },
    });
    expect(
      el.querySelector('[data-testid="detail-coverage"]')?.textContent
    ).toContain('still being gathered');
    expect(el.querySelector('[data-testid="detail-withheld"]')).not.toBeNull();
  });

  it('says the link has expired and offers the way back', () => {
    const el = render({
      status: 'expired',
      backLink: ['/city', 'x', 'businesses'],
    });
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
      'This listing link has expired'
    );
    expect(
      el.querySelector('[data-testid="detail-expired"]')?.getAttribute('role')
    ).toBe('status');
    expect(el.querySelector('[data-testid="detail-back"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="detail-report"]')).toBeNull();
  });

  it('shows generic copy for failures and busy for loading', () => {
    const failed = render({ status: 'failed' });
    expect(
      failed
        .querySelector('[data-testid="detail-failed"]')
        ?.getAttribute('role')
    ).toBe('alert');
    expect(failed.textContent).toContain('temporarily unavailable');
    const loading = render({ status: 'loading' });
    expect(loading.querySelector('article')?.getAttribute('aria-busy')).toBe(
      'true'
    );
  });

  it('moves focus to the heading after render', async () => {
    const fixture = TestBed.createComponent(DirectoryDetailComponent);
    fixture.componentRef.setInput('listing', listing);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement?.tagName).toBe('H1');
  });
});
