import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ThemeToggleComponent } from './theme-toggle.component';

describe('ThemeToggleComponent', () => {
  let fixture: ComponentFixture<ThemeToggleComponent>;
  let component: ThemeToggleComponent;

  function configure(platformId: 'browser' | 'server') {
    TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [{ provide: PLATFORM_ID, useValue: platformId }],
    });
    fixture = TestBed.createComponent(ThemeToggleComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to the stored theme on init in the browser', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    localStorage.setItem('local-hub-theme', 'dark');
    configure('browser');
    fixture.detectChanges();

    expect(component.isDark()).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(component.ariaLabel()).toBe('Switch to light mode');
  });

  it('falls back to the OS preference when nothing is stored', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    configure('browser');
    fixture.detectChanges();

    expect(component.isDark()).toBe(true);
  });

  it('toggles the theme and persists the choice', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    configure('browser');
    fixture.detectChanges();
    expect(component.isDark()).toBe(false);

    const button = fixture.nativeElement.querySelector('button');
    button.click();
    fixture.detectChanges();

    expect(component.isDark()).toBe(true);
    expect(localStorage.getItem('local-hub-theme')).toBe('dark');
    expect(component.ariaLabel()).toBe('Switch to light mode');

    button.click();
    fixture.detectChanges();
    expect(component.isDark()).toBe(false);
    expect(localStorage.getItem('local-hub-theme')).toBe('light');
  });

  it('does nothing on init or toggle when rendered on the server', () => {
    configure('server');
    fixture.detectChanges();
    expect(component.isDark()).toBe(false);

    component.toggle();
    expect(component.isDark()).toBe(false);
  });
});
