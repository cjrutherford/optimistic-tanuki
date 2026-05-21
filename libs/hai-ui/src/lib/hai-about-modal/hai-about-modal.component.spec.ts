import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HaiAboutModalComponent } from './hai-about-modal.component';
import { HaiAppDirectoryService } from '../hai-types/hai-app-directory.service';

describe('HaiAboutModalComponent', () => {
  let fixture: ComponentFixture<HaiAboutModalComponent>;
  let component: HaiAboutModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HaiAboutModalComponent],
      providers: [
        {
          provide: HaiAppDirectoryService,
          useValue: {
            getResolvedApps: jest.fn().mockReturnValue(
              of([
                {
                  appId: 'towne-square',
                  name: 'Towne Square',
                  tagline: 'Neighborhood commerce and local connection.',
                  resolvedHref: 'https://towne-square.example.com',
                  isPublic: true,
                },
              ])
            ),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HaiAboutModalComponent);
    component = fixture.componentInstance;
    component.visible = true;
    component.config = {
      appId: 'hai-computer',
      appName: 'HAI Computer',
      appTagline: 'Pre-configured personal cloud systems.',
      appDescription: 'Purpose-built systems for digital homesteading.',
      appUrl: '/hai-computer',
    };
    fixture.detectChanges();
  });

  it('excludes the current app from the cross-link directory', () => {
    const appLinks = fixture.nativeElement.querySelectorAll(
      '[data-testid="hai-app-link"]'
    ) as NodeListOf<HTMLAnchorElement>;

    expect(Array.from(appLinks).some((link) => link.textContent?.includes('HAI Computer'))).toBe(false);
  });

  it('switches to the HAI tab when selected', () => {
    const tabs = fixture.nativeElement.querySelectorAll(
      '.tab-item'
    ) as NodeListOf<HTMLButtonElement>;

    tabs[1].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'software development house'
    );
  });
});
