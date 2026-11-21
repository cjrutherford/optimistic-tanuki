import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DirectoryCardComponent } from './directory-card.component';
import { LocalDirectoryListing } from '../models';

const listing: LocalDirectoryListing = {
  name: 'Pineview Grocery',
  category: 'convenience_store',
  attribution: ['Overture Maps Foundation'],
  notices: ['CDLA Permissive 2.0'],
  termsUrls: ['https://cdla.dev/permissive-2.0/'],
  address: '1 Main St',
  reference: 'abc',
};

describe('DirectoryCardComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([])] })
  );

  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(DirectoryCardComponent);
    fixture.componentRef.setInput('listing', listing);
    for (const [k, v] of Object.entries(inputs))
      fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows name, category, unclaimed badge, and address, without a per-card credit', () => {
    const el = render();
    expect(el.querySelector('h3')?.textContent).toBe('Pineview Grocery');
    expect(el.textContent).toContain('Convenience Store');
    expect(el.textContent).toContain('Directory listing (not claimed)');
    expect(el.textContent).toContain('1 Main St');
    expect(el.querySelector('address')?.textContent).toBe('1 Main St');
    expect(el.textContent).not.toContain('Overture Maps Foundation');
    expect(el.querySelector('[data-testid="listing-detail-link"]')).toBeNull();
  });

  it('labels the article by its heading and links to the detail route', () => {
    const el = render({
      detailLink: ['/city', 'x', 'businesses', 'abc'],
      businessPage: true,
    });
    const article = el.querySelector('article') as HTMLElement;
    expect(article.getAttribute('aria-labelledby')).toBe(
      el.querySelector('h3')?.id
    );
    const link = el.querySelector(
      '[data-testid="listing-detail-link"]'
    ) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/city/x/businesses/abc');
    expect(link.getAttribute('aria-label')).toBe(
      'View details for Pineview Grocery'
    );
    expect(el.textContent).toContain('Business page');
  });
});
