import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ReleaseInformationComponent } from './release-information.component';

describe('scoped public release guidance', () => {
  async function render(appId: string, view = 'guide') {
    await TestBed.configureTestingModule({
      imports: [ReleaseInformationComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { appId, view } } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReleaseInformationComponent);
    fixture.detectChanges();
    return fixture;
  }
  afterEach(() => TestBed.resetTestingModule());
  it.each([
    ['client-interface', '/settings', '/feed'],
    ['local-hub', '/account', '/cities'],
  ])(
    'leads %s to its own account and starting point',
    async (appId, account, start) => {
      const f = await render(appId);
      const links = Array.from(
        f.nativeElement.querySelectorAll('a')
      ) as HTMLAnchorElement[];
      expect(links.some((a) => a.getAttribute('href') === account)).toBe(true);
      expect(links.some((a) => a.getAttribute('href') === start)).toBe(true);
      expect(f.nativeElement.textContent).not.toMatch(
        /thousands|free forever|guaranteed delivery/i
      );
    }
  );
  it('explains cross-product deletion, retention and external-copy limits without a wipe guarantee', async () => {
    const f = await render('local-hub', 'policy');
    const text = f.nativeElement.textContent;
    for (const phrase of [
      'seven days',
      '90-day',
      'both applications',
      'shared audit history',
      'backups',
      'provider-held',
      'stays blocked',
      'No response time',
      'deidentified deletion records',
    ])
      expect(text).toContain(phrase);
    expect(f.nativeElement.querySelector('a[href="/contact"]')).toBeTruthy();
  });
  it('requires an explicit supported product scope', async () => {
    await expect(render('unrelated-app')).rejects.toThrow(
      'RELEASE_INFORMATION_SCOPE_REQUIRED'
    );
  });
});
