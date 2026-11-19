import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HaiAboutTagComponent } from './hai-about-tag.component';
import { HaiAppDirectoryService } from '../hai-types/hai-app-directory.service';

describe('HaiAboutTagComponent', () => {
  let fixture: ComponentFixture<HaiAboutTagComponent>;
  let component: HaiAboutTagComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HaiAboutTagComponent],
      providers: [
        {
          provide: HaiAppDirectoryService,
          useValue: { getResolvedApps: jest.fn().mockReturnValue(of([])) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HaiAboutTagComponent);
    component = fixture.componentInstance;
    component.config = {
      appId: 'towne-square',
      appName: 'Towne Square',
      appTagline: 'Neighborhood commerce and local connection.',
      appDescription: 'A local-first civic marketplace for communities.',
      appUrl: '/towne-square',
    };
    fixture.detectChanges();
  });

  it('opens the about modal when the tag is clicked', () => {
    const button = fixture.nativeElement.querySelector(
      '[data-testid="hai-about-tag"]'
    ) as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="hai-about-modal"]')
    ).not.toBeNull();
  });

  it('shows the logo instead of a text mark, hidden from assistive tech', () => {
    const button = fixture.nativeElement.querySelector(
      '[data-testid="hai-about-tag"]'
    ) as HTMLButtonElement;
    const logo = button.querySelector('hai-logo') as HTMLElement;

    expect(logo).not.toBeNull();
    expect(logo.getAttribute('aria-hidden')).toBe('true');
    expect(logo.querySelector('svg')).not.toBeNull();
    expect(button.querySelector('.tag-mark')).toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Open about HAI');
  });

  it('renders the Savannah line prominently inside the modal', () => {
    component.isOpen.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Made with Love in Savannah - '
    );
  });

  it('marks the host when it is placed in the flow', () => {
    component.placement = 'inline';
    fixture.detectChanges();

    expect(fixture.nativeElement.classList).toContain('inline');
  });
});
