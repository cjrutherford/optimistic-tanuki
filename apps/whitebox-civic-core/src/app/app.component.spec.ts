import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { civicClearTheme } from '@optimistic-tanuki/theme-lib';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('uses the civic clear theme', () => {
    TestBed.createComponent(AppComponent);

    expect(civicClearTheme.id).toBe('civic-clear');
    expect(civicClearTheme.mode).toBe('light');
  });

  it('renders a skip link and main landmark', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.civic-skip-link').textContent
    ).toContain('Skip to main content');
    expect(fixture.nativeElement.querySelector('main')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('civic-broadcast-banner')
    ).toBeTruthy();
  });
});
