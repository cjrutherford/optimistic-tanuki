import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { PREDEFINED_PERSONALITIES, ThemeService } from '@optimistic-tanuki/theme-lib';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
      providers: [ThemeService],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should render navigation sidebar', () => {
    expect(fixture.nativeElement.querySelector('pg-nav-sidebar')).toBeTruthy();
  });

  it('should have main content area', () => {
    expect(fixture.nativeElement.querySelector('.main-content')).toBeTruthy();
  });

  it('renders global theme controls for validation sweeps', () => {
    const root = fixture.nativeElement as HTMLElement;
    const personalitySelect = root.querySelector(
      'select[aria-label="Active personality"]'
    );
    const modeButtons = Array.from(
      root.querySelectorAll('.theme-toolbar .mode-toggle button')
    );

    expect(personalitySelect).toBeTruthy();
    expect((personalitySelect as HTMLSelectElement).options.length).toBe(
      PREDEFINED_PERSONALITIES.length
    );
    expect(modeButtons).toHaveLength(2);
  });
});
