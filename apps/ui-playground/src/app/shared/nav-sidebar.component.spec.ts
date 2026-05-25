import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  IndexChipComponent,
  NavSidebarComponent,
} from './nav-sidebar.component';

describe('NavSidebarComponent', () => {
  let fixture: ComponentFixture<NavSidebarComponent>;
  let component: NavSidebarComponent;
  const originalInnerWidth = window.innerWidth;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavSidebarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NavSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  it('renders a compact mobile menu button and closed drawer by default', () => {
    const root = fixture.nativeElement as HTMLElement;
    const menuButton = root.querySelector('.mobile-menu-toggle');
    const sidebar = root.querySelector('.sidebar');

    expect(menuButton).toBeTruthy();
    expect(sidebar?.classList.contains('mobile-open')).toBe(false);
    expect(menuButton?.getAttribute('aria-label')).toBe(
      'Toggle navigation menu'
    );
  });

  it('opens the mobile drawer when the toggle is activated', () => {
    component.toggleMobileMenu();
    fixture.detectChanges();

    expect(component.mobileMenuOpen).toBe(true);
  });

  it('groups navigation into workflow-oriented sections', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Start Here');
    expect(root.textContent).toContain('Build UI');
    expect(root.textContent).toContain('Workflows');
    expect(root.textContent).toContain('Data & Search');
    expect(root.textContent).toContain('Operator Handbook');
    expect(root.textContent).toContain('Runbooks');
  });

  it('closes the mobile drawer on escape and returns focus to the toggle', () => {
    const menuButton = fixture.nativeElement.querySelector(
      '.mobile-menu-toggle'
    ) as HTMLButtonElement;

    component.toggleMobileMenu();
    fixture.detectChanges();
    menuButton.focus();
    component.handleEscapeKey(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.mobileMenuOpen).toBe(false);
    expect(document.activeElement).toBe(menuButton);
  });

  it('hides the mobile drawer semantically when closed on narrow viewports', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    fixture = TestBed.createComponent(NavSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const sidebar = fixture.nativeElement.querySelector(
      '.sidebar'
    ) as HTMLElement;

    expect(sidebar.hidden).toBe(true);
    expect(sidebar.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('IndexChipComponent', () => {
  let fixture: ComponentFixture<IndexChipComponent>;

  beforeEach(async () => {
    window.history.replaceState({}, '', '/motion-ui');

    await TestBed.configureTestingModule({
      imports: [IndexChipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IndexChipComponent);
    fixture.componentRef.setInput('id', 'murmuration');
    fixture.componentRef.setInput('label', 'otui-murmuration-scene');
    fixture.detectChanges();
  });

  it('preserves the current route when linking to a page fragment', () => {
    const chip = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(chip.getAttribute('href')).toBe('/motion-ui#murmuration');
  });
});
