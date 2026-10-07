import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { NavItem } from '@optimistic-tanuki/navigation-ui';
import { TitleBarComponent } from './title-bar.component';

@Component({ standalone: true, template: '' })
class BlankPageComponent {}

function flatten(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}

describe('TitleBarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        provideRouter([{ path: '**', component: BlankPageComponent }]),
      ],
    });
  });

  it('puts every page in the drawer, grouping offerings under Solutions', () => {
    const component =
      TestBed.createComponent(TitleBarComponent).componentInstance;
    const items = component.navItems();

    expect(items.map((item) => item.label)).toEqual([
      'Home',
      'Solutions',
      'Cost Comparison',
      'How We Work',
      'Contact',
    ]);
    expect(items[1].children?.map((item) => item.label)).toEqual([
      'Private Cloud',
      'Turn-key Appliances',
      'Software Stacks',
      'Custom Software',
      'Partners',
    ]);
    expect(items[1].children?.[0].children?.map((item) => item.label)).toEqual([
      'For your home',
      'For organizations',
      'Open-source stack',
      'Assessment',
    ]);
  });

  it('lifts the bar above other fixed elements only while the drawer is open', () => {
    const fixture = TestBed.createComponent(TitleBarComponent);
    const host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(host.classList).not.toContain('menu-open');

    fixture.componentInstance.toggleMenu();
    fixture.detectChanges();
    expect(host.classList).toContain('menu-open');

    fixture.componentInstance.menuOpen.set(false);
    fixture.detectChanges();
    expect(host.classList).not.toContain('menu-open');
  });

  it('navigates to the route of a drawer item', () => {
    const component =
      TestBed.createComponent(TitleBarComponent).componentInstance;
    const router = TestBed.inject(Router);
    const navigate = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);
    const partners = flatten(component.navItems()).find(
      (item) => item.label === 'Partners'
    );

    partners?.action?.();

    expect(navigate).toHaveBeenCalledWith('/partners');
  });

  it('marks the current page and its parents active after navigation', async () => {
    const fixture = TestBed.createComponent(TitleBarComponent);
    await TestBed.inject(Router).navigateByUrl('/private-cloud/home');
    const active = flatten(fixture.componentInstance.navItems())
      .filter((item) => item.isActive)
      .map((item) => item.label);

    expect(active).toEqual(['Solutions', 'Private Cloud', 'For your home']);
  });

  it('marks Home active only on the homepage', async () => {
    const fixture = TestBed.createComponent(TitleBarComponent);
    await TestBed.inject(Router).navigateByUrl('/contact');
    const home = fixture.componentInstance.navItems()[0];

    expect(home.isActive).toBe(false);
  });

  it('renders the brand, header links, audit action, and menu button', () => {
    const fixture = TestBed.createComponent(TitleBarComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(
      compiled.querySelectorAll<HTMLAnchorElement>('.desktop-nav a')
    ).map((link) => [link.textContent?.trim(), link.getAttribute('href')]);

    expect(compiled.textContent).toContain('HOPEFUL ASPIRATIONS INDUSTRIES');
    expect(links).toEqual([
      ['Private Cloud', '/private-cloud'],
      ['Cost Comparison', '/cost-comparison'],
      ['How We Work', '/how-we-work'],
      ['Contact', '/contact'],
    ]);
    expect(
      compiled.querySelector('.header-cta-btn')?.getAttribute('href')
    ).toBe('/contact');
    expect(compiled.querySelector('.brand-link')?.getAttribute('href')).toBe(
      '/'
    );
    expect(compiled.querySelector('.menu-btn')).not.toBeNull();
  });

  it('opens the drawer from the menu button', () => {
    const fixture = TestBed.createComponent(TitleBarComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      '.menu-btn'
    ) as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.menuOpen()).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});
