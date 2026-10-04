import { TestBed } from '@angular/core/testing';
import { ADEL, daylightProviders, http } from '../daylight-testing';
import { DaylightReportPage } from './daylight-report.page';

const API = '/api/local-hub';

const recorded = {
  id: 'c1',
  localitySlug: 'adel-ga',
  kind: 'account',
  subject: { kind: 'other', ref: null, text: 'Stop sign' },
  occurredOn: null,
  body: 'x',
  links: [],
  disclosedInterest: null,
  artifact: null,
  state: 'accepted',
  review: [{ stage: 'model', outcome: 'accept', reasons: ['Fine.'], at: 'x' }],
  submittedAt: '2026-09-23T14:00:00Z',
};

describe('DaylightReportPage', () => {
  async function render(
    permissions: string[],
    query: Record<string, string> = {}
  ) {
    TestBed.configureTestingModule({
      imports: [DaylightReportPage],
      providers: daylightProviders({
        params: { slug: 'adel-ga' },
        query,
        city: ADEL,
      }),
    });
    const fixture = TestBed.createComponent(DaylightReportPage);
    fixture.detectChanges();
    await fixture.whenStable();
    http()
      .expectOne(`${API}/me`)
      .flush({ data: { permissions, roles: [] } });
    // The subjects are asked for once the town has resolved.
    fixture.detectChanges();
    await fixture.whenStable();
    http()
      .expectOne(`${API}/editions/adel-ga/subjects`)
      .flush({
        data: [
          {
            kind: 'meeting',
            ref: 'm1',
            title: 'City council',
            date: '2026-09-22',
            url: null,
          },
        ],
      });
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http().verify());

  it('sends a reader to the contributor sign-up instead of showing the form', async () => {
    const fixture = await render([]);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('form')).toBeNull();
    const join = page.querySelector('.notice-box a');
    expect(join?.textContent?.trim()).toBe('become a contributor');
    expect(join?.getAttribute('href')).toBe(
      '/contribute?returnUrl=%2Fcity%2Fadel-ga%2Freport'
    );
  });

  it('offers the recent meetings and sends a report with its key', async () => {
    const fixture = await render(['contribution.create']);
    const page = fixture.nativeElement as HTMLElement;
    expect(
      Array.from(page.querySelectorAll('optgroup option')).map((o) =>
        o.textContent?.trim()
      )
    ).toEqual(['City council, Tuesday, September 22, 2026']);

    const form = fixture.componentInstance['form'];
    form.patchValue({
      about: 'meeting:m1',
      body: 'The council voted to pave Love Avenue.',
      witnessed: true,
      ownWords: true,
    });
    fixture.detectChanges();
    (page.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit')
    );
    const request = http().expectOne(`${API}/contributions`);
    expect(request.request.headers.get('Idempotency-Key')).toBeTruthy();
    const submission = JSON.parse(
      (request.request.body as FormData).get('submission') as string
    );
    expect(submission).toMatchObject({
      localitySlug: 'adel-ga',
      subject: { kind: 'meeting', ref: 'm1' },
      occurredOn: '2026-09-22',
      representations: { witnessed: true, ownWords: true },
    });
    request.flush({ data: recorded });
    fixture.detectChanges();
    expect(page.querySelector('civic-review-trail')?.textContent).toContain(
      'Recorded.'
    );
  });

  it('shows every reason a report was refused', async () => {
    const fixture = await render(['contribution.create']);
    const page = fixture.nativeElement as HTMLElement;
    fixture.componentInstance['form'].patchValue({
      subjectText: 'Stop sign',
      body: 'x',
    });
    (page.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit')
    );
    http()
      .expectOne(`${API}/contributions`)
      .flush(
        {
          reasons: ['Say you saw it yourself.', 'Write it in your own words.'],
        },
        { status: 422, statusText: 'Unprocessable Entity' }
      );
    fixture.detectChanges();
    expect(
      Array.from(page.querySelectorAll('.problem p')).map((p) => p.textContent)
    ).toEqual(['Say you saw it yourself.', 'Write it in your own words.']);
  });

  it('corroborates the report named in the link', async () => {
    const fixture = await render(['contribution.create'], {
      corroborate: 'r1',
    });
    http()
      .expectOne(`${API}/editions/adel-ga/community`)
      .flush({
        data: {
          official: [],
          items: [
            {
              id: 'r1',
              subject: { kind: 'meeting', text: 'City council' },
              occurredOn: '2026-09-22',
              body: 'They voted.',
            },
          ],
        },
      });
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.target blockquote')?.textContent).toBe(
      'They voted.'
    );
    expect(page.querySelector('select')).toBeNull();
  });
});
