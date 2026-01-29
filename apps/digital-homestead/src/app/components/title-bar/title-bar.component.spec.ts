import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TitleBarComponent } from './title-bar.component';
import { provideRouter, Router } from '@angular/router';

describe('TitleBarComponent', () => {
  let component: TitleBarComponent;
  let fixture: ComponentFixture<TitleBarComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TitleBarComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggleMenu should toggle menuOpen signal', () => {
    const initial = component.menuOpen();
    component.toggleMenu();
    expect(component.menuOpen()).toBe(!initial);
    component.toggleMenu();
    expect(component.menuOpen()).toBe(initial);
  });

  it('navigateTo should set window.location.href', () => {
    const originalHref = window.location.href;
    // Mocking window.location.href is tricky, but we can check if it tries to set it
    // Or just call it to ensure no crash and coverage
    component.navigateTo('#test');
    expect(window.location.href).toContain('#test');
    // Restore
    window.location.href = originalHref;
  });

  it('navigateToRoute should navigate and close menu', () => {
    const spy = jest.spyOn(router, 'navigate');
    component.menuOpen.set(true);
    
    component.navigateToRoute('/test');
    
    expect(spy).toHaveBeenCalledWith(['/test']);
    expect(component.menuOpen()).toBe(false);
  });

  it('navItems should have labels and working actions', () => {
      expect(component.navItems.length).toBeGreaterThan(0);
      const aboutItem = component.navItems.find(i => i.label === 'About');
      expect(aboutItem).toBeDefined();
      
      const navigateSpy = jest.spyOn(component, 'navigateTo');
      const navigateRouteSpy = jest.spyOn(component, 'navigateToRoute');

      aboutItem?.action?.();
      expect(navigateSpy).toHaveBeenCalledWith('#about');

      const benefitsItem = component.navItems.find(i => i.label === 'Benefits');
      benefitsItem?.action?.();
      expect(navigateSpy).toHaveBeenCalledWith('#benefits');

      const communityItem = component.navItems.find(i => i.label === 'Community');
      communityItem?.action?.();
      expect(navigateSpy).toHaveBeenCalledWith('#community');

      const resourcesItem = component.navItems.find(i => i.label === 'Resources');
      resourcesItem?.action?.();
      expect(navigateSpy).toHaveBeenCalledWith('#resources');

      const blogItem = component.navItems.find(i => i.label === 'Blog');
      blogItem?.action?.();
      expect(navigateSpy).toHaveBeenCalledWith('#blog');

      const contactItem = component.navItems.find(i => i.label === 'Contact');
      contactItem?.action?.();
      expect(navigateSpy).toHaveBeenCalledWith('#contact');

      const blogPostsItem = component.navItems.find(i => i.label === 'Blog Posts');
      blogPostsItem?.action?.();
      expect(navigateRouteSpy).toHaveBeenCalledWith('/blog');

      const forumItem = component.navItems.find(i => i.label === 'Forum');
      forumItem?.action?.();
      expect(navigateRouteSpy).toHaveBeenCalledWith('/forum');
  });
});