import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthStateService } from '../../services/auth-state.service';
import { DaylightCommunityComponent } from './daylight-community.component';

const quote = (id: string, handle: string, body: string) => ({
  id,
  kind: 'account',
  subject: { kind: 'meeting', text: 'City council' },
  occurredOn: '2026-09-22',
  body,
  links: [],
  disclosedInterest: null,
  artifact: null,
  contributor: { id: `${handle}-id`, handle },
  submittedAt: '2026-09-23T10:00:00Z',
});

describe('DaylightCommunityComponent', () => {
  function render(signedIn: boolean): {
    page: HTMLElement;
    flush: (data: unknown) => void;
  } {
    TestBed.configureTestingModule({
      imports: [DaylightCommunityComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthStateService,
          useValue: { isAuthenticated$: of(signedIn) },
        },
      ],
    });
    const fixture = TestBed.createComponent(DaylightCommunityComponent);
    fixture.componentRef.setInput('citySlug', 'adel-ga');
    fixture.componentRef.setInput('localitySlug', 'adel-ga');
    fixture.componentRef.setInput('town', 'Adel');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    return {
      page: fixture.nativeElement as HTMLElement,
      flush: (data) => {
        http
          .expectOne('/api/local-hub/editions/adel-ga/community')
          .flush({ data });
        fixture.detectChanges();
      },
    };
  }

  it('shows a report, its state and who corroborated it, never a count', () => {
    const { page, flush } = render(true);
    flush({
      official: [],
      items: [
        {
          ...quote('r1', 'ann', 'They voted to pave it.'),
          status: 'corroborated',
          releasedByEvidence: true,
          corroborations: [quote('r2', 'bob', 'I saw the vote too.')],
          outcomes: [
            {
              verdict: 'confirmed',
              kind: 'record',
              title: 'Minutes, September 22',
              date: '2026-09-29',
              url: 'https://adelga.example/minutes.pdf',
              publisher: null,
              reason: 'x',
            },
          ],
        },
      ],
    });
    expect(page.querySelector('.status')?.textContent?.trim()).toBe(
      'Corroborated, with a document'
    );
    expect(
      Array.from(page.querySelectorAll('.words')).map((w) => w.textContent)
    ).toEqual(['They voted to pave it.', 'I saw the vote too.']);
    expect(page.querySelector('.outcome')?.textContent).toContain(
      'Borne out by'
    );
    const corroborate = page.querySelector('a.corroborate');
    expect(corroborate?.getAttribute('href')).toBe(
      '/city/adel-ga/report?corroborate=r1'
    );
  });

  it('offers corroboration only to someone signed in', () => {
    const { page, flush } = render(false);
    flush({
      official: [],
      items: [
        {
          ...quote('r1', 'ann', 'x'),
          status: 'single',
          releasedByEvidence: false,
          corroborations: [],
          outcomes: [],
        },
      ],
    });
    expect(page.querySelector('a.corroborate')).toBeNull();
  });

  it('invites a first report when there are none', () => {
    const { page, flush } = render(false);
    flush({ official: [], items: [] });
    expect(page.textContent).toContain('No resident reports yet.');
  });
});
