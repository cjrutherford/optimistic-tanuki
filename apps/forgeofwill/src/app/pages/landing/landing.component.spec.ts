import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent, RouterTestingModule],
      providers: [
        {
          provide: ThemeService,
          useValue: {
            generatedTheme$: of(undefined),
            getHeaderGradient: jest.fn(() => 'linear-gradient(#000, #111)'),
            getButtonGradient: jest.fn(() => 'linear-gradient(#111, #222)'),
            generatedTheme: {
              getValue: () => undefined,
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the marketing proof band for the landing workflow', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.hero-proof-band')).toBeTruthy();
    expect(compiled.textContent).toContain('From plan to progress');
  });
});
