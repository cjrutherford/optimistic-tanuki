import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  IndexChipComponent,
  NavSidebarComponent,
} from './nav-sidebar.component';

describe('NavSidebarComponent', () => {
  let fixture: ComponentFixture<NavSidebarComponent>;
  let component: NavSidebarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavSidebarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NavSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders a compact mobile menu button and closed drawer by default', () => {
    const root = fixture.nativeElement as HTMLElement;
    const menuButton = root.querySelector('.mobile-menu-toggle');
    const sidebar = root.querySelector('.sidebar');

    expect(menuButton).toBeTruthy();
    expect(sidebar?.classList.contains('mobile-open')).toBe(false);
  });

  it('opens the mobile drawer when the toggle is activated', () => {
    component.toggleMobileMenu();
    fixture.detectChanges();

    expect(component.mobileMenuOpen).toBe(true);
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
