import { TestBed } from '@angular/core/testing';
import { daylightProviders, http } from '../daylight-testing';
import {
  DaylightContributePage,
  safeReturnUrl,
} from './daylight-contribute.page';

const API = '/api/local-hub';

describe('DaylightContributePage', () => {
  function render(
    membership: Record<string, unknown>,
    query: Record<string, string> = {}
  ) {
    TestBed.configureTestingModule({
      imports: [DaylightContributePage],
      providers: daylightProviders({ query }),
    });
    const fixture = TestBed.createComponent(DaylightContributePage);
    fixture.detectChanges();
    http()
      .expectOne(`${API}/me`)
      .flush({
        data: {
          profileId: 'p1',
          handle: 'ada',
          roles: [],
          permissions: ['briefing.read'],
          ...membership,
        },
      });
    fixture.detectChanges();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => http().verify());

  it('asks for a verified email address before anything else', () => {
    const { page } = render({ emailVerified: false });
    expect(page.querySelector('form')).toBeNull();
    expect(page.querySelector('.notice-box')?.textContent).toContain(
      'verify your email address'
    );
  });

  it('signs up only after the terms are agreed, then offers the way back', async () => {
    const { fixture, page } = render(
      { emailVerified: true },
      { returnUrl: '/city/adel-ga/report' }
    );
    expect(
      page.querySelector('app-daylight-contributor-terms li')
    ).not.toBeNull();
    const button = page.querySelector(
      'otui-button button'
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    const form = page.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    http().expectNone(`${API}/contributor`);

    fixture.componentInstance['agreed'] = true;
    form.dispatchEvent(new Event('submit'));
    const request = http().expectOne(`${API}/contributor`);
    expect(request.request.body).toEqual({ agreeToTerms: true });
    request.flush({
      data: {
        profileId: 'p1',
        handle: 'ada',
        emailVerified: true,
        roles: ['local_hub_contributor'],
        permissions: ['briefing.read', 'contribution.create'],
      },
    });
    fixture.detectChanges();
    expect(page.querySelector('.done')?.textContent).toContain(
      "You're a Daylight contributor."
    );
    expect(page.querySelector('.done a')?.getAttribute('href')).toBe(
      '/city/adel-ga/report'
    );
  });

  it('says so when the account already contributes', () => {
    const { page } = render({
      emailVerified: true,
      permissions: ['contribution.create'],
    });
    expect(page.querySelector('.done')?.textContent).toContain(
      "You're already a Daylight contributor."
    );
  });
});

it('only returns to paths on this site', () => {
  expect(safeReturnUrl('/city/adel-ga/report')).toBe('/city/adel-ga/report');
  expect(safeReturnUrl('//evil.example/x')).toBeNull();
  expect(safeReturnUrl('https://evil.example')).toBeNull();
  expect(safeReturnUrl(null)).toBeNull();
});
