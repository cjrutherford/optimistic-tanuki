import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('renders the developer portal hero copy', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain(
      'API docs, SDK onboarding, and usage visibility in one place.'
    );
    expect(compiled.textContent).toContain('Signal Foundry is the case study.');
  });

  it('renders the usage and getting started sections', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('MVP dashboard');
    expect(compiled.textContent).toContain('First integration checklist');
    expect(compiled.querySelectorAll('.content-card').length).toBeGreaterThan(
      2
    );
  });
});
