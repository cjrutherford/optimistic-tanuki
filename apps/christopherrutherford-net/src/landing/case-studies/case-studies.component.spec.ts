import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CASE_STUDIES } from './case-studies.data';
import { CaseStudiesComponent } from './case-studies.component';

describe('CaseStudiesComponent', () => {
  let fixture: ComponentFixture<CaseStudiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaseStudiesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CaseStudiesComponent);
    fixture.detectChanges();
  });

  it('renders one card per case study', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.case-study-card')).toHaveLength(
      CASE_STUDIES.length
    );
    for (const study of CASE_STUDIES) {
      expect(element.textContent).toContain(study.name);
    }
  });

  it('links every case study to a public repository', () => {
    const element = fixture.nativeElement as HTMLElement;
    const sourceLinks = Array.from(
      element.querySelectorAll<HTMLAnchorElement>('.case-study-link.primary')
    );

    expect(sourceLinks).toHaveLength(CASE_STUDIES.length);
    for (const link of sourceLinks) {
      expect(link.getAttribute('href')).toMatch(
        /^https:\/\/github\.com\/cjrutherford\/[a-z-]+$/
      );
    }
  });

  it('gives every screenshot descriptive alternative text', () => {
    const element = fixture.nativeElement as HTMLElement;
    const images = Array.from(
      element.querySelectorAll<HTMLImageElement>('.case-study-figure img')
    );

    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.getAttribute('alt')?.trim()).toBeTruthy();
    }
  });

  it('describes each case study with problem, build, and evidence', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.case-study-block').length).toBe(
      CASE_STUDIES.length * 3
    );
  });
});
