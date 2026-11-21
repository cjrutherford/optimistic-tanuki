import { TestBed } from '@angular/core/testing';
import { DirectoryStatePanelComponent } from './directory-state-panel.component';
import { LocalDirectoryCoverage } from '../models';

interface Case {
  name: string;
  inputs: Record<string, unknown>;
  kind: string;
  title?: string;
  message?: string;
}

const cov = (
  state: LocalDirectoryCoverage['state'],
  reason?: LocalDirectoryCoverage['reason']
): LocalDirectoryCoverage => ({
  state,
  ...(reason ? { reason } : {}),
  withheldReviewedDetails: 0,
});

const cases: Case[] = [
  {
    name: 'loading',
    inputs: { status: 'loading' },
    kind: 'loading',
    title: 'Loading businesses…',
  },
  {
    name: 'failed',
    inputs: { status: 'failed' },
    kind: 'failed',
    title: 'Business directory is temporarily unavailable',
    message: 'Please try again.',
  },
  {
    name: 'empty',
    inputs: { coverage: cov('empty') },
    kind: 'empty',
    title: 'No businesses listed',
    message: 'No businesses are listed for this town yet.',
  },
  {
    name: 'acquiring',
    inputs: { coverage: cov('acquiring') },
    kind: 'acquiring',
    title: 'Gathering listings',
    message: 'Business listings for this town are being gathered.',
  },
  {
    name: 'partial',
    inputs: { coverage: cov('partial'), listingsShown: 3 },
    kind: 'partial',
    title: 'Listings still arriving',
    message: 'More listings are still being gathered.',
  },
  {
    name: 'blocked ineligible',
    inputs: { coverage: cov('blocked', 'town-ineligible') },
    kind: 'blocked-town-ineligible',
    title: 'Directory not available',
    message: "The business directory isn't available for this town.",
  },
  {
    name: 'blocked withdrawn',
    inputs: { coverage: cov('blocked', 'policy-withdrawn') },
    kind: 'blocked-policy-withdrawn',
    title: 'Listings withdrawn',
    message: 'Business listings for this town have been withdrawn.',
  },
  {
    name: 'unknown',
    inputs: { coverage: cov('unknown') },
    kind: 'unknown',
    title: 'Coverage unknown',
    message: "We can't tell yet whether this town has listings.",
  },
  {
    name: 'unconfigured',
    inputs: { coverage: cov('unconfigured') },
    kind: 'unconfigured',
    title: 'Directory not available yet',
    message: "The business directory isn't available for this town yet.",
  },
  {
    name: 'zero results for filter',
    inputs: { coverage: cov('available'), filtersActive: true },
    kind: 'no-match',
    title: 'No results',
    message:
      'No businesses match your search. Try different words or clear the search.',
  },
];

describe('DirectoryStatePanelComponent', () => {
  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(DirectoryStatePanelComponent);
    for (const [k, v] of Object.entries(inputs))
      fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture;
  }

  it.each(cases)(
    'renders the $name state',
    ({ inputs, kind, title, message }) => {
      const el = render(inputs).nativeElement as HTMLElement;
      const panel = el.querySelector('section') as HTMLElement;
      expect(panel.getAttribute('data-kind')).toBe(kind);
      expect(panel.querySelector('[role="heading"]')?.textContent?.trim()).toBe(
        title
      );
      if (message) expect(panel.textContent).toContain(message);
    }
  );

  it('renders nothing visible for an available town with listings', () => {
    const el = render({ coverage: cov('available'), listingsShown: 5 })
      .nativeElement as HTMLElement;
    expect(el.querySelector('section')).toBeNull();
  });

  it('uses status semantics, alert for failure and aria-busy while loading', () => {
    const loading = render({ status: 'loading' }).nativeElement as HTMLElement;
    expect(loading.querySelector('section')?.getAttribute('role')).toBe(
      'status'
    );
    expect(loading.querySelector('section')?.getAttribute('aria-busy')).toBe(
      'true'
    );
    const failed = render({ status: 'failed' }).nativeElement as HTMLElement;
    expect(failed.querySelector('section')?.getAttribute('role')).toBe('alert');
    expect(
      failed.querySelector('section')?.getAttribute('aria-busy')
    ).toBeNull();
  });

  it('emits retry from the failed state without exposing error details', () => {
    const fixture = render({ status: 'failed' });
    const retry = jest.fn();
    fixture.componentInstance.retry.subscribe(retry);
    (
      fixture.nativeElement.querySelector(
        '[data-testid="directory-retry"]'
      ) as HTMLButtonElement
    ).click();
    expect(retry).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toMatch(
      /stack|exception|503/i
    );
  });

  it('shows the withheld note alongside listings', () => {
    const el = render({
      coverage: { state: 'available', withheldReviewedDetails: 2 },
      listingsShown: 1,
    }).nativeElement as HTMLElement;
    expect(
      el.querySelector('[data-testid="withheld-note"]')?.textContent
    ).toContain('Some details are hidden');
  });

  it('moves focus to the heading when the state changes to one that must be read', () => {
    const fixture = render({ status: 'loading', autoFocus: true });
    fixture.componentRef.setInput('status', 'failed');
    fixture.detectChanges();
    fixture.detectChanges();
    expect(document.activeElement?.getAttribute('role')).toBe('heading');
  });

  it('honours the heading level', () => {
    const el = render({ status: 'failed', headingLevel: 3 })
      .nativeElement as HTMLElement;
    expect(
      el.querySelector('[role="heading"]')?.getAttribute('aria-level')
    ).toBe('3');
  });
});
