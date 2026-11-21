import { TestBed } from '@angular/core/testing';
import { SectionScrollService } from './section-scroll.service';

describe('SectionScrollService', () => {
  let service: SectionScrollService;
  let section: HTMLElement;

  function mockMotion(reduce: boolean) {
    window.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: reduce }) as unknown as typeof matchMedia;
  }

  beforeEach(() => {
    section = document.createElement('section');
    section.id = 'experience';
    section.scrollIntoView = jest.fn();
    document.body.appendChild(section);
    service = TestBed.inject(SectionScrollService);
  });

  afterEach(() => section.remove());

  it('scrolls smoothly and focuses the section', () => {
    mockMotion(false);

    expect(service.scrollTo('experience')).toBe(true);
    expect(section.scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'smooth',
    });
    expect(section.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(section);
  });

  it('scrolls instantly when reduced motion is requested', () => {
    mockMotion(true);

    service.scrollTo('experience');

    expect(section.scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'instant',
    });
  });

  it('returns false for a missing section', () => {
    expect(service.scrollTo('nope')).toBe(false);
  });
});
