import { TestBed } from '@angular/core/testing';
import { DirectorySourceAttributionComponent } from './directory-source-attribution.component';

describe('DirectorySourceAttributionComponent', () => {
  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(
      DirectorySourceAttributionComponent
    );
    for (const [k, v] of Object.entries(inputs))
      fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows freshness, attribution, notices, terms links and the limitation', () => {
    const el = render({
      attribution: ['Overture Maps Foundation'],
      notices: ['CDLA Permissive 2.0'],
      termsUrls: ['https://cdla.dev/permissive-2.0/'],
      freshness: {
        state: 'stale',
        releaseId: '2026-10-21.0',
        sourcePublishedAt: '2026-10-21T00:00:00.000Z',
        acquiredAt: null,
        thresholds: { freshDays: 90, staleDays: 120 },
      },
    });
    expect(el.textContent).toContain('Overture Maps Foundation');
    expect(el.textContent).toContain('CDLA Permissive 2.0');
    expect(el.querySelector('a')?.getAttribute('rel')).toBe(
      'noopener noreferrer'
    );
    expect(
      el.querySelector('[data-testid="source-freshness"]')?.textContent
    ).toContain('may be out of date');
    expect(
      el.querySelector('[data-testid="source-limitation"]')?.textContent
    ).toContain('may be incomplete');
    expect(el.querySelector('section')?.getAttribute('aria-label')).toBe(
      'Data source'
    );
  });

  it('can hide the limitation and omits freshness when unknown to the page', () => {
    const el = render({ showLimitation: false });
    expect(el.querySelector('[data-testid="source-limitation"]')).toBeNull();
    expect(el.querySelector('[data-testid="source-freshness"]')).toBeNull();
  });
});
