import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivateCloudHomePageComponent } from './private-cloud-home-page.component';
import {
  FREEDOM_PRINCIPLE,
  HOME_ARCHITECTURE,
  HOME_OUTCOMES,
  HOME_USE_CASES,
} from '../../content/private-cloud';

describe('PrivateCloudHomePageComponent', () => {
  let fixture: ComponentFixture<PrivateCloudHomePageComponent>;
  let element: HTMLElement;

  const hrefs = (selector: string) =>
    Array.from(element.querySelectorAll(selector)).map((link) =>
      link.getAttribute('href')
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PrivateCloudHomePageComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(PrivateCloudHomePageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('leads with the approved household message in a single h1', () => {
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.textContent).toContain(
      'Photos, files, media, and backups — set up for you'
    );
    expect(element.querySelector('.summary')?.textContent).toContain(
      'supported by real people'
    );
  });

  it('points every primary action at the assessment', () => {
    expect(hrefs('.intro-action, .primary-action')).toEqual([
      '/private-cloud/assessment',
      '/private-cloud/assessment',
    ]);
  });

  it('covers storage, photos, media, remote access, and backups as outcomes', () => {
    const titles = Array.from(element.querySelectorAll('#outcomes h3')).map(
      (title) => title.textContent
    );

    expect(titles).toEqual(HOME_OUTCOMES.map((outcome) => outcome.title));
    expect(titles.join(' ')).toMatch(/Room for everything/);
    expect(titles.join(' ')).toMatch(/photo/i);
    expect(titles.join(' ')).toMatch(/media/i);
    expect(titles.join(' ')).toMatch(/away from home/i);
    expect(titles.join(' ')).toMatch(/Backups/);
  });

  it('leads with outcomes, not product names', () => {
    expect(element.textContent).not.toMatch(
      /Nextcloud|Immich|Jellyfin|Paperless|Vaultwarden|WireGuard|Restic|Docker/
    );
  });

  it('shows household use cases on one row rather than orphaning a card', () => {
    expect(element.querySelectorAll('#use-cases h3')).toHaveLength(
      HOME_USE_CASES.length
    );
    expect(
      element.querySelector('#use-cases .capability-list')?.classList
    ).toContain('three-up');
    expect(
      element.querySelector('#outcomes .capability-list')?.classList
    ).not.toContain('three-up');
  });

  it('sketches an example architecture with its qualifier', () => {
    expect(
      Array.from(element.querySelectorAll('#architecture .tier h3')).map(
        (tier) => tier.textContent
      )
    ).toEqual(HOME_ARCHITECTURE.map((tier) => tier.label));
    expect(
      element.querySelector('#architecture figcaption')?.textContent
    ).toMatch(/example/i);
  });

  it('keeps the freedom principle and links organizations onward', () => {
    expect(element.querySelector('#freedom h2')?.textContent).toBe(
      FREEDOM_PRINCIPLE
    );
    expect(hrefs('.cta-panel .secondary a')).toEqual([
      '/private-cloud/organizations',
    ]);
  });

  it('avoids prohibited claims', () => {
    expect(element.textContent).not.toMatch(
      /unhackable|impossible to breach|guarantee[sd]? (savings|uptime)|always cheaper|church/i
    );
  });
});
