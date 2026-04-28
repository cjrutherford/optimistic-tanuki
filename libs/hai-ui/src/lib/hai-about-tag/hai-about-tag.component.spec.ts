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

  it('renders the Savannah line prominently inside the modal', () => {
    component.isOpen.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Made with Love in Savannah - '
    );
  });
});
