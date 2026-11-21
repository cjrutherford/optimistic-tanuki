import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CASE_STUDIES } from './case-studies.data';
import { CaseStudiesComponent } from './case-studies.component';

describe('CaseStudiesComponent', () => {
  let fixture: ComponentFixture<CaseStudiesComponent>;
  let element: HTMLElement;

  const cards = () =>
    Array.from(element.querySelectorAll<HTMLElement>('.case-study-card'));
  const cardFor = (name: string) =>
    cards().find(
      (card) =>
        card.querySelector('.case-study-title')?.textContent?.trim() === name
    ) as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaseStudiesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CaseStudiesComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('uses the engineering work heading as the section h2', () => {
    expect(element.querySelector('h2')?.textContent?.trim()).toBe(
      'Selected engineering work'
    );
  });

  it('renders the four featured studies in order, then TunerDaemon', () => {
    const featured = Array.from(
      element.querySelectorAll(
        '.case-study-grid:not(.supporting) .case-study-title'
      )
    ).map((el) => el.textContent?.trim());
    const supporting = Array.from(
      element.querySelectorAll('.supporting .case-study-title')
    ).map((el) => el.textContent?.trim());

    expect(featured).toEqual([
      'Optimistic Tanuki',
      'Homestead',
      'ChannelLoom',
      'Statocyst',
    ]);
    expect(supporting).toEqual(['TunerDaemon']);
    expect(element.querySelector('.also-built-heading')?.textContent).toContain(
      'Also built'
    );
    expect(cards()).toHaveLength(CASE_STUDIES.length);
  });

  it('limits every stack to six items', () => {
    for (const study of CASE_STUDIES) {
      expect(study.stack.length).toBeLessThanOrEqual(6);
    }
  });

  it('links every case study to a public repository', () => {
    const sourceLinks = Array.from(
      element.querySelectorAll<HTMLAnchorElement>('.case-study-link.primary')
    );

    expect(sourceLinks).toHaveLength(CASE_STUDIES.length);
    for (const link of sourceLinks) {
      expect(link.getAttribute('href')).toMatch(
        /^https:\/\/github\.com\/cjrutherford\/[a-z-]+$/
      );
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener');
      expect(link.textContent).toContain('View source');
    }
    expect(
      cardFor('Homestead')
        .querySelector('.case-study-link.primary')
        ?.getAttribute('aria-label')
    ).toBe('View source: Homestead on GitHub');
  });

  it('renders release and architecture links only when set', () => {
    for (const study of CASE_STUDIES) {
      const links = Array.from(
        cardFor(study.name).querySelectorAll('.case-study-link')
      ).map((a) => a.textContent?.trim() ?? '');
      expect(links.some((t) => t.startsWith('View release'))).toBe(
        !!study.releaseHref
      );
      expect(links.some((t) => t.startsWith('Read architecture'))).toBe(
        !!study.architectureHref
      );
    }
  });

  it('does not link a release for Homestead or claim signed packages', () => {
    const homestead = CASE_STUDIES.find((s) => s.id === 'homestead');
    expect(homestead?.releaseHref).toBeUndefined();
    expect(cardFor('Homestead').textContent).not.toContain('View release');
    expect(cardFor('Homestead').textContent).not.toContain('ships signed');
    expect(cardFor('Homestead').textContent).toContain('not yet public');
  });

  it('gives every screenshot descriptive alternative text', () => {
    const images = Array.from(
      element.querySelectorAll<HTMLImageElement>('.case-study-figure img')
    );

    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.getAttribute('alt')?.trim()).toBeTruthy();
    }
  });

  it('describes each featured study with problem, decisions, constraints, evidence and status', () => {
    for (const card of cards().slice(0, 4)) {
      expect(card.querySelector('[data-block="problem"]')).not.toBeNull();
      expect(card.querySelector('[data-block="decision"]')).not.toBeNull();
      expect(card.querySelector('[data-block="evidence"]')).not.toBeNull();
      expect(card.querySelector('details.case-study-details')).not.toBeNull();
      expect(card.querySelector('.case-study-status')).not.toBeNull();
    }
  });

  it('keeps the supporting card compact but complete', () => {
    const card = cardFor('TunerDaemon');
    expect(card.classList).toContain('compact');
    expect(card.querySelector('[data-block="problem"]')).not.toBeNull();
    expect(card.querySelector('[data-block="decision"]')).not.toBeNull();
    expect(card.querySelector('[data-block="evidence"]')).not.toBeNull();
    expect(card.querySelector('.case-study-status')).not.toBeNull();
    expect(card.querySelector('details')).toBeNull();
  });

  it('never claims project counts, production readiness or segmented MP4', () => {
    const text = element.textContent ?? '';
    expect(text).not.toMatch(/production-ready/i);
    expect(text).not.toMatch(/segmented MP4/i);
    expect(text).not.toMatch(/\b\d+ (app|project|librar)/i);
  });
});
