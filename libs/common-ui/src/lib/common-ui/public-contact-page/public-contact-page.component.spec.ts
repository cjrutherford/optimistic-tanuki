import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideRouter,
  ActivatedRoute,
  convertToParamMap,
} from '@angular/router';
import { of } from 'rxjs';
import { PublicContactPageComponent } from './public-contact-page.component';

describe('PublicContactPageComponent', () => {
  let component: PublicContactPageComponent;
  let fixture: ComponentFixture<PublicContactPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicContactPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicContactPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the approved contact destinations without introducing a request form', () => {
    expect(component).toBeTruthy();

    const root = fixture.nativeElement as HTMLElement;
    const email = root.querySelector('a[href^="mailto:"]') as HTMLAnchorElement;

    expect(root.querySelector('h1')?.textContent).toContain(
      'Contact Hopeful Aspirations Industries'
    );
    expect(email.getAttribute('href')).toBe(
      'mailto:support@hopefulaspirationsindustries.com'
    );
    expect(root.textContent).toContain('the United States and its territories');
    expect(root.textContent).toContain('The HAI owner monitors this inbox.');
    expect(root.textContent).toContain('We do not promise a response time.');
    expect(root.querySelector('form')).toBeNull();
  });

  describe('with ?town=', () => {
    function render(town: string | null): HTMLElement {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [PublicContactPageComponent],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              queryParamMap: of(convertToParamMap(town ? { town } : {})),
            },
          },
        ],
      });
      const page = TestBed.createComponent(PublicContactPageComponent);
      page.detectChanges();
      return page.nativeElement as HTMLElement;
    }

    it('pre-fills the partnership email subject with the town', () => {
      const root = render('Adel');
      expect(root.textContent).toContain('Partner with us on Adel');
      const link = root.querySelector(
        'a[href*="subject="]'
      ) as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe(
        'mailto:support@hopefulaspirationsindustries.com?subject=Daylight%20sources%20for%20Adel'
      );
    });

    it('shows no town section without the parameter', () => {
      const root = render(null);
      expect(root.textContent).not.toContain('Partner with us');
    });
  });
});
