import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthStateService } from './state/auth-state.service';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStateService,
          useValue: {
            isAuthenticated: false,
            isAuthenticated$: () => ({
              subscribe: () => ({ unsubscribe: () => undefined }),
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the HAI Computer brand shell', () => {
    expect(component.brandName).toBe('HAI Computer');
    expect(fixture.nativeElement.textContent).toContain(
      'Hopeful Aspirations Integrators Computers'
    );
  });
});
