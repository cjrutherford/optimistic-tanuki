import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NavigationComponent } from './navigation.component';
import { AuthStateService } from '../../services/auth-state.service';

describe('NavigationComponent', () => {
  let component: NavigationComponent;
  let router: { navigate: jest.Mock };
  let authState: { logout: jest.Mock };

  beforeEach(async () => {
    router = { navigate: jest.fn() };
    authState = { logout: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [NavigationComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthStateService, useValue: authState },
      ],
    }).compileComponents();

    component = TestBed.createComponent(NavigationComponent).componentInstance;
  });

  it('creates with the sidebar closed by default', () => {
    expect(component).toBeTruthy();
    expect(component.sidebarOpen()).toBe(false);
  });

  it('toggles the sidebar open and closed', () => {
    component.toggleSidebar();
    expect(component.sidebarOpen()).toBe(true);

    component.toggleSidebar();
    expect(component.sidebarOpen()).toBe(false);
  });

  it('closeSidebar forces it shut', () => {
    component.toggleSidebar();
    component.closeSidebar();
    expect(component.sidebarOpen()).toBe(false);
  });

  it('exposes navigation items for every top-level route', () => {
    const labels = component.navItems.map((item) => item.label);
    expect(labels).toEqual([
      'Dashboard',
      'Daily Four',
      'Daily Six',
      'Community Feed',
      'Profile',
      'About',
      'Logout',
    ]);
  });

  it('navigates and closes the sidebar when a route item is activated', () => {
    component.toggleSidebar();
    const dashboard = component.navItems.find(
      (item) => item.label === 'Dashboard'
    );
    dashboard?.action?.();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.sidebarOpen()).toBe(false);
  });

  it('routes each nav item to its expected path', () => {
    const expected: Record<string, string> = {
      'Daily Four': '/daily-four',
      'Daily Six': '/daily-six',
      'Community Feed': '/feed',
      Profile: '/profile',
      About: '/about',
    };

    for (const [label, path] of Object.entries(expected)) {
      router.navigate.mockClear();
      const item = component.navItems.find((i) => i.label === label);
      item?.action?.();
      expect(router.navigate).toHaveBeenCalledWith([path]);
    }
  });

  it('logs out and navigates to login when Logout is activated', () => {
    const logout = component.navItems.find((item) => item.label === 'Logout');
    logout?.action?.();

    expect(authState.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(component.sidebarOpen()).toBe(false);
  });
});
