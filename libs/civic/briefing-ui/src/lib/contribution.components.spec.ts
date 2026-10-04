import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  ContributionView,
  PublicContribution,
} from '@optimistic-tanuki/civic-briefing-data-access';
import { ContributionQuoteComponent } from './contribution-quote.component';
import { ReviewTrailComponent } from './review-trail.component';

function render<T>(component: Type<T>, contribution: unknown): HTMLElement {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput('contribution', contribution);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const quoted: PublicContribution = {
  id: 'c1',
  kind: 'artifact',
  subject: { kind: 'meeting', text: 'Council, September 22' },
  occurredOn: '2026-09-22',
  body: 'The council voted 4–1\nto pave Love Avenue.',
  links: ['https://adelnews.example/story', 'not a url'],
  disclosedInterest: 'I live on Love Avenue',
  artifact: { sha256: 'ab12', mediaType: 'application/pdf', bytes: 2_500_000 },
  contributor: { id: 'u1', handle: 'clerkwatcher' },
  submittedAt: '2026-09-23T14:00:00Z',
};

describe('ContributionQuoteComponent', () => {
  it('quotes the words as written, attributed to the handle', () => {
    const page = render(ContributionQuoteComponent, quoted);
    expect(page.querySelector('.words')?.textContent).toBe(
      'The council voted 4–1\nto pave Love Avenue.'
    );
    const author = page.querySelector('footer a');
    expect(author?.textContent).toBe('clerkwatcher');
    expect(author?.getAttribute('href')).toBe('/contributors/u1');
    expect(page.querySelector('footer')?.textContent).toContain(
      'sent Wednesday, September 23, 2026'
    );
    expect(page.querySelector('.interest')?.textContent).toBe(
      'Disclosed: I live on Love Avenue'
    );
  });

  it('offers an attachment as a download, never inline', () => {
    const page = render(ContributionQuoteComponent, quoted);
    const download = page.querySelector('.attachment a');
    expect(download?.getAttribute('href')).toBe(
      '/api/local-hub/artifacts/ab12'
    );
    expect(download?.hasAttribute('download')).toBe(true);
    expect(download?.textContent).toBe('Download the document (PDF)');
    expect(page.querySelector('.attachment')?.textContent).toContain('2.4 MB');
    expect(page.querySelector('img, embed, iframe, object')).toBeNull();
  });

  it('opens links in a new tab that tells them nothing, named by host', () => {
    const page = render(ContributionQuoteComponent, quoted);
    const links = Array.from(page.querySelectorAll('.links a'));
    expect(links.map((a) => a.textContent)).toEqual([
      'adelnews.example',
      'not a url',
    ]);
    expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(links[0]?.getAttribute('target')).toBe('_blank');
  });
});

describe('ReviewTrailComponent', () => {
  it('states the outcome in plain words, with every step and reason', () => {
    const held: ContributionView = {
      id: 'c2',
      localitySlug: 'adel-ga',
      kind: 'account',
      subject: { kind: 'other', ref: null, text: 'Stop sign' },
      occurredOn: null,
      body: 'x',
      links: [],
      disclosedInterest: null,
      artifact: null,
      state: 'held',
      review: [
        {
          stage: 'model',
          outcome: 'hold',
          reasons: ['It names a private person.', 'It needs a document.'],
          at: '2026-09-23T14:00:00Z',
        },
      ],
      submittedAt: '2026-09-23T14:00:00Z',
    };
    const page = render(ReviewTrailComponent, held);
    expect(page.querySelector('.state')?.getAttribute('data-state')).toBe(
      'held'
    );
    expect(page.querySelector('.state strong')?.textContent).toBe(
      'Waiting for evidence.'
    );
    expect(page.querySelector('.stage')?.textContent).toBe('Review');
    expect(
      Array.from(page.querySelectorAll('.reason')).map((r) => r.textContent)
    ).toEqual(['It names a private person.', 'It needs a document.']);
  });
});
