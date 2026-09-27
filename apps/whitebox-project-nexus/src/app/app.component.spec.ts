import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { industrialNexusTheme } from '@optimistic-tanuki/theme-lib';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('uses the industrial nexus theme', () => {
    TestBed.createComponent(AppComponent);

    expect(industrialNexusTheme.id).toBe('industrial-nexus');
    expect(industrialNexusTheme.baseColor).toBe('#1e293b');
    expect(industrialNexusTheme.primaryColor).toBe('#d97706');
  });

  it('renders a skip link and main landmark', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.nexus-skip-link').textContent
    ).toContain('Skip to main content');
    expect(fixture.nativeElement.querySelector('main')).toBeTruthy();
  });
});
