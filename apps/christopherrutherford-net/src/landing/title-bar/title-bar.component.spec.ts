import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { SectionScrollService } from '../section-scroll.service';
import { TitleBarComponent } from './title-bar.component';

interface ScrollerDouble {
  scrollTo: jest.Mock;
}

describe('TitleBarComponent', () => {
  let component: TitleBarComponent;
  let fixture: ComponentFixture<TitleBarComponent>;
  let scroller: ScrollerDouble;

  beforeEach(async () => {
    scroller = { scrollTo: jest.fn() };
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        provideRouter([]),
        { provide: SectionScrollService, useValue: scroller },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TitleBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the available tanuki brand mark', () => {
    const logo = (fixture.nativeElement as HTMLElement).querySelector(
      'otui-app-bar'
    );

    expect(logo?.getAttribute('logosrc')).toBe(
      'assets/images/tanuki-mark.webp'
    );
  });

  it('offers the recruiter-oriented primary navigation', () => {
    expect(component.navItems.map(({ label }) => label)).toEqual([
      'Work',
      'Experience',
      'About',
      'Consulting',
      'Contact',
      'Résumé (PDF)',
    ]);
  });

  it('routes anchors through the router and scrolls to them', async () => {
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate');
    component.menuOpen.set(true);

    const consulting = component.navItems.find(
      ({ label }) => label === 'Consulting'
    );
    consulting?.action?.();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith([], { fragment: 'work-together' });
    expect(scroller.scrollTo).toHaveBeenCalledWith('work-together');
    expect(component.menuOpen()).toBe(false);
  });

  it('opens the resume PDF in a new tab', () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    component.navItems
      .find(({ label }) => label === 'Résumé (PDF)')
      ?.action?.();

    expect(open).toHaveBeenCalledWith(
      '/assets/christopher-rutherford-resume.pdf',
      '_blank',
      'noopener'
    );
    open.mockRestore();
  });
});
